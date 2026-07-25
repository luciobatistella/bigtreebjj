import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  removeCommunityCertificate,
  storeCommunityCertificate,
  type CommunityCertificateFile
} from './storage.js';

const optionalShortText = z.string().trim().max(160).optional().or(z.literal(''));
const optionalLongText = z.string().trim().max(2500).optional().or(z.literal(''));
const beltRankSchema = z.enum([
  'gray',
  'yellow',
  'orange',
  'green',
  'blue',
  'purple',
  'brown',
  'black'
]);
const certificateManifestItemSchema = z.object({
  fieldName: z.string().regex(/^certificate_[a-z0-9_]+$/).max(80),
  track: z.enum(['adult', 'youth']),
  beltRank: beltRankSchema,
  beltLabel: z.string().trim().min(2).max(40),
  sequence: z.number().int().min(0).max(20),
  awardedAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Informe uma data válida.')
});

export const lineageSubmissionSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Informe seu nome completo.').max(140),
    email: z.string().trim().email('Informe um e-mail válido.').max(180),
    instagram: optionalShortText,
    teacherPersonId: optionalShortText,
    teacherName: z.string().trim().min(2, 'Informe quem concedeu sua faixa-preta.').max(140),
    academyTeam: optionalShortText,
    city: optionalShortText,
    country: optionalShortText,
    promotionDate: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Informe uma data válida.'),
    claimType: z
      .enum(['black_belt_awarded_by', 'co_awarded_black_belt', 'trained_under'])
      .default('black_belt_awarded_by'),
    graduationTrack: z.enum(['adult', 'youth']).default('adult'),
    certificateCompletenessConfirmed: z.boolean().default(false),
    certificateManifest: z.array(certificateManifestItemSchema).max(9).default([]),
    evidenceUrls: z.array(z.string().trim().url('Cada evidência deve ser um link válido.')).max(8).default([]),
    evidenceNotes: optionalLongText,
    consent: z.literal(true, {
      errorMap: () => ({ message: 'É necessário autorizar a análise editorial dos dados enviados.' })
    }),
    website: z.string().max(0).optional()
  })
  .superRefine((value, context) => {
    const fieldNames = value.certificateManifest.map((certificate) => certificate.fieldName);
    const beltRanks = value.certificateManifest.map((certificate) => certificate.beltRank);
    const sequences = value.certificateManifest.map((certificate) => certificate.sequence);
    if (new Set(fieldNames).size !== fieldNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['certificateManifest'],
        message: 'Cada arquivo de certificado deve aparecer uma única vez.'
      });
    }
    if (new Set(beltRanks).size !== beltRanks.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['certificateManifest'],
        message: 'Envie somente um certificado consolidado por faixa ou grupo de faixa.'
      });
    }
    if (new Set(sequences).size !== sequences.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['certificateManifest'],
        message: 'A sequência dos certificados não pode conter etapas repetidas.'
      });
    }
    if (value.certificateManifest.some((certificate) => certificate.track !== value.graduationTrack)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['certificateManifest'],
        message: 'Todos os certificados devem pertencer à trajetória selecionada.'
      });
    }
    const youthOnlyRanks = new Set(['gray', 'yellow', 'orange', 'green']);
    if (
      value.graduationTrack === 'adult' &&
      value.certificateManifest.some((certificate) => youthOnlyRanks.has(certificate.beltRank))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['certificateManifest'],
        message: 'As graduações infantis e juvenis exigem a trajetória iniciada jovem.'
      });
    }

    const blackBeltRequest = value.claimType !== 'trained_under';
    if (blackBeltRequest) {
      if (!value.certificateCompletenessConfirmed) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['certificateCompletenessConfirmed'],
          message: 'Confirme que todos os certificados recebidos foram incluídos.'
        });
      }
      const documentedRanks = new Set(value.certificateManifest.map((certificate) => certificate.beltRank));
      const missingRanks = ['blue', 'purple', 'brown', 'black'].filter((rank) => !documentedRanks.has(rank as any));
      if (missingRanks.length) {
        const labels: Record<string, string> = {
          blue: 'azul',
          purple: 'roxa',
          brown: 'marrom',
          black: 'preta'
        };
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['certificateManifest'],
          message: `Envie os certificados obrigatórios: ${missingRanks.map((rank) => labels[rank]).join(', ')}.`
        });
      }
    }
    if (
      !value.evidenceUrls.length &&
      !value.certificateManifest.length &&
      (value.evidenceNotes?.trim().length ?? 0) < 24
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidenceNotes'],
        message: 'Inclua ao menos um link ou explique a promoção com um pouco mais de detalhe.'
      });
    }
  });

export type LineageSubmissionInput = z.infer<typeof lineageSubmissionSchema>;
export type NamedCommunityCertificateFile = CommunityCertificateFile & { fieldName: string };

function protocol() {
  return `TBT-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

function cleanOptional(value?: string) {
  const clean = value?.trim();
  return clean || null;
}

async function resolveTeacher(db: any, teacherPersonId?: string | null, teacherName?: string) {
  if (teacherPersonId) {
    const byId = await db.person.findUnique({ where: { id: teacherPersonId } });
    if (byId) return byId;
  }
  if (!teacherName) return null;
  return db.person.findFirst({
    where: { fullName: { equals: teacherName.trim(), mode: 'insensitive' } }
  });
}

export async function createLineageSubmission(
  db: any,
  rawInput: unknown,
  certificateFiles: NamedCommunityCertificateFile[] = []
) {
  const input = lineageSubmissionSchema.parse(rawInput);
  const teacher = await resolveTeacher(db, input.teacherPersonId, input.teacherName);
  const filesByField = new Map(certificateFiles.map((file) => [file.fieldName, file]));
  if (
    filesByField.size !== certificateFiles.length ||
    certificateFiles.length !== input.certificateManifest.length ||
    input.certificateManifest.some((entry) => !filesByField.has(entry.fieldName))
  ) {
    throw new Error('A lista de certificados não corresponde aos arquivos enviados.');
  }

  const storedCertificates: Array<{
    metadata: z.infer<typeof certificateManifestItemSchema>;
    stored: Awaited<ReturnType<typeof storeCommunityCertificate>>;
  }> = [];
  try {
    for (const metadata of input.certificateManifest) {
      const file = filesByField.get(metadata.fieldName);
      if (!file) throw new Error(`Certificado ausente para a faixa ${metadata.beltLabel}.`);
      storedCertificates.push({
        metadata,
        stored: await storeCommunityCertificate(file)
      });
    }

    const created = await db.$transaction(async (transaction: any) => {
      const submission = await transaction.lineageSubmission.create({
        data: {
          protocol: protocol(),
          fullName: input.fullName,
          email: input.email.toLowerCase(),
          instagram: cleanOptional(input.instagram),
          // Só persistimos um ID canônico encontrado no PostgreSQL. IDs vindos da
          // interface nunca são confiados cegamente; o nome declarado permanece
          // disponível para resolução editorial.
          teacherPersonId: teacher?.id ?? null,
          teacherName: teacher?.fullName ?? input.teacherName,
          academyTeam: cleanOptional(input.academyTeam),
          city: cleanOptional(input.city),
          country: cleanOptional(input.country),
          promotionDate: input.promotionDate ? new Date(input.promotionDate) : null,
          claimType: input.claimType,
          graduationTrack: input.graduationTrack,
          certificateCompletenessConfirmed: input.certificateCompletenessConfirmed,
          evidenceUrls: input.evidenceUrls,
          evidenceNotes: cleanOptional(input.evidenceNotes),
          consent: input.consent,
          status: 'pending_review',
          certificates: {
            create: storedCertificates.map(({ metadata, stored }) => ({
              track: metadata.track,
              beltRank: metadata.beltRank,
              beltLabel: metadata.beltLabel,
              sequence: metadata.sequence,
              awardedAt: metadata.awardedAt ? new Date(metadata.awardedAt) : null,
              originalName: stored.originalName,
              mimeType: stored.mimetype,
              size: stored.size,
              storagePath: stored.storagePath,
              sha256: stored.sha256
            }))
          }
        }
      });
      await transaction.reviewQueue.create({
        data: { entityType: 'lineage_submission', entityId: submission.id, status: 'pending' }
      });
      await transaction.changeHistory.create({
        data: {
          entityType: 'lineage_submission',
          entityId: submission.id,
          action: 'community_submission_created',
          changedBy: 'community',
          details: JSON.stringify({
            protocol: submission.protocol,
            teacherName: submission.teacherName,
            evidenceCount: submission.evidenceUrls.length,
            certificateCount: storedCertificates.length,
            graduationTrack: input.graduationTrack
          })
        }
      });
      return submission;
    });
    return {
      protocol: created.protocol,
      status: created.status,
      teacherName: created.teacherName,
      submittedAt: created.createdAt,
      certificateAttached: Boolean(storedCertificates.length),
      certificateCount: storedCertificates.length
    };
  } catch (error) {
    await Promise.all(
      storedCertificates.map(({ stored }) => removeCommunityCertificate(stored.storagePath))
    );
    throw error;
  }
}

export async function listLineageSubmissions(db: any, status?: string) {
  return db.lineageSubmission.findMany({
    where: status && status !== 'all' ? { status } : undefined,
    include: { certificates: { orderBy: { sequence: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
}

export async function getLineageSubmission(db: any, id: string) {
  return db.lineageSubmission.findUnique({
    where: { id },
    include: { certificates: { orderBy: { sequence: 'asc' } } }
  });
}

export async function getLineageSubmissionStatus(db: any, submissionProtocol: string) {
  const submission = await db.lineageSubmission.findUnique({ where: { protocol: submissionProtocol } });
  if (!submission) return null;
  return {
    protocol: submission.protocol,
    status: submission.status,
    fullName: submission.fullName,
    teacherName: submission.teacherName,
    submittedAt: submission.createdAt,
    reviewedAt: submission.reviewedAt,
    reviewerMessage: submission.reviewerNotes
  };
}

export async function decideLineageSubmission(
  db: any,
  id: string,
  action: 'approve' | 'reject' | 'request_evidence',
  input: { reviewerNotes?: string; teacherPersonId?: string; personId?: string } = {}
) {
  const submission = await db.lineageSubmission.findUnique({
    where: { id },
    include: { certificates: { orderBy: { sequence: 'asc' } } }
  });
  if (!submission) throw new Error('Solicitação não encontrada.');

  if (action !== 'approve') {
    const status = action === 'reject' ? 'rejected' : 'needs_evidence';
    const updated = await db.lineageSubmission.update({
      where: { id },
      data: {
        status,
        reviewerNotes: cleanOptional(input.reviewerNotes),
        reviewedAt: new Date()
      }
    });
    await db.reviewQueue.updateMany({
      where: { entityType: 'lineage_submission', entityId: id },
      data: { status }
    });
    await db.changeHistory.create({
      data: {
        entityType: 'lineage_submission',
        entityId: id,
        action,
        changedBy: 'reviewer',
        details: JSON.stringify({ reviewerNotes: input.reviewerNotes ?? '' })
      }
    });
    return updated;
  }

  if (submission.status === 'approved' && submission.lineageClaimId) return submission;

  return db.$transaction(async (transaction: any) => {
    const teacher = await resolveTeacher(
      transaction,
      input.teacherPersonId ?? submission.teacherPersonId,
      submission.teacherName
    );
    if (!teacher) {
      throw new Error('O professor ainda não existe na base. Vincule um professor antes de aprovar.');
    }

    let person = input.personId
      ? await transaction.person.findUnique({ where: { id: input.personId } })
      : await transaction.person.findFirst({
          where: { fullName: { equals: submission.fullName, mode: 'insensitive' } }
        });
    if (!person) {
      person = await transaction.person.create({
        data: {
          fullName: submission.fullName,
          nicknames: [],
          country: submission.country,
          city: submission.city,
          team: submission.academyTeam
        }
      });
    }

    let claim = await transaction.lineageClaim.findFirst({
      where: {
        studentPersonId: person.id,
        teacherPersonId: teacher.id,
        claimType: submission.claimType,
        status: { in: ['confirmed', 'corroborated', 'verified'] }
      }
    });
    if (!claim) {
      const label =
        submission.claimType === 'trained_under'
          ? 'Treinou sob'
          : submission.claimType === 'co_awarded_black_belt'
            ? 'Faixa-preta concedida em conjunto por'
            : 'Faixa-preta concedida por';
      claim = await transaction.lineageClaim.create({
        data: {
          studentPersonId: person.id,
          teacherPersonId: teacher.id,
          claimType: submission.claimType,
          relationshipLabel: label,
          dateStart: submission.promotionDate,
          location: [submission.city, submission.country].filter(Boolean).join(', ') || null,
          status: 'confirmed',
          evidenceLevel: 'community_submission',
          confidenceScore:
            submission.evidenceUrls.length ||
            submission.certificateStoragePath ||
            submission.certificates.length
              ? 0.78
              : 0.62,
          notes: [
            `Solicitação comunitária ${submission.protocol}.`,
            submission.certificateStoragePath || submission.certificates.length
              ? `${submission.certificates.length || 1} certificado(s) privado(s) conferido(s) pela curadoria.`
              : null,
            submission.evidenceNotes,
            input.reviewerNotes
          ]
            .filter(Boolean)
            .join(' '),
          evidences: {
            create: submission.evidenceUrls.map((url: string) => ({
              url,
              sourceType: 'community_submission',
              curatorNotes: `Enviado em ${submission.protocol}`
            }))
          }
        }
      });
    }

    const updated = await transaction.lineageSubmission.update({
      where: { id },
      data: {
        status: 'approved',
        teacherPersonId: teacher.id,
        teacherName: teacher.fullName,
        personId: person.id,
        lineageClaimId: claim.id,
        reviewerNotes: cleanOptional(input.reviewerNotes),
        reviewedAt: new Date()
      }
    });
    await transaction.reviewQueue.updateMany({
      where: { entityType: 'lineage_submission', entityId: id },
      data: { status: 'approved' }
    });
    await transaction.changeHistory.create({
      data: {
        entityType: 'lineage_submission',
        entityId: id,
        action: 'approve',
        changedBy: 'reviewer',
        details: JSON.stringify({ personId: person.id, lineageClaimId: claim.id, teacherPersonId: teacher.id })
      }
    });
    return updated;
  });
}
