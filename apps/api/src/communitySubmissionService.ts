import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  removeCommunityCertificate,
  storeCommunityCertificate,
  type CommunityCertificateFile
} from './storage.js';
import { resolvePublicTreePeople } from './publicLineage.js';

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
const selectedTeacherSchema = z.object({
  personId: z.string().trim().min(1).max(160),
  name: z.string().trim().min(2).max(140)
});

export const lineageSubmissionSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Informe seu nome completo.').max(140),
    email: z.string().trim().email('Informe um e-mail válido.').max(180),
    instagram: optionalShortText,
    teacherPersonId: optionalShortText,
    teacherName: optionalShortText,
    teachers: z.array(selectedTeacherSchema).max(4).default([]),
    academyTeam: optionalShortText,
    city: optionalShortText,
    country: optionalShortText,
    countryCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'Selecione um país válido.')
      .optional()
      .or(z.literal('')),
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
    const teacherIds = value.teachers.length
      ? value.teachers.map((teacher) => teacher.personId)
      : value.teacherPersonId
        ? [value.teacherPersonId]
        : [];
    if (!teacherIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['teachers'],
        message: 'Selecione um professor que já esteja na árvore.'
      });
    }
    if (new Set(teacherIds).size !== teacherIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['teachers'],
        message: 'O mesmo professor não pode ser selecionado duas vezes.'
      });
    }
    if (teacherIds.length > 1 && value.claimType !== 'co_awarded_black_belt') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['claimType'],
        message: 'Use a conexão conjunta quando houver mais de um professor.'
      });
    }
    if (value.claimType === 'co_awarded_black_belt' && teacherIds.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['teachers'],
        message: 'Selecione ao menos dois professores para uma graduação conjunta.'
      });
    }
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

async function resolveSelectedTeachers(db: any, input: LineageSubmissionInput) {
  const requestedTeachers = input.teachers.length
    ? input.teachers
    : input.teacherPersonId
      ? [{ personId: input.teacherPersonId, name: input.teacherName ?? '' }]
      : [];
  const requestedIds = requestedTeachers.map((teacher) => teacher.personId);
  const people = await resolvePublicTreePeople(db, requestedIds);
  const peopleById = new Map(people.map((person: any) => [person.id, person]));
  const resolved = requestedIds.map((personId) => peopleById.get(personId)).filter(Boolean);

  if (resolved.length !== requestedIds.length) {
    throw new Error(
      'Um dos professores selecionados não existe ou ainda não faz parte da árvore pública.'
    );
  }
  return resolved;
}

export async function createLineageSubmission(
  db: any,
  rawInput: unknown,
  certificateFiles: NamedCommunityCertificateFile[] = []
) {
  const input = lineageSubmissionSchema.parse(rawInput);
  const teachers: any[] = await resolveSelectedTeachers(db, input);
  const teacher = teachers[0];
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
          // Todos os IDs são resolvidos novamente na árvore pública. O primeiro
          // professor permanece nos campos legados para compatibilidade editorial.
          teacherPersonId: teacher.id,
          teacherName: teacher.fullName,
          teacherPersonIds: teachers.map((person: any) => person.id),
          teacherNames: teachers.map((person: any) => person.fullName),
          academyTeam: cleanOptional(input.academyTeam),
          city: cleanOptional(input.city),
          country: cleanOptional(input.country),
          countryCode: cleanOptional(input.countryCode),
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
            teacherNames: submission.teacherNames,
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
      teacherNames: created.teacherNames,
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
    teacherNames: submission.teacherNames,
    submittedAt: submission.createdAt,
    reviewedAt: submission.reviewedAt,
    reviewerMessage: submission.reviewerNotes
  };
}

export async function decideLineageSubmission(
  db: any,
  id: string,
  action: 'approve' | 'reject' | 'request_evidence',
  input: { reviewerNotes?: string; teacherPersonId?: string; personId?: string; reviewerId?: string } = {}
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
      data: { status: action === 'reject' ? 'closed' : status }
    });
    await db.changeHistory.create({
      data: {
        entityType: 'lineage_submission',
        entityId: id,
        action,
        changedBy: input.reviewerId ?? 'reviewer',
        details: JSON.stringify({ reviewerNotes: input.reviewerNotes ?? '' })
      }
    });
    return updated;
  }

  if (submission.status === 'approved' && submission.lineageClaimId) return submission;

  return db.$transaction(async (transaction: any) => {
    const storedTeacherIds =
      submission.teacherPersonIds?.length
        ? [...submission.teacherPersonIds]
        : submission.teacherPersonId
          ? [submission.teacherPersonId]
          : [];
    if (input.teacherPersonId) storedTeacherIds[0] = input.teacherPersonId;
    const storedTeacherNames =
      submission.teacherNames?.length ? submission.teacherNames : [submission.teacherName];
    const teachers = (
      await Promise.all(
        storedTeacherIds.map((teacherPersonId: string, index: number) =>
          resolveTeacher(transaction, teacherPersonId, storedTeacherNames[index])
        )
      )
    ).filter(Boolean);
    if (!teachers.length || teachers.length !== storedTeacherIds.length) {
      throw new Error(
        'Um dos professores ainda não existe na base. Vincule todos os professores antes de aprovar.'
      );
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

    const label =
      submission.claimType === 'trained_under'
        ? 'Treinou sob'
        : submission.claimType === 'co_awarded_black_belt'
          ? 'Faixa-preta concedida em conjunto por'
          : 'Faixa-preta concedida por';
    const claims = [];
    for (const teacher of teachers) {
      let claim = await transaction.lineageClaim.findFirst({
        where: {
          studentPersonId: person.id,
          teacherPersonId: teacher.id,
          claimType: submission.claimType,
          status: { in: ['confirmed', 'corroborated', 'verified'] }
        }
      });
      if (!claim) {
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
      claims.push(claim);
    }
    const primaryTeacher = teachers[0];
    const primaryClaim = claims[0];

    const updated = await transaction.lineageSubmission.update({
      where: { id },
      data: {
        status: 'approved',
        teacherPersonId: primaryTeacher.id,
        teacherName: primaryTeacher.fullName,
        teacherPersonIds: teachers.map((teacher: any) => teacher.id),
        teacherNames: teachers.map((teacher: any) => teacher.fullName),
        personId: person.id,
        lineageClaimId: primaryClaim.id,
        reviewerNotes: cleanOptional(input.reviewerNotes),
        reviewedAt: new Date()
      }
    });
    await transaction.reviewQueue.updateMany({
      where: { entityType: 'lineage_submission', entityId: id },
      data: { status: 'closed' }
    });
    await transaction.changeHistory.create({
      data: {
        entityType: 'lineage_submission',
        entityId: id,
        action: 'approve',
        changedBy: input.reviewerId ?? 'reviewer',
        details: JSON.stringify({
          personId: person.id,
          lineageClaimIds: claims.map((claim: any) => claim.id),
          teacherPersonIds: teachers.map((teacher: any) => teacher.id)
        })
      }
    });
    return updated;
  });
}
