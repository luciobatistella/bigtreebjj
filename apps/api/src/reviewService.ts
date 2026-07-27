import { findFallbackImportRowByCreatedEntityId, listFallbackImportRowsByCategory, parseImportJsonObject } from './importService.js';
import { publishLineageRelationship, reclassifyRelationship } from './domain.js';

export interface ReviewDecision {
  id: string;
  claimId: string;
  action: 'approve' | 'reject' | 'dispute' | 'request_evidence';
  notes: string;
  createdAt: string;
  claimType?: string;
  relationshipLabel?: string;
  sourceUrls?: string[];
}

const decisions: ReviewDecision[] = [];
const fallbackClaimStatus = new Map<string, Record<string, unknown>>();

let prisma: any = null;

async function getPrismaClient() {
  if (process.env.VITEST) {
    return null;
  }
  if (prisma) {
    return prisma;
  }
  try {
    const module = await import('@prisma/client');
    prisma = new module.PrismaClient();
    await prisma.$connect();
    return prisma;
  } catch {
    prisma = null;
    return null;
  }
}

export function createReviewDecision(input: { claimId: string; action: ReviewDecision['action']; notes: string }) {
  const decision: ReviewDecision = {
    id: `decision-${decisions.length + 1}`,
    claimId: input.claimId,
    action: input.action,
    notes: input.notes,
    createdAt: new Date().toISOString()
  };
  decisions.push(decision);
  return decision;
}

export function listReviewDecisions() {
  return decisions;
}

function fallbackClaimPayload(claimId: string) {
  const row = findFallbackImportRowByCreatedEntityId(claimId);
  const raw = parseImportJsonObject(row?.rawPayload);
  const evidenceRows = listFallbackImportRowsByCategory('claim_evidence').filter((entry: any) => {
    const evidenceRaw = parseImportJsonObject(entry.rawPayload);
    return evidenceRaw.claim_id && evidenceRaw.claim_id === raw.claim_id;
  });
  const linkedSources = evidenceRows.map((entry: any) => {
    const evidenceRaw = parseImportJsonObject(entry.rawPayload);
    return {
      id: evidenceRaw.evidence_id ?? entry.createdEntityId,
      url: evidenceRaw.url,
      sourceType: evidenceRaw.source_type,
      captureDate: evidenceRaw.capture_date,
      originalRow: evidenceRaw.original_row
    };
  });
  return { row, raw, linkedSources };
}

export async function getClaimReview(claimId: string) {
  const db = await getPrismaClient();
  if (db) {
    const claim = await db.lineageClaim.findUnique({
      where: { id: claimId },
      include: {
        studentPerson: true,
        teacherPerson: true,
        evidences: true,
        reviewDecisions: true,
        promotionGroup: true
      }
    });
    if (!claim) {
      return null;
    }
    const importRows = await db.importRow.findMany({ where: { createdEntityId: claimId }, orderBy: { originalRowNumber: 'asc' } });
    const auditHistory = await db.changeHistory.findMany({ where: { entityId: claimId }, orderBy: { createdAt: 'desc' } });
    return {
      id: claim.id,
      student: claim.studentPerson?.fullName ?? 'Unknown student',
      teacher: claim.teacherPerson?.fullName ?? 'Unknown teacher',
      claimType: claim.claimType,
      promotionGroup: claim.promotionGroup?.title ?? null,
      evidenceLevel: claim.evidenceLevel,
      status: claim.status,
      importedSourceRow: importRows[0]?.originalRowNumber ?? null,
      linkedSources: claim.evidences.map((evidence: any) => ({ id: evidence.id, url: evidence.url, sourceType: evidence.sourceType })),
      evidenceUrls: claim.evidences.map((evidence: any) => evidence.url),
      internalNotes: claim.notes ?? '',
      auditHistory: [
        ...claim.reviewDecisions.map((decision: any) => ({ id: decision.id, action: decision.action, notes: decision.notes, createdAt: decision.createdAt })),
        ...auditHistory.map((entry: any) => ({ id: entry.id, action: entry.action, notes: entry.details, createdAt: entry.createdAt }))
      ]
    };
  }

  const matchingDecision = decisions.find((decision) => decision.claimId === claimId);
  const { row, raw, linkedSources } = fallbackClaimPayload(claimId);
  const override = fallbackClaimStatus.get(claimId) ?? {};
  return {
    id: claimId,
    student: raw.student_name ?? 'Imported student',
    teacher: raw.teacher_name ?? 'Imported teacher',
    claimType: override.claimType ?? raw.claim_type ?? 'black_belt_awarded_by',
    relationshipLabel: override.relationshipLabel ?? raw.relationship_label ?? raw.relationship_type ?? 'Imported claim',
    promotionGroup: raw.promotion_group_id ?? null,
    evidenceLevel: override.evidenceLevel ?? raw.evidence_level ?? 'imported',
    status: override.status ?? (matchingDecision?.action === 'approve' ? 'confirmed' : 'pending_review'),
    importedSourceRow: row?.originalRowNumber ?? raw.original_row ?? null,
    evidenceUrls: linkedSources.map((source) => source.url).filter(Boolean),
    linkedSources,
    internalNotes: override.notes ?? matchingDecision?.notes ?? raw.notes ?? '',
    auditHistory: decisions.filter((decision) => decision.claimId === claimId)
  };
}

export async function listClaimReviews(status = 'pending_review') {
  const db = await getPrismaClient();
  if (!db) return [];
  const claims = await db.lineageClaim.findMany({
    where: status === 'all' ? {} : { status },
    include: {
      studentPerson: true,
      teacherPerson: true,
      evidences: true,
      reviewDecisions: true
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: 250
  });
  return claims.map((claim: any) => ({
    id: claim.id,
    student: claim.studentPerson?.fullName ?? 'Pessoa não resolvida',
    teacher: claim.teacherPerson?.fullName ?? 'Professor não resolvido',
    claimType: claim.claimType,
    relationshipLabel: claim.relationshipLabel,
    evidenceLevel: claim.evidenceLevel,
    confidenceScore: claim.confidenceScore,
    status: claim.status,
    sourceCount: claim.evidences.length,
    evidenceUrls: claim.evidences.map((evidence: any) => evidence.url),
    notes: claim.notes ?? '',
    updatedAt: claim.updatedAt,
    reviewCount: claim.reviewDecisions.length
  }));
}

export async function decideClaimReview(
  claimId: string,
  action: ReviewDecision['action'],
  notes: string,
  evidenceLevel?: string,
  options: {
    claimType?: string;
    relationshipLabel?: string;
    studentPersonId?: string;
    teacherPersonId?: string;
    sourceUrls?: string[];
    status?: 'confirmed' | 'corroborated';
    reviewerId?: string;
  } = {}
) {
  const db = await getPrismaClient();
  const statusByAction: Record<ReviewDecision['action'], string> = {
    approve: 'confirmed',
    reject: 'rejected',
    dispute: 'disputed',
    request_evidence: 'needs_evidence'
  };
  if (db) {
    const currentClaim = await db.lineageClaim.findUnique({
      where: { id: claimId },
      include: { evidences: true }
    });
    if (!currentClaim) {
      throw new Error('Relação de linhagem não encontrada.');
    }
    if (action === 'approve' && !currentClaim.teacherPersonId) {
      throw new Error('A relação não possui um professor resolvido.');
    }
    if (action === 'approve' && currentClaim.evidences.length === 0) {
      throw new Error('Vincule ao menos uma evidência antes de aprovar esta relação.');
    }
    const updated = await db.lineageClaim.update({
      where: { id: claimId },
      data: {
        status: statusByAction[action],
        evidenceLevel: evidenceLevel ?? undefined,
        notes: notes || undefined,
        reviewDecisions: {
          create: {
            action,
            notes,
            reviewerId: options.reviewerId ?? 'reviewer'
          }
        }
      }
    });
    await db.changeHistory.create({ data: { entityType: 'lineage_claim', entityId: claimId, action, changedBy: options.reviewerId ?? 'reviewer', details: JSON.stringify({ notes, evidenceLevel }) } }).catch(() => undefined);
    const reviewedEntityIds = [
      claimId,
      ...currentClaim.evidences.map((evidence: any) => evidence.id)
    ];
    const reviewedRows = await db.importRow.findMany({
      where: { createdEntityId: { in: reviewedEntityIds } },
      select: { id: true }
    });
    if (reviewedRows.length) {
      await db.reviewQueue.updateMany({
        where: { entityId: { in: reviewedRows.map((row: any) => row.id) } },
        data: {
          status: action === 'request_evidence' ? 'needs_evidence' : 'closed'
        }
      });
    }
    return { id: updated.id, status: updated.status, action };
  }

  const { raw, linkedSources } = fallbackClaimPayload(claimId);
  const sourceUrls = options.sourceUrls ?? linkedSources.map((source) => String(source.url)).filter(Boolean);
  const claimType = options.claimType ?? String(raw.claim_type ?? 'black_belt_awarded_by');
  const relationshipLabel = options.relationshipLabel ?? String(raw.relationship_label ?? raw.relationship_type ?? 'Black belt awarded by');
  const status = options.status ?? (statusByAction[action] as 'confirmed' | 'corroborated');
  const decision = createReviewDecision({ claimId, action, notes });
  fallbackClaimStatus.set(claimId, { status: statusByAction[action], evidenceLevel, notes, claimType, relationshipLabel, sourceUrls });

  let publishedRelationship = null;
  if (action === 'approve' && sourceUrls.length > 0) {
    publishedRelationship = publishLineageRelationship({
      id: claimId,
      studentPersonId: options.studentPersonId ?? String(raw.student_person_id ?? raw.student_id ?? raw.student_name ?? 'imported-student'),
      teacherPersonId: options.teacherPersonId ?? String(raw.promoter_person_id ?? raw.teacher_person_id ?? raw.teacher_name ?? 'imported-teacher'),
      claimType,
      relationshipLabel,
      evidenceLevel: evidenceLevel ?? String(raw.evidence_level ?? 'reviewed'),
      sourceUrls,
      reviewerNote: notes,
      status,
      originalClaimId: claimId
    });
  }

  return { id: claimId, status: statusByAction[action], action, decision, publishedRelationship };
}

export async function reclassifyClaimReview(claimId: string, claimType: string, relationshipLabel: string, notes: string) {
  fallbackClaimStatus.set(claimId, { ...(fallbackClaimStatus.get(claimId) ?? {}), claimType, relationshipLabel, notes });
  try {
    return reclassifyRelationship(claimId, claimType, relationshipLabel, notes);
  } catch {
    return { id: claimId, claimType, relationshipLabel, notes };
  }
}
