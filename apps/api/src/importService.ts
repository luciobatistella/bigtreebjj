import { createHash } from 'crypto';
import { existsSync, promises as fs } from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { listPublicLineageGraph } from './domain.js';

let prisma: any = null;
const importJobs: Array<Record<string, unknown>> = [];
const importRowsByJob = new Map<string, Array<Record<string, unknown>>>();
const duplicateCandidatesByImport = new Map<string, Array<Record<string, unknown>>>();
const reviewQueueByImport = new Map<string, Array<Record<string, unknown>>>();
const duplicateAudit = new Map<string, Array<Record<string, unknown>>>();
const generatedResearchTasks = new Map<string, Record<string, unknown>>();
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export interface ImportPreviewResult {
  format: string;
  fileName: string;
  rows: Array<Record<string, unknown>>;
  summary: { totalRows: number; validRows: number; invalidRows: number };
  preview: string;
  metadata?: Record<string, unknown>;
}

function getImportJobStore() {
  return importJobs as Array<Record<string, unknown>>;
}

async function connectPrisma() {
  if (process.env.VITEST) {
    return false;
  }
  if (prisma) {
    return true;
  }

  try {
    const module = await import('@prisma/client');
    prisma = new module.PrismaClient();
    await prisma.$connect();
    return true;
  } catch {
    prisma = null;
    return false;
  }
}

async function getPrismaClient() {
  const connected = await connectPrisma();
  return connected ? prisma : null;
}

function parseJsonObject(value: unknown, fallback: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return value as Record<string, unknown>;
  }
  if (!value || typeof value !== 'string') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : fallback;
  } catch {
    return fallback;
  }
}

export function parseImportJsonObject(value: unknown, fallback: Record<string, unknown> = {}) {
  return parseJsonObject(value, fallback);
}

function parseJsonArray(value: unknown) {
  if (!value || typeof value !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value: unknown) {
  if (!value) {
    return undefined;
  }
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseDateOrNow(value: unknown) {
  if (!value) {
    return new Date();
  }
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeComparable(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseImportPreview(payload: Record<string, unknown>): ImportPreviewResult {
  return {
    format: (payload.format as string) ?? 'csv',
    fileName: (payload.file_name as string) ?? 'import.csv',
    rows: (payload.rows as Array<Record<string, unknown>>) ?? [],
    summary: {
      totalRows: Number((payload.summary as Record<string, unknown>)?.total_rows ?? 0),
      validRows: Number((payload.summary as Record<string, unknown>)?.valid_rows ?? 0),
      invalidRows: Number((payload.summary as Record<string, unknown>)?.invalid_rows ?? 0)
    },
    preview: (payload.preview as string) ?? '[]',
    metadata: (payload.metadata as Record<string, unknown>) ?? {}
  };
}

export function previewImport(filePath: string, format: 'csv' | 'xlsx' | 'sqlite', options: Record<string, unknown> = {}): ImportPreviewResult {
  const absolutePath = path.resolve(filePath);
  const scriptMap = {
    csv: 'csvImporter.py',
    xlsx: 'excelImporter.py',
    sqlite: 'sqliteImporter.py'
  };
  const scriptPath = path.resolve(moduleDir, '../../../workers/collectors/importers', scriptMap[format]);

  if (!existsSync(absolutePath)) {
    return {
      format,
      fileName: path.basename(absolutePath),
      rows: [],
      summary: { totalRows: 0, validRows: 0, invalidRows: 0 },
      preview: '[]',
      metadata: {}
    };
  }

  const result = spawnSync('python', [scriptPath, absolutePath, JSON.stringify(options)], { encoding: 'utf-8', maxBuffer: 80 * 1024 * 1024 });

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Import preview failed');
  }

  const parsed = JSON.parse(result.stdout || '{}');
  return parseImportPreview(parsed);
}

export async function createImportJobRecord(input: { fileName: string; originalFileName: string; importType: string; importCategory?: string; fileSize?: number; storagePath: string; uploadedBy?: string; mapping?: Record<string, unknown>; options?: Record<string, unknown> }) {
  const previewOptions = { ...(input.options ?? {}), importCategory: input.importCategory ?? 'people' };
  const preview = previewImport(input.storagePath, input.importType as 'csv' | 'xlsx' | 'sqlite', previewOptions);
  const fileBuffer = await fs.readFile(input.storagePath);
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');
  const jobId = `import-${checksum.slice(0, 12)}`;
  const jobPayload = {
    id: jobId,
    fileName: input.fileName,
    originalFileName: input.originalFileName,
    importType: input.importType,
    importCategory: input.importCategory ?? 'people',
    status: 'uploaded',
    storagePath: input.storagePath,
    fileSize: input.fileSize ?? fileBuffer.byteLength,
    uploadedBy: input.uploadedBy ?? 'curator',
    summary: JSON.stringify(preview.summary),
    metadata: JSON.stringify({ mapping: input.mapping ?? {}, options: previewOptions }),
    validationSummary: JSON.stringify(preview.summary),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preview: preview.preview
  };

  const db = await getPrismaClient();
  if (db) {
    const saved = await db.importJob.create({
      data: {
        id: jobPayload.id,
        fileName: jobPayload.fileName,
        originalFileName: jobPayload.originalFileName,
        importType: jobPayload.importType,
        importCategory: jobPayload.importCategory as string,
        status: jobPayload.status as string,
        storagePath: jobPayload.storagePath as string,
        fileSize: jobPayload.fileSize as number,
        uploadedBy: jobPayload.uploadedBy as string,
        summary: jobPayload.summary as string,
        metadata: jobPayload.metadata as string,
        validationSummary: jobPayload.validationSummary as string
      }
    });
    return { ...jobPayload, prisma: saved };
  }

  const existingIndex = getImportJobStore().findIndex((entry) => entry.id === jobPayload.id);
  if (existingIndex >= 0) {
    getImportJobStore().splice(existingIndex, 1);
  }
  getImportJobStore().push({ ...jobPayload, rows: [] });
  return jobPayload;
}

export async function updateImportJobMapping(jobId: string, mapping: Record<string, unknown>) {
  const db = await getPrismaClient();
  if (db) {
    const current = await db.importJob.findUnique({ where: { id: jobId } });
    const currentMeta = current?.metadata ? JSON.parse(current.metadata) : {};
    return db.importJob.update({ where: { id: jobId }, data: { mapping: JSON.stringify(mapping), metadata: JSON.stringify({ ...currentMeta, mapping }) } });
  }

  const job = getImportJobStore().find((entry) => entry.id === jobId);
  if (!job) {
    throw new Error('Import job not found');
  }
  job.mapping = JSON.stringify(mapping);
  return job;
}

export async function setImportJobStatus(jobId: string, status: string, summary?: string) {
  const db = await getPrismaClient();
  if (db) {
    return db.importJob.update({ where: { id: jobId }, data: { status, summary: summary ?? undefined } });
  }

  const job = getImportJobStore().find((entry) => entry.id === jobId);
  if (!job) {
    throw new Error('Import job not found');
  }
  job.status = status;
  if (summary) {
    job.summary = summary;
  }
  return job;
}

function hasAnyValue(raw: Record<string, unknown>, fields: string[]) {
  return fields.some((field) => String(raw[field] ?? '').trim().length > 0);
}

function normalizeValidation(row: Record<string, unknown>, importCategory?: string) {
  const raw = (row.raw as Record<string, unknown>) ?? row;
  const validation = (row.validation as Record<string, unknown>) ?? {};
  const requiredByCategory: Record<string, string[]> = {
    people: ['full_name', 'name'],
    persons: ['full_name', 'name'],
    organizations: ['name', 'organization_name'],
    sources: ['source_name', 'url', 'name'],
    official_observations: ['observation_id', 'person_id'],
    person_affiliations: ['affiliation_id', 'person_id', 'organization_id'],
    research_queue: ['task_id', 'person_id', 'person_name'],
    research_tasks: ['task_id', 'task_type'],
    lineage_claims: ['claim_id', 'student_person_id', 'student_name'],
    claim_evidence: ['claim_id', 'url'],
    external_source_profiles: ['source_profile_url', 'external_name'],
    external_fact_candidates: ['candidate_type', 'subject_name', 'source_url'],
    evidence: ['url', 'source_url']
  };
  const required = requiredByCategory[String(importCategory ?? '')];
  if (required) {
    const categoryValid = hasAnyValue(raw, required);
    return {
      valid: categoryValid,
      errors: categoryValid ? [] : [`Missing category identifier: ${required.join(' or ')}`],
      warnings: (validation.warnings as Array<string>) ?? []
    };
  }
  return {
    valid: validation.valid !== false,
    errors: (validation.errors as Array<string>) ?? [],
    warnings: (validation.warnings as Array<string>) ?? []
  };
}

function getEntityTypeFromImportCategory(importCategory?: string) {
  if (importCategory === 'organizations') {
    return 'organization';
  }
  if (importCategory === 'external_source_profiles') {
    return 'external_source_profile';
  }
  if (importCategory === 'sources' || importCategory === 'evidence') {
    return 'source';
  }
  if (importCategory === 'official_observations') {
    return 'official_observation';
  }
  if (importCategory === 'person_affiliations') {
    return 'affiliation';
  }
  if (importCategory === 'research_queue' || importCategory === 'research_tasks') {
    return 'review_task';
  }
  if (importCategory === 'claim_evidence') {
    return 'evidence';
  }
  if (importCategory === 'external_fact_candidates') {
    return 'external_fact_candidate';
  }
  if (importCategory === 'claims' || importCategory === 'lineage_claims') {
    return 'lineage_claim';
  }
  return 'person';
}

function getPreviewOptionsFromJob(job: Record<string, unknown>) {
  const metadata = parseJsonObject(job.metadata);
  return parseJsonObject(metadata.options);
}

function rawValue(row: Record<string, unknown>, key: string, fallback = '') {
  const raw = (row.raw as Record<string, unknown>) ?? {};
  return String(raw[key] ?? fallback);
}

function optionalRawValue(row: Record<string, unknown>, key: string) {
  const raw = (row.raw as Record<string, unknown>) ?? {};
  const value = raw[key];
  return value === undefined || value === null || String(value).trim() === '' ? null : String(value);
}

function normalizedPersonName(row: Record<string, unknown>) {
  return String((row.normalized_person as Record<string, unknown>)?.full_name ?? rawValue(row, 'full_name') ?? rawValue(row, 'person_name') ?? '');
}

async function findOrCreateImportedPerson(db: any, input: { id?: string | null; name: string; country?: string; city?: string; nickname?: string }) {
  const nicknames = input.nickname ? [input.nickname] : [];
  if (input.id) {
    return db.person.upsert({
      where: { id: input.id },
      update: {
        fullName: input.name,
        country: input.country || undefined,
        city: input.city || undefined,
        nicknames
      },
      create: {
        id: input.id,
        fullName: input.name,
        country: input.country || undefined,
        city: input.city || undefined,
        nicknames
      }
    });
  }
  const existing = await db.person.findFirst({ where: { fullName: { equals: input.name, mode: 'insensitive' } } });
  if (existing) return existing;
  return db.person.create({ data: { fullName: input.name, country: input.country || undefined, city: input.city || undefined, nicknames } });
}

function duplicateThreshold(importCategory: string) {
  return importCategory === 'organizations' ? 0.8 : 0.7;
}

function prepareDuplicateCandidates(candidates: Array<Record<string, unknown>>, importCategory: string) {
  const threshold = duplicateThreshold(importCategory);
  return candidates
    .filter((candidate) => Number(candidate.confidence ?? 0) >= threshold)
    .sort((left, right) => Number(right.confidence ?? 0) - Number(left.confidence ?? 0))
    .slice(0, 3);
}

function suggestedSearches(personName: string, teamName?: string) {
  const searches = [
    `"${personName}" "black belt under"`,
    `"${personName}" "received black belt from"`,
    `"${personName}" "faixa preta por"`,
    `"${personName}" "graduated by"`
  ];
  if (teamName) {
    searches.push(`"${personName}" "${teamName}" black belt`);
  }
  return searches;
}

export async function executeImportJob(jobId: string, input: { importCategory?: string; mapping?: Record<string, unknown> }) {
  const db = await getPrismaClient();
  const job = db ? await db.importJob.findUnique({ where: { id: jobId } }) : getImportJobStore().find((entry) => entry.id === jobId);
  if (!job) {
    throw new Error('Import job not found');
  }

  const preview = previewImport(job.storagePath as string, (job.importType as string) as 'csv' | 'xlsx' | 'sqlite', getPreviewOptionsFromJob(job as Record<string, unknown>));
  const rows = preview.rows as Array<Record<string, unknown>>;
  const createdRows: Array<Record<string, unknown>> = [];
  const reviewQueueEntries: Array<Record<string, unknown>> = [];
  const createdEntities: Array<{ entityType: string; entityId: string }> = [];
  const importCategory = input.importCategory ?? job.importCategory ?? 'people';

  for (const [index, row] of rows.entries()) {
    const validation = normalizeValidation(row, String(importCategory));
    const duplicateCandidates = prepareDuplicateCandidates((row.duplicate_candidates as Array<Record<string, unknown>> | undefined) ?? [], String(importCategory));
    const baseStatus = validation.valid === false || duplicateCandidates.length || importCategory === 'research_queue' || importCategory === 'research_tasks' || importCategory === 'lineage_claims' || importCategory === 'claim_evidence' || importCategory === 'external_source_profiles' || importCategory === 'external_fact_candidates' ? 'review_required' : 'imported';
    const rowPayload = {
      importJobId: job.id,
      originalFileName: job.originalFileName,
      originalRowNumber: Number((row.row_number as number | undefined) ?? index + 2),
      rawPayload: JSON.stringify(row.raw ?? row),
      validationResult: JSON.stringify(validation),
      entityType: importCategory,
      status: baseStatus
    } as Record<string, unknown>;

    let createdEntityId: string | null = null;
    if (db) {
      if (importCategory === 'organizations' || importCategory === 'organizations_sample') {
        const organizationId = optionalRawValue(row, 'organization_id');
        const organization = await db.organization.upsert({
          where: { id: organizationId ?? `org-${job.id}-${rowPayload.originalRowNumber}` },
          update: {
            name: String((row.normalized_organization as Record<string, unknown>)?.name ?? rawValue(row, 'name')),
            type: String((row.normalized_organization as Record<string, unknown>)?.type ?? rawValue(row, 'organization_type', 'organization'))
          },
          create: {
            id: organizationId ?? undefined,
            name: String((row.normalized_organization as Record<string, unknown>)?.name ?? rawValue(row, 'name')),
            type: String((row.normalized_organization as Record<string, unknown>)?.type ?? rawValue(row, 'organization_type', 'organization'))
          }
        });
        createdEntityId = organization.id;
        createdEntities.push({ entityType: 'organization', entityId: organization.id });
      } else if (importCategory === 'claims' || importCategory === 'lineage_claims') {
        const normalizedClaim = (row.normalized_claim as Record<string, unknown>) ?? {};
        const studentName = String(normalizedClaim.student_name ?? rawValue(row, 'student_name', 'Imported student'));
        const teacherName = String(normalizedClaim.teacher_name ?? rawValue(row, 'teacher_name', ''));
        const student = await findOrCreateImportedPerson(db, { id: optionalRawValue(row, 'student_person_id'), name: studentName });
        const teacher = teacherName ? await findOrCreateImportedPerson(db, { id: optionalRawValue(row, 'promoter_person_id'), name: teacherName }) : null;
        const claim = await db.lineageClaim.upsert({
          where: { id: optionalRawValue(row, 'claim_id') ?? `claim-${job.id}-${rowPayload.originalRowNumber}` },
          update: {
            studentPersonId: student.id,
            teacherPersonId: teacher?.id,
            claimType: String(normalizedClaim.claim_type ?? rawValue(row, 'claim_type', 'black_belt_awarded_by')),
            relationshipLabel: String(normalizedClaim.relationship_label ?? rawValue(row, 'relationship_label', 'Imported claim')),
            status: rawValue(row, 'status', 'pending_review'),
            evidenceLevel: rawValue(row, 'evidence_level', 'imported'),
            confidenceScore: 0.5,
            notes: String(normalizedClaim.notes ?? rawValue(row, 'notes'))
          },
          create: {
            id: optionalRawValue(row, 'claim_id') ?? undefined,
            studentPersonId: student.id,
            teacherPersonId: teacher?.id,
            claimType: String(normalizedClaim.claim_type ?? rawValue(row, 'claim_type', 'black_belt_awarded_by')),
            relationshipLabel: String(normalizedClaim.relationship_label ?? rawValue(row, 'relationship_label', 'Imported claim')),
            status: rawValue(row, 'status', 'pending_review'),
            evidenceLevel: rawValue(row, 'evidence_level', 'imported'),
            confidenceScore: 0.5,
            notes: String(normalizedClaim.notes ?? rawValue(row, 'notes'))
          }
        });
        createdEntityId = claim.id;
        createdEntities.push({ entityType: 'lineage_claim', entityId: claim.id });
      } else if (importCategory === 'claim_evidence') {
        const claimId = optionalRawValue(row, 'claim_id');
        const claim = claimId ? await db.lineageClaim.findUnique({ where: { id: claimId } }) : null;
        if (claim) {
          const evidence = await db.claimEvidence.upsert({
            where: { id: optionalRawValue(row, 'evidence_id') ?? `evidence-${job.id}-${rowPayload.originalRowNumber}` },
            update: {
              lineageClaimId: claim.id,
              url: rawValue(row, 'url', rawValue(row, 'source_url')),
              sourceType: rawValue(row, 'source_type', 'imported'),
              captureDate: optionalRawValue(row, 'capture_date') ? new Date(String(optionalRawValue(row, 'capture_date'))) : undefined,
              author: optionalRawValue(row, 'author') ?? undefined,
              curatorNotes: optionalRawValue(row, 'curator_notes') ?? undefined
            },
            create: {
              id: optionalRawValue(row, 'evidence_id') ?? undefined,
              lineageClaimId: claim.id,
              url: rawValue(row, 'url', rawValue(row, 'source_url')),
              sourceType: rawValue(row, 'source_type', 'imported'),
              captureDate: optionalRawValue(row, 'capture_date') ? new Date(String(optionalRawValue(row, 'capture_date'))) : undefined,
              author: optionalRawValue(row, 'author') ?? undefined,
              curatorNotes: optionalRawValue(row, 'curator_notes') ?? undefined
            }
          });
          createdEntityId = evidence.id;
          createdEntities.push({ entityType: 'evidence', entityId: evidence.id });
        }
      } else if (importCategory === 'external_source_profiles') {
        const raw = (row.raw as Record<string, unknown>) ?? {};
        const profileId = optionalRawValue(row, 'id') ?? `external-profile-${job.id}-${rowPayload.originalRowNumber}`;
        const sourceUrl = rawValue(row, 'source_profile_url');
        const profile = await db.externalSourceProfile.upsert({
          where: { sourceProfileUrl: sourceUrl },
          update: {
            sourceName: rawValue(row, 'source_name', 'BJJ Heroes'),
            externalName: rawValue(row, 'external_name'),
            nickname: optionalRawValue(row, 'nickname') ?? undefined,
            listedTeamText: optionalRawValue(row, 'listed_team_text') ?? undefined,
            capturedAt: parseDateOrNow(raw.captured_at),
            sourceStatus: rawValue(row, 'source_status', 'active'),
            rawHash: rawValue(row, 'raw_hash', createHash('sha256').update(sourceUrl).digest('hex'))
          },
          create: {
            id: profileId,
            sourceName: rawValue(row, 'source_name', 'BJJ Heroes'),
            sourceProfileUrl: sourceUrl,
            externalName: rawValue(row, 'external_name'),
            nickname: optionalRawValue(row, 'nickname') ?? undefined,
            listedTeamText: optionalRawValue(row, 'listed_team_text') ?? undefined,
            capturedAt: parseDateOrNow(raw.captured_at),
            sourceStatus: rawValue(row, 'source_status', 'active'),
            rawHash: rawValue(row, 'raw_hash', createHash('sha256').update(sourceUrl).digest('hex'))
          }
        });
        createdEntityId = profile.id;
        createdEntities.push({ entityType: 'external_source_profile', entityId: profile.id });
      } else if (importCategory === 'sources' || importCategory === 'evidence') {
        const sourceId = optionalRawValue(row, 'source_id');
        const source = await db.source.upsert({
          where: { id: sourceId ?? `source-${job.id}-${rowPayload.originalRowNumber}` },
          update: {
            name: rawValue(row, 'source_name', rawValue(row, 'name', rawValue(row, 'url', 'Imported source'))),
            url: rawValue(row, 'url', rawValue(row, 'source_url', rawValue(row, 'source_profile_url'))),
            sourceType: rawValue(row, 'source_type', 'imported')
          },
          create: {
            id: sourceId ?? undefined,
            name: rawValue(row, 'source_name', rawValue(row, 'name', rawValue(row, 'url', 'Imported source'))),
            url: rawValue(row, 'url', rawValue(row, 'source_url', rawValue(row, 'source_profile_url'))),
            sourceType: rawValue(row, 'source_type', 'imported')
          }
        });
        createdEntityId = source.id;
        createdEntities.push({ entityType: 'source', entityId: source.id });
      } else if (importCategory === 'external_fact_candidates') {
        const raw = (row.raw as Record<string, unknown>) ?? {};
        const candidateId = optionalRawValue(row, 'id') ?? `external-fact-${job.id}-${rowPayload.originalRowNumber}`;
        const externalProfileId = rawValue(row, 'external_profile_id');
        const sourceUrl = rawValue(row, 'source_url');
        const existingProfile = await db.externalSourceProfile.findUnique({ where: { id: externalProfileId } });
        const profile = existingProfile ?? await db.externalSourceProfile.upsert({
          where: { sourceProfileUrl: sourceUrl },
          update: {},
          create: {
            id: externalProfileId || `external-profile-${job.id}-${rowPayload.originalRowNumber}`,
            sourceName: 'BJJ Heroes',
            sourceProfileUrl: sourceUrl,
            externalName: rawValue(row, 'subject_name', 'Unknown external profile'),
            capturedAt: parseDateOrNow(raw.imported_at),
            sourceStatus: 'pending_review',
            rawHash: createHash('sha256').update(sourceUrl).digest('hex')
          }
        });
        const fact = await db.externalFactCandidate.upsert({
          where: { id: candidateId },
          update: {
            externalProfileId: profile.id,
            candidateType: rawValue(row, 'candidate_type'),
            subjectName: rawValue(row, 'subject_name'),
            objectName: optionalRawValue(row, 'object_name') ?? undefined,
            structuredValue: rawValue(row, 'structured_value', '{}'),
            sourceUrl,
            sourceLocator: rawValue(row, 'source_locator', 'profile metadata'),
            evidenceLevel: rawValue(row, 'evidence_level', 'specialized_source'),
            status: rawValue(row, 'status', 'pending_review'),
            confidenceScore: Number(raw.confidence_score ?? 0.5),
            importedAt: parseDateOrNow(raw.imported_at)
          },
          create: {
            id: candidateId,
            externalProfileId: profile.id,
            candidateType: rawValue(row, 'candidate_type'),
            subjectName: rawValue(row, 'subject_name'),
            objectName: optionalRawValue(row, 'object_name') ?? undefined,
            structuredValue: rawValue(row, 'structured_value', '{}'),
            sourceUrl,
            sourceLocator: rawValue(row, 'source_locator', 'profile metadata'),
            evidenceLevel: rawValue(row, 'evidence_level', 'specialized_source'),
            status: rawValue(row, 'status', 'pending_review'),
            confidenceScore: Number(raw.confidence_score ?? 0.5),
            importedAt: parseDateOrNow(raw.imported_at)
          }
        });
        createdEntityId = fact.id;
        createdEntities.push({ entityType: 'external_fact_candidate', entityId: fact.id });
      } else if (importCategory === 'official_observations') {
        const observation = await db.officialObservation.create({ data: { title: rawValue(row, 'observation_id', 'Imported official observation'), description: JSON.stringify((row.raw as Record<string, unknown>) ?? row) } });
        createdEntityId = observation.id;
        createdEntities.push({ entityType: 'official_observation', entityId: observation.id });
      } else if (importCategory === 'research_queue' || importCategory === 'research_tasks') {
        createdEntityId = optionalRawValue(row, 'task_id');
        createdEntities.push({ entityType: 'review_task', entityId: createdEntityId ?? String(rowPayload.originalRowNumber) });
      } else if (importCategory === 'person_affiliations') {
        const personId = optionalRawValue(row, 'person_id');
        const organizationId = optionalRawValue(row, 'organization_id');
        if (personId && organizationId) {
          const [person, organization] = await Promise.all([
            db.person.findUnique({ where: { id: personId } }),
            db.organization.findUnique({ where: { id: organizationId } })
          ]);
          if (person && organization) {
            const affiliation = await db.personAffiliation.upsert({
              where: { id: optionalRawValue(row, 'affiliation_id') ?? `affiliation-${job.id}-${rowPayload.originalRowNumber}` },
              update: {
                personId,
                organizationId,
                affiliationType: rawValue(row, 'relation_type', 'reported affiliation')
              },
              create: {
                id: optionalRawValue(row, 'affiliation_id') ?? undefined,
                personId,
                organizationId,
                affiliationType: rawValue(row, 'relation_type', 'reported affiliation')
              }
            });
            createdEntityId = affiliation.id;
            createdEntities.push({ entityType: 'affiliation', entityId: affiliation.id });
          }
        }
      } else {
        const person = await findOrCreateImportedPerson(db, {
          id: optionalRawValue(row, 'person_id'),
          name: normalizedPersonName(row),
          country: optionalRawValue(row, 'country') ?? undefined,
          city: optionalRawValue(row, 'city') ?? undefined,
          nickname: optionalRawValue(row, 'nickname') ?? undefined
        });
        createdEntityId = person.id;
        createdEntities.push({ entityType: 'person', entityId: person.id });
      }

      const savedRow = await db.importRow.create({ data: { importJobId: rowPayload.importJobId as string, originalFileName: rowPayload.originalFileName as string, originalRowNumber: rowPayload.originalRowNumber as number, rawPayload: rowPayload.rawPayload as string, validationResult: rowPayload.validationResult as string, entityType: rowPayload.entityType as string, status: rowPayload.status as string, createdEntityId: createdEntityId ?? undefined, personId: createdEntityId && (importCategory === 'people' || importCategory === 'persons' || importCategory === 'people_sample') ? createdEntityId : undefined } });
      createdRows.push({ id: savedRow.id, ...rowPayload, createdEntityId });
      if (validation.valid === false || duplicateCandidates.length || importCategory === 'research_queue' || importCategory === 'research_tasks' || importCategory === 'lineage_claims' || importCategory === 'claim_evidence' || importCategory === 'external_source_profiles' || importCategory === 'external_fact_candidates' || (validation.errors as Array<string> | undefined)?.length || (validation.warnings as Array<string> | undefined)?.length) {
        const reviewQueue = await db.reviewQueue.create({ data: { entityType: 'import_row', entityId: savedRow.id, status: 'pending_review' } });
        reviewQueueEntries.push({ id: reviewQueue.id, entityType: 'import_row', entityId: savedRow.id, status: reviewQueue.status, createdAt: reviewQueue.createdAt });
      }

      if (duplicateCandidates.length) {
        for (const [candidateIndex, candidate] of duplicateCandidates.entries()) {
          const incomingName = normalizedPersonName(row) || 'Incoming record';
          const existingName = String(candidate.name ?? candidate.full_name ?? candidate.entityName ?? 'Possible existing record');
          const duplicate = await db.duplicateCandidate.create({
            data: {
              entityType: importCategory,
              entityName: incomingName,
              confidence: Number(candidate.confidence ?? 0.9),
              status: 'open',
              notes: JSON.stringify({
                importJobId: job.id,
                importRowId: savedRow.id,
                sourceRow: rowPayload.originalRowNumber,
                incomingRecord: importCategory === 'organizations' ? row.normalized_organization ?? row.raw ?? row : row.normalized_person ?? row.raw ?? row,
                existingRecord: candidate,
                matchingFields: candidate.matching_fields ?? candidate.matchingFields ?? ['name'],
                suggestedAction: 'review_required',
                candidateIndex
              })
            }
          });
          const auditEntry = { id: `audit-${duplicate.id}`, action: 'duplicate_candidate_created', entityType: 'duplicate_candidate', entityId: duplicate.id, createdAt: duplicate.createdAt, details: duplicate.notes };
          duplicateAudit.set(duplicate.id, [auditEntry]);
        }
      }
    } else {
      const fallbackEntityType = getEntityTypeFromImportCategory(String(importCategory));
      const fallbackEntityId = `${fallbackEntityType}-${job.id}-${rowPayload.originalRowNumber}`;
      const fallbackRowId = `row-${job.id}-${rowPayload.originalRowNumber}`;
      createdRows.push({ id: fallbackRowId, ...rowPayload, entityType: importCategory, createdEntityId: fallbackEntityId });
      createdEntities.push({ entityType: fallbackEntityType, entityId: fallbackEntityId });
      if (validation.valid === false || duplicateCandidates.length || importCategory === 'research_queue' || importCategory === 'research_tasks' || importCategory === 'lineage_claims' || importCategory === 'claim_evidence' || importCategory === 'external_source_profiles' || importCategory === 'external_fact_candidates' || (validation.errors as Array<string> | undefined)?.length) {
        reviewQueueEntries.push({ id: `review-${job.id}-${rowPayload.originalRowNumber}`, entityType: 'import_row', entityId: fallbackRowId, status: 'pending_review', createdAt: new Date().toISOString() });
      }
      if (duplicateCandidates.length) {
        const existing = duplicateCandidatesByImport.get(job.id) ?? [];
        duplicateCandidates.forEach((candidate, candidateIndex) => {
          const duplicateId = `duplicate-${job.id}-${rowPayload.originalRowNumber}-${candidateIndex + 1}`;
          const incomingRecord = importCategory === 'organizations' ? row.normalized_organization ?? row.raw ?? row : row.normalized_person ?? row.raw ?? row;
          const duplicate = {
            id: duplicateId,
            entityType: importCategory,
            entityName: String((incomingRecord as Record<string, unknown>).full_name ?? 'Incoming record'),
            confidence: Number(candidate.confidence ?? 0.9),
            status: 'open',
            notes: JSON.stringify({
              importJobId: job.id,
              sourceRow: rowPayload.originalRowNumber,
              incomingRecord,
              existingRecord: candidate,
              matchingFields: candidate.matching_fields ?? candidate.matchingFields ?? ['name'],
              suggestedAction: 'review_required',
              candidateIndex
            }),
            createdAt: new Date().toISOString()
          };
          existing.push(duplicate);
          duplicateAudit.set(duplicateId, [{ id: `audit-${duplicateId}`, action: 'duplicate_candidate_created', entityType: 'duplicate_candidate', entityId: duplicateId, createdAt: duplicate.createdAt, details: duplicate.notes }]);
        });
        duplicateCandidatesByImport.set(job.id, existing);
      }
    }
  }

  const persistedRows = createdRows.map((row) => ({ ...row, importJobId: job.id }));
  importRowsByJob.set(job.id, persistedRows);
  importRowsByJob.set(jobId, persistedRows);
  const jobStoreEntry = getImportJobStore().find((entry) => entry.id === job.id) as Record<string, unknown> | undefined;
  if (jobStoreEntry) {
    jobStoreEntry.rows = persistedRows;
  }
  reviewQueueByImport.set(job.id, reviewQueueEntries);
  const updatedJob = await setImportJobStatus(job.id, 'completed', JSON.stringify({ totalRows: persistedRows.length, reviewQueueEntries: reviewQueueEntries.length, createdEntities: createdEntities.length }));
  return { job: updatedJob, rows: persistedRows, reviewQueueEntries, createdEntities };
}

export async function listImportJobs() {
  const db = await getPrismaClient();
  if (db) {
    return db.importJob.findMany({ orderBy: { createdAt: 'desc' } });
  }
  return getImportJobStore();
}

export async function getImportJob(jobId: string) {
  const db = await getPrismaClient();
  if (db) {
    return db.importJob.findUnique({ where: { id: jobId } });
  }
  return getImportJobStore().find((entry) => entry.id === jobId);
}

export async function listImportRows(jobId: string) {
  const db = await getPrismaClient();
  if (db) {
    const rows = await db.importRow.findMany({ where: { importJobId: jobId }, orderBy: { originalRowNumber: 'asc' } });
    if (rows.length) {
      return rows;
    }
  }
  const cachedRows = importRowsByJob.get(jobId);
  if (cachedRows?.length) {
    return cachedRows;
  }
  const jobStoreEntry = getImportJobStore().find((entry) => entry.id === jobId) as Record<string, unknown> | undefined;
  if (Array.isArray(jobStoreEntry?.rows)) {
    return jobStoreEntry.rows as Array<Record<string, unknown>>;
  }
  return [];
}

export async function rollbackImportJob(jobId: string) {
  const db = await getPrismaClient();
  if (db) {
    const rows = await db.importRow.findMany({ where: { importJobId: jobId } });
    for (const row of rows) {
      if (row.createdEntityId) {
        if (row.entityType === 'organization') {
          await db.organization.delete({ where: { id: row.createdEntityId } }).catch(() => undefined);
        } else if (row.entityType === 'lineage_claim') {
          await db.lineageClaim.delete({ where: { id: row.createdEntityId } }).catch(() => undefined);
        } else if (row.entityType === 'source') {
          await db.source.delete({ where: { id: row.createdEntityId } }).catch(() => undefined);
        } else if (row.entityType === 'person') {
          await db.person.delete({ where: { id: row.createdEntityId } }).catch(() => undefined);
        }
      }
      await db.reviewQueue.deleteMany({ where: { entityId: row.id } }).catch(() => undefined);
    }
    await db.importRow.deleteMany({ where: { importJobId: jobId } });
    await db.importJob.update({ where: { id: jobId }, data: { status: 'rolled_back' } });
    return { id: jobId, status: 'rolled_back' };
  }
  const job = getImportJobStore().find((entry) => entry.id === jobId);
  if (!job) {
    throw new Error('Import job not found');
  }
  job.status = 'rolled_back';
  return { id: jobId, status: 'rolled_back' };
}

export async function getImportStatus(jobId: string) {
  const job = await getImportJob(jobId);
  return { id: job?.id, status: job?.status ?? 'unknown' };
}

export async function getImportReport(jobId: string) {
  const job = await getImportJob(jobId);
  const rows = await listImportRows(jobId);
  const reviewQueueCount = rows.filter((row: any) => row.status === 'review_required').length;
  const importedCount = rows.filter((row: any) => row.status === 'imported').length;
  const skippedCount = rows.filter((row: any) => row.status === 'skipped').length;
  const duplicateCount = (await listImportDuplicateCandidates(jobId)).length;
  const failedCount = rows.filter((row: any) => row.status === 'failed' || parseJsonObject(row.validationResult).valid === false).length;
  return { job, rowCount: rows.length, reviewQueueCount, importedCount, skippedCount, failedCount, duplicateCount };
}

export function findFallbackImportRowByCreatedEntityId(entityId: string) {
  return Array.from(importRowsByJob.values())
    .flat()
    .find((row: any) => row.createdEntityId === entityId);
}

export function listFallbackImportRowsByCategory(category: string) {
  return Array.from(importRowsByJob.values())
    .flat()
    .filter((row: any) => row.entityType === category);
}

export async function exportImportReportCsv(jobId: string) {
  const rows = await listImportRows(jobId);
  const header = ['row_number', 'entity_type', 'status', 'validation_result'];
  const body = rows.map((row: any) => [row.originalRowNumber, row.entityType, row.status, row.validationResult].join(','));
  return [header.join(','), ...body].join('\n');
}

export async function getImportOperationalDetail(jobId: string) {
  const job = await getImportJob(jobId);
  if (!job) {
    return null;
  }
  const rows = await listImportRows(jobId);
  const report = await getImportReport(jobId);
  const metadata = parseJsonObject((job as Record<string, unknown>).metadata);
  const options = parseJsonObject(metadata.options);
  const mapping = parseJsonObject((job as Record<string, unknown>).mapping, parseJsonObject(metadata.mapping));
  const validationSummary = parseJsonObject((job as Record<string, unknown>).validationSummary, parseJsonObject((job as Record<string, unknown>).summary));
  return {
    id: job.id,
    status: job.status,
    originalFileName: job.originalFileName,
    fileName: job.fileName,
    fileType: job.importType,
    importCategory: job.importCategory ?? 'people',
    uploadDate: formatDate(job.createdAt),
    importingUser: job.uploadedBy ?? 'curator',
    selectedCsvDelimiter: options.delimiter ?? ',',
    selectedXlsxWorksheet: options.worksheet ?? null,
    selectedSqliteTable: options.table ?? null,
    mappedColumns: mapping,
    validationSummary,
    totalRows: report.rowCount,
    importedRows: report.importedCount,
    skippedRows: report.skippedCount,
    failedRows: report.failedCount,
    duplicateCandidates: report.duplicateCount,
    reviewQueueItemsCreated: report.reviewQueueCount,
    rollbackStatus: job.status === 'rolled_back' ? 'rolled_back' : 'available',
    rawJob: job,
    rows
  };
}

export async function listImportDuplicateCandidates(jobId: string) {
  const db = await getPrismaClient();
  const fromNotes = (candidate: Record<string, unknown>) => {
    const notes = parseJsonObject(candidate.notes);
    return {
      id: candidate.id,
      incomingRecord: notes.incomingRecord ?? { name: candidate.entityName },
      possibleExistingRecord: notes.existingRecord ?? {},
      similarityConfidence: candidate.confidence,
      matchingFields: notes.matchingFields ?? [],
      importSourceRow: notes.sourceRow ?? null,
      suggestedAction: notes.suggestedAction ?? 'review_required',
      status: candidate.status,
      openComparisonUrl: `/admin/review/duplicates/${candidate.id}`
    };
  };

  if (db) {
    const candidates = await db.duplicateCandidate.findMany({ orderBy: { createdAt: 'desc' } });
    return (candidates as Array<Record<string, unknown>>)
      .filter((candidate: Record<string, unknown>) => parseJsonObject(candidate.notes).importJobId === jobId)
      .map((candidate: Record<string, unknown>) => fromNotes(candidate));
  }

  return (duplicateCandidatesByImport.get(jobId) ?? []).map(fromNotes);
}

export async function listDuplicateCandidates(filters: Record<string, unknown> = {}) {
  const db = await getPrismaClient();
  const toView = (candidate: Record<string, unknown>) => {
    const notes = parseJsonObject(candidate.notes);
    const incoming = parseJsonObject(notes.incomingRecord);
    return {
      id: candidate.id,
      entityType: candidate.entityType,
      importJobId: notes.importJobId,
      status: candidate.status,
      confidence: Number(candidate.confidence ?? 0),
      country: incoming.country ?? '',
      organizationType: incoming.organization_type ?? incoming.type ?? '',
      incomingRecord: notes.incomingRecord ?? { name: candidate.entityName },
      possibleExistingRecord: notes.existingRecord ?? {},
      importSourceRow: notes.sourceRow,
      openComparisonUrl: `/admin/review/duplicates/${candidate.id}`
    };
  };
  const candidates = db
    ? ((await db.duplicateCandidate.findMany({ orderBy: { createdAt: 'desc' } })) as Array<Record<string, unknown>>)
    : Array.from(duplicateCandidatesByImport.values()).flat();
  return candidates.map(toView).filter((candidate) => {
    if (filters.entityType && candidate.entityType !== filters.entityType) return false;
    if (filters.importJobId && candidate.importJobId !== filters.importJobId) return false;
    if (filters.status && candidate.status !== filters.status) return false;
    if (filters.country && normalizeComparable(candidate.country) !== normalizeComparable(filters.country)) return false;
    if (filters.organizationType && normalizeComparable(candidate.organizationType) !== normalizeComparable(filters.organizationType)) return false;
    if (filters.minConfidence && candidate.confidence < Number(filters.minConfidence)) return false;
    if (filters.maxConfidence && candidate.confidence > Number(filters.maxConfidence)) return false;
    return true;
  });
}

export async function bulkDecideDuplicates(input: { ids?: string[]; filters?: Record<string, unknown>; action: 'ignore_low_confidence' | 'keep_separate' | 'needs_manual_review'; notes?: string }) {
  const candidates = input.ids?.length
    ? (await listDuplicateCandidates({})).filter((candidate) => input.ids?.includes(String(candidate.id)))
    : await listDuplicateCandidates(input.filters ?? {});
  const statusByAction = {
    ignore_low_confidence: 'ignored',
    keep_separate: 'keep_separate',
    needs_manual_review: 'manual_review'
  };
  const allowed = candidates.filter((candidate) => input.action !== 'ignore_low_confidence' || candidate.confidence < 0.85);
  const db = await getPrismaClient();
  if (db) {
    for (const candidate of allowed) {
      await db.duplicateCandidate.update({ where: { id: candidate.id }, data: { status: statusByAction[input.action] } }).catch(() => undefined);
    }
  } else {
    for (const candidate of allowed) {
      for (const candidatesForImport of duplicateCandidatesByImport.values()) {
        const match = candidatesForImport.find((entry) => entry.id === candidate.id);
        if (match) {
          match.status = statusByAction[input.action];
        }
      }
    }
  }
  return { action: input.action, updated: allowed.length, skipped: candidates.length - allowed.length, bulkMergeAllowed: false };
}

export async function listImportReviewQueue(jobId: string) {
  const rows = await listImportRows(jobId);
  const db = await getPrismaClient();
  const rowById = new Map(rows.map((row: any) => [row.id, row]));
  const inferType = (row: any) => {
    const validation = parseJsonObject(row.validationResult);
    if (row.status === 'review_required' && row.entityType === 'people') return 'Potential duplicate';
    if ((validation.warnings as string[] | undefined)?.length) return 'Validation warning';
    if ((validation.errors as string[] | undefined)?.length) return 'Unresolved person reference';
    if (row.entityType === 'lineage_claims' || row.entityType === 'claims') return 'Claim pending review';
    if (row.entityType === 'organizations') return 'Ambiguous organization';
    if (row.entityType === 'evidence') return 'Evidence without claim';
    if (row.entityType === 'research_queue') return 'Claim pending review';
    if (row.entityType === 'official_observations') return 'Validation warning';
    return 'Validation warning';
  };
  const toReviewItem = (entry: Record<string, unknown>, row: any) => {
    const rawPayload = parseJsonObject(row.rawPayload);
    return {
      id: entry.id,
      type: inferType(row),
      priority: row.status === 'review_required' ? 'high' : 'normal',
      relatedEntity: row.createdEntityId ?? row.entityType ?? 'import row',
      sourceImportRow: row.originalRowNumber,
      createdDate: formatDate(entry.createdAt ?? row.importedAt),
      status: entry.status ?? row.status,
      rawPayload,
      openReviewUrl: row.entityType === 'lineage_claims' || row.entityType === 'claims' ? `/admin/review/claims/${row.createdEntityId ?? row.id}` : `/admin/imports/${jobId}?tab=Review%20Queue`,
      suggestedSearches: row.entityType === 'research_queue' ? suggestedSearches(String(rawPayload.person_name ?? ''), rawPayload.team_name as string | undefined) : undefined
    };
  };

  if (db) {
    const queue = await db.reviewQueue.findMany({ where: { entityId: { in: rows.map((row: any) => row.id).filter(Boolean) } }, orderBy: { createdAt: 'desc' } });
    return (queue as Array<Record<string, unknown>>).map((entry: Record<string, unknown>) => toReviewItem(entry, rowById.get(entry.entityId)));
  }

  return (reviewQueueByImport.get(jobId) ?? []).map((entry) => toReviewItem(entry, rowById.get(entry.entityId) ?? rows.find((row: any) => row.status === 'review_required') ?? {}));
}

export async function listImportImportedRecords(jobId: string) {
  const rows = await listImportRows(jobId);
  const groups = ['People', 'Organizations', 'Sources', 'External Source Profiles', 'External Fact Candidates', 'Lineage Claims', 'Evidence', 'Affiliations', 'Official Observations'].reduce((acc, key) => ({ ...acc, [key]: [] as Array<Record<string, unknown>> }), {} as Record<string, Array<Record<string, unknown>>>);
  const labelByType: Record<string, string> = {
    people: 'People',
    person: 'People',
    organizations: 'Organizations',
    organization: 'Organizations',
    source: 'Sources',
    sources: 'Sources',
    evidence: 'Evidence',
    claim_evidence: 'Evidence',
    external_source_profiles: 'External Source Profiles',
    external_fact_candidates: 'External Fact Candidates',
    official_observations: 'Official Observations',
    person_affiliations: 'Affiliations',
    research_queue: 'Lineage Claims',
    research_tasks: 'Lineage Claims',
    lineage_claim: 'Lineage Claims',
    lineage_claims: 'Lineage Claims',
    claims: 'Lineage Claims',
    affiliation: 'Affiliations',
    official_observation: 'Official Observations'
  };
  for (const row of rows as Array<Record<string, unknown>>) {
    if (!row.createdEntityId) continue;
    const group = labelByType[String(row.entityType)] ?? 'People';
    const raw = parseJsonObject(row.rawPayload);
    const isBjjHeroes = raw.source_name === 'BJJ Heroes' || raw.source === 'BJJ Heroes' || parseJsonObject(raw.source_attribution).source === 'BJJ Heroes';
    groups[group].push({
      id: row.createdEntityId,
      importRowId: row.id,
      sourceImportRow: row.originalRowNumber,
      status: group === 'Lineage Claims' || group.startsWith('External') ? 'pending review' : row.status,
      publicVisibility: group === 'Lineage Claims' || group === 'Evidence' || group.startsWith('External') ? 'not public' : 'admin only',
      evidenceCount: group === 'Lineage Claims' ? 0 : undefined,
      badges: group === 'People'
        ? ['Official competitive record', 'No lineage identified yet']
        : group === 'Affiliations'
          ? ['Reported team/academy affiliation', 'Not proof of black belt promotion']
          : group === 'Official Observations'
            ? ['Official registry/ranking observation']
            : [],
      sourceAttribution: isBjjHeroes ? {
        source: 'BJJ Heroes',
        sourceUrl: raw.source_profile_url ?? raw.source_url ?? raw.url,
        use: 'Specialized discovery source',
        editorialStatus: 'Requires review before lineage publication'
      } : undefined,
      adminUrl: group === 'Lineage Claims' ? `/admin/review/claims/${row.createdEntityId}` : `/admin/imports/${jobId}?tab=Imported%20Records`
    });
  }
  return groups;
}

export async function listImportAuditHistory(jobId: string) {
  const db = await getPrismaClient();
  const job = await getImportJob(jobId);
  const rows = await listImportRows(jobId);
  const base = [
    { id: `audit-${jobId}-created`, action: 'import_job_created', entityType: 'import_job', entityId: jobId, createdAt: formatDate((job as Record<string, unknown> | undefined)?.createdAt), details: `Uploaded ${(job as Record<string, unknown> | undefined)?.originalFileName ?? jobId}` },
    { id: `audit-${jobId}-status`, action: `status_${(job as Record<string, unknown> | undefined)?.status ?? 'unknown'}`, entityType: 'import_job', entityId: jobId, createdAt: formatDate((job as Record<string, unknown> | undefined)?.updatedAt), details: (job as Record<string, unknown> | undefined)?.summary ?? null }
  ];
  if (db) {
    const rowEntityIds = rows.map((row: any) => row.createdEntityId).filter(Boolean);
    const history = await db.changeHistory.findMany({ where: { entityId: { in: [jobId, ...rowEntityIds] } }, orderBy: { createdAt: 'desc' } });
    return [...base, ...(history as Array<Record<string, unknown>>).map((entry: Record<string, unknown>) => ({ ...entry, createdAt: formatDate(entry.createdAt) }))];
  }
  return base;
}

export function getImportPresets() {
  return {
    protectedPreset: {
      name: 'Historical Research Dataset',
      protected: true,
      defaults: {
        lineageClaims: 'pending_review',
        evidenceVisibility: 'not_public',
        duplicateCandidates: 'review_required',
        autoPublishClaims: false
      }
    },
    mappingPresets: [
      'People Dataset',
      'Organizations Dataset',
      'Sources Dataset',
      'Lineage Claims Dataset',
      'Evidence Dataset',
      'SQLite Research Database'
    ],
    historicalLineageResearchV06: {
      name: 'Historical Lineage Research v0.6',
      protected: true,
      tables: [
        'persons',
        'organizations',
        'sources',
        'lineage_claims',
        'claim_evidence',
        'person_affiliations',
        'research_tasks',
        'official_observations'
      ],
      defaults: {
        lineageClaims: 'pending_review',
        evidenceVisibility: 'internal_unapproved',
        ambiguousOrganizations: 'review_required',
        duplicatePeople: 'review_required',
        autoPublish: false
      }
    }
  };
}

export async function generateCensusResearchTasks() {
  const allRows = Array.from(importRowsByJob.values()).flat();
  const people = allRows.filter((row: any) => row.entityType === 'people');
  const observations = new Set(allRows.filter((row: any) => row.entityType === 'official_observations').map((row: any) => parseJsonObject(row.rawPayload).person_id));
  const claims = new Set(allRows.filter((row: any) => row.entityType === 'lineage_claims' || row.entityType === 'claims').map((row: any) => parseJsonObject(row.rawPayload).student_person_id));
  const affiliations = new Map(allRows.filter((row: any) => row.entityType === 'person_affiliations').map((row: any) => {
    const raw = parseJsonObject(row.rawPayload);
    return [raw.person_id, raw.organization_name_as_reported ?? raw.organization_id];
  }));

  for (const row of people as Array<Record<string, unknown>>) {
    const raw = parseJsonObject(row.rawPayload);
    const personId = String(raw.person_id ?? row.createdEntityId);
    if (!observations.has(personId) || claims.has(personId)) {
      continue;
    }
    const personName = String(raw.full_name ?? raw.person_name ?? '');
    generatedResearchTasks.set(personId, {
      id: `research-${personId}`,
      personId,
      personName,
      type: 'Find black belt promotion source',
      status: 'pending',
      suggestedSearches: suggestedSearches(personName, affiliations.get(personId) as string | undefined),
      evidenceUrls: []
    });
  }

  return { createdOrUpdated: generatedResearchTasks.size, tasks: Array.from(generatedResearchTasks.values()) };
}

export function getGeneratedResearchTasks() {
  return Array.from(generatedResearchTasks.values());
}

export async function createImportReadinessReport(input: { categories: Record<string, Array<Record<string, unknown>>> }) {
  const categories = input.categories ?? {};
  const people = categories.persons ?? categories.people ?? [];
  const organizations = categories.organizations ?? [];
  const claims = categories.lineage_claims ?? [];
  const evidence = categories.claim_evidence ?? categories.evidence ?? [];
  const sources = categories.sources ?? [];
  const peopleIds = new Set(people.map((person) => person.person_id ?? person.id).filter(Boolean));
  const evidenceClaimIds = new Set(evidence.map((item) => item.claim_id).filter(Boolean));
  const teacherByStudent = new Map<string, Set<string>>();

  for (const claim of claims) {
    const student = String(claim.student_person_id ?? claim.student_id ?? '');
    const teacher = String(claim.promoter_person_id ?? claim.teacher_person_id ?? claim.teacher_id ?? '');
    if (!teacherByStudent.has(student)) {
      teacherByStudent.set(student, new Set());
    }
    if (teacher) {
      teacherByStudent.get(student)?.add(teacher);
    }
  }

  const duplicateUrls = sources
    .map((source) => normalizeComparable(source.url))
    .filter((url, index, urls) => url && urls.indexOf(url) !== index);
  const missingStudent = claims.filter((claim) => !peopleIds.has(claim.student_person_id ?? claim.student_id));
  const missingTeacher = claims.filter((claim) => !peopleIds.has(claim.promoter_person_id ?? claim.teacher_person_id ?? claim.teacher_id));
  const withoutEvidence = claims.filter((claim) => !evidenceClaimIds.has(claim.claim_id ?? claim.id));
  const conflictingTeachers = Array.from(teacherByStudent.entries()).filter(([, teachers]) => teachers.size > 1);
  const possibleCoPromotionGroups = claims.filter((claim) => {
    const label = normalizeComparable(`${claim.relationship_type ?? claim.claim_type ?? ''} ${claim.politica_publicacao ?? ''} ${claim.notes ?? claim.observacao ?? ''}`);
    return label.includes('co graduacao') || label.includes('co promocao') || label.includes('co promotion') || label.includes('promoveram');
  });
  const teamMembershipOnly = claims.filter((claim) => {
    const label = normalizeComparable(`${claim.relationship_type ?? claim.claim_type ?? ''} ${claim.notes ?? claim.observacao ?? ''}`);
    return label.includes('equipe') && !label.includes('faixa preta') && !label.includes('black belt');
  });
  const possibleDuplicatePeople = people.length - new Set(people.map((person) => normalizeComparable(person.full_name ?? person.name))).size;
  const possibleDuplicateOrganizations = organizations.length - new Set(organizations.map((organization) => normalizeComparable(organization.name))).size;
  const blockedRows = missingStudent.length + missingTeacher.length + teamMembershipOnly.length;
  const rowsRequiringReview = missingStudent.length + missingTeacher.length + withoutEvidence.length + conflictingTeachers.length + possibleCoPromotionGroups.length + possibleDuplicatePeople + possibleDuplicateOrganizations + new Set(duplicateUrls).size;
  const totalRecordsByCategory = Object.fromEntries(Object.entries(categories).map(([category, rows]) => [category, rows.length]));
  const totalRows = Object.values(totalRecordsByCategory).reduce((sum, count) => sum + Number(count), 0);

  return {
    totalRecordsByCategory,
    possibleDuplicatePeople,
    possibleDuplicateOrganizations,
    claimsWithMissingStudent: missingStudent.length,
    claimsWithMissingTeacher: missingTeacher.length,
    claimsWithoutEvidence: withoutEvidence.length,
    claimsWithConflictingTeachers: conflictingTeachers.length,
    claimsWithPossibleCoPromotionStructure: possibleCoPromotionGroups.length,
    sourcesWithDuplicateUrls: new Set(duplicateUrls).size,
    rowsThatCanSafelyImport: Math.max(totalRows - rowsRequiringReview - blockedRows, 0),
    rowsRequiringReview,
    rowsBlockedFromImport: blockedRows
  };
}

export async function getDashboardMetrics() {
  const db = await getPrismaClient();
  if (db) {
    const [people, organizations, sources, claims, confirmedClaims, pendingClaims, openReviewTasks, openDuplicateCandidates, imports, latestImport, failedRows, unresolvedReferences] = await Promise.all([
      db.person.count(),
      db.organization.count(),
      db.source.count(),
      db.lineageClaim.count(),
      db.lineageClaim.count({ where: { status: 'confirmed' } }),
      db.lineageClaim.count({ where: { status: 'pending_review' } }),
      db.reviewQueue.count({ where: { status: { not: 'closed' } } }),
      db.duplicateCandidate.count({ where: { status: 'open' } }),
      db.importJob.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      db.importJob.findFirst({ orderBy: { createdAt: 'desc' } }),
      db.importRow.count({ where: { status: 'failed' } }),
      db.importRow.count({ where: { status: 'review_required' } })
    ]);
    return {
      totalPeople: people,
      totalOrganizations: organizations,
      totalSources: sources,
      totalLineageClaims: claims,
      confirmedClaims,
      pendingClaims,
      openReviewTasks,
      openDuplicateCandidates,
      recentImports: imports,
      importHealth: {
        latestImportStatus: latestImport?.status ?? 'none',
        rowsNeedingReview: unresolvedReferences,
        failedImportRows: failedRows,
        unresolvedReferences
      }
    };
  }

  const allRows = Array.from(importRowsByJob.values()).flat();
  const publicClaimCount = listPublicLineageGraph().length;
  const totalLineageClaims = allRows.filter((row: any) => row.entityType === 'lineage_claims' || row.entityType === 'claims').length;
  return {
    totalPeople: allRows.filter((row: any) => row.entityType === 'people').length,
    totalOrganizations: allRows.filter((row: any) => row.entityType === 'organizations').length,
    totalSources: allRows.filter((row: any) => row.entityType === 'source' || row.entityType === 'sources' || row.entityType === 'evidence').length,
    totalLineageClaims,
    confirmedClaims: publicClaimCount,
    pendingClaims: Math.max(totalLineageClaims - publicClaimCount, 0),
    openReviewTasks: Array.from(reviewQueueByImport.values()).flat().length,
    openDuplicateCandidates: Array.from(duplicateCandidatesByImport.values()).flat().filter((entry: any) => entry.status === 'open').length,
    recentImports: getImportJobStore().slice(-5).reverse(),
    importHealth: {
      latestImportStatus: (getImportJobStore().at(-1)?.status as string | undefined) ?? 'none',
      rowsNeedingReview: allRows.filter((row: any) => row.status === 'review_required').length,
      failedImportRows: allRows.filter((row: any) => row.status === 'failed').length,
      unresolvedReferences: allRows.filter((row: any) => row.status === 'review_required').length
    }
  };
}

export async function getDuplicateReview(candidateId: string) {
  const db = await getPrismaClient();
  const candidate = db ? await db.duplicateCandidate.findUnique({ where: { id: candidateId } }) : Array.from(duplicateCandidatesByImport.values()).flat().find((entry) => entry.id === candidateId);
  if (!candidate) {
    return null;
  }
  const notes = parseJsonObject((candidate as Record<string, unknown>).notes);
  return {
    id: candidateId,
    status: (candidate as Record<string, unknown>).status,
    confidence: (candidate as Record<string, unknown>).confidence,
    incomingPerson: notes.incomingRecord ?? { name: (candidate as Record<string, unknown>).entityName },
    existingPerson: notes.existingRecord ?? {},
    importRow: notes.sourceRow ?? null,
    matchingFields: notes.matchingFields ?? [],
    auditHistory: duplicateAudit.get(candidateId) ?? [{ id: `audit-${candidateId}`, action: 'loaded_for_review', createdAt: new Date().toISOString(), details: (candidate as Record<string, unknown>).notes }]
  };
}

export async function decideDuplicate(candidateId: string, action: 'merge' | 'keep_separate' | 'uncertain', notes?: string) {
  const db = await getPrismaClient();
  const status = action === 'merge' ? 'merged' : action;
  const auditEntry = { id: `audit-${candidateId}-${Date.now()}`, action, entityType: 'duplicate_candidate', entityId: candidateId, changedBy: 'reviewer', createdAt: new Date().toISOString(), details: notes ?? null };
  if (db) {
    const candidate = await db.duplicateCandidate.update({ where: { id: candidateId }, data: { status, notes: notes ? JSON.stringify({ ...parseJsonObject((await db.duplicateCandidate.findUnique({ where: { id: candidateId } }))?.notes), reviewerNote: notes }) : undefined } });
    await db.changeHistory.create({ data: { entityType: 'duplicate_candidate', entityId: candidateId, action, changedBy: 'reviewer', details: JSON.stringify({ notes, provenancePreserved: ['aliases', 'source information', 'ImportRows', 'ChangeHistory'] }) } }).catch(() => undefined);
    return { id: candidate.id, status: candidate.status, action, provenancePreserved: ['aliases', 'original source information', 'ImportRows', 'ChangeHistory'] };
  }
  for (const candidates of duplicateCandidatesByImport.values()) {
    const candidate = candidates.find((entry) => entry.id === candidateId);
    if (candidate) {
      candidate.status = status;
    }
  }
  duplicateAudit.set(candidateId, [...(duplicateAudit.get(candidateId) ?? []), auditEntry]);
  return { id: candidateId, status, action, provenancePreserved: ['aliases', 'original source information', 'ImportRows', 'ChangeHistory'] };
}
