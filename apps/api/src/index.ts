import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { ZodError } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  approveRelationship,
  canonicalizeOrganizationDuplicate,
  createOrganization,
  createPromotionGroup,
  createPerson,
  createRelationship,
  createSource,
  getPublicPersonProfile,
  listOrganizationRelationships,
  listOrganizations,
  listPromotionGroups,
  listPublicLineageGraph,
  listPeople,
  listRelationships,
  listSources
} from './domain.js';
import {
  bulkDecideDuplicates,
  createImportReadinessReport,
  createImportJobRecord,
  decideDuplicate,
  executeImportJob,
  generateCensusResearchTasks,
  getDashboardMetrics,
  getDuplicateReview,
  getGeneratedResearchTasks,
  getImportOperationalDetail,
  getImportJob,
  getImportPresets,
  getImportReport,
  getImportStatus,
  listImportAuditHistory,
  listImportDuplicateCandidates,
  listImportImportedRecords,
  listImportJobs,
  listImportReviewQueue,
  listDuplicateCandidates,
  listImportRows,
  previewImport,
  rollbackImportJob,
  setImportJobStatus,
  updateImportJobMapping
} from './importService.js';
import { decideClaimReview, getClaimReview, listClaimReviews, reclassifyClaimReview } from './reviewService.js';
import { readCommunityCertificate, storeUploadFile } from './storage.js';
import {
  getBjjHeroesStatus,
  importManualBjjHeroesProfile,
  pauseBjjHeroesConnector,
  resumeBjjHeroesConnector,
  runBjjHeroesDryRun
} from './bjjHeroesService.js';
import {
  createLineageSubmission,
  decideLineageSubmission,
  getLineageSubmission,
  getLineageSubmissionStatus,
  listLineageSubmissions
} from './communitySubmissionService.js';
import { publicTreeMembershipWhere } from './publicLineage.js';
import { AdminAuthError, verifySupabaseAdminToken } from './supabaseAuth.js';

dotenv.config({ path: '../../.env' });

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 9 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) callback(null, true);
    else callback(new Error('Formato de certificado não permitido.'));
  }
});
let prisma: any = null;
const submissionAttempts = new Map<string, number[]>();
const publicReadAttempts = new Map<string, number[]>();

function isBjjHeroesUrl(value?: string | null) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'bjjheroes.com' || hostname.endsWith('.bjjheroes.com');
  } catch {
    return false;
  }
}

async function getDb() {
  if (process.env.VITEST) return null;
  if (prisma) return prisma;
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

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const allowedOrigins = new Set(
  [
    'https://bigtreebjj.com',
    'https://www.bigtreebjj.com',
    process.env.SITE_ORIGIN,
    ...(process.env.CORS_ALLOWED_ORIGINS ?? '').split(',')
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))
);

app.set('trust proxy', 'loopback');
app.use(
  cors({
    origin(origin, callback) {
      const localDevelopmentOrigin = Boolean(
        origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
      );
      callback(null, !origin || allowedOrigins.has(origin) || localDevelopmentOrigin);
    }
  })
);
app.use(helmet());
app.use(express.json({ limit: '25mb' }));

function publicReadLimit(bucket: string, limit: number, windowMs: number): express.RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${bucket}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const recent = (publicReadAttempts.get(key) ?? []).filter(
      (attempt) => attempt > now - windowMs
    );
    const remaining = Math.max(0, limit - recent.length - 1);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(windowMs / 1000)));
    if (recent.length >= limit) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ error: 'Muitas consultas em sequência. Tente novamente mais tarde.' });
      return;
    }
    recent.push(now);
    publicReadAttempts.set(key, recent);
    if (publicReadAttempts.size > 10_000) {
      for (const [candidateKey, attempts] of publicReadAttempts) {
        if (!attempts.some((attempt) => attempt > now - windowMs)) {
          publicReadAttempts.delete(candidateKey);
        }
      }
    }
    next();
  };
}

const protectPublicData: express.RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, noarchive, nosnippet');
  res.setHeader('X-The-Big-Tree-BJJ-Use', 'No automated bulk extraction');
  next();
};

const requireAdmin: express.RequestHandler = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    res.locals.adminUser = await verifySupabaseAdminToken(token);
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  } catch (error) {
    const statusCode = error instanceof AdminAuthError ? error.statusCode : 403;
    res.status(statusCode).json({ error: (error as Error).message });
  }
};

const receiveCertificate: express.RequestHandler = (req, res, next) => {
  certificateUpload.any()(req, res, (error) => {
    if (!error) return next();
    const message =
      error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'O certificado deve ter no máximo 10 MB.'
        : (error as Error).message;
    return res.status(400).json({ error: message });
  });
};

function privateSubmissionView(submission: any) {
  const { certificateStoragePath, certificates = [], ...visible } = submission;
  const privateCertificates = certificates.map(({ storagePath, ...certificate }: any) => certificate);
  return {
    ...visible,
    certificates: privateCertificates,
    hasCertificate: Boolean(certificateStoragePath || privateCertificates.length),
    certificateCount: privateCertificates.length || (certificateStoragePath ? 1 : 0)
  };
}

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'The Big Tree BJJ API',
      version: '0.1.0',
      description: 'Local-first lineage database API'
    },
    paths: {
      '/imports/{id}/duplicates': { get: { summary: 'List duplicate candidates for an import job', responses: { 200: { description: 'Duplicate candidates' } } } },
      '/imports/{id}/review-queue': { get: { summary: 'List review queue items for an import job', responses: { 200: { description: 'Review queue items' } } } },
      '/imports/{id}/imported-records': { get: { summary: 'List records created by an import job', responses: { 200: { description: 'Imported records grouped by type' } } } },
      '/imports/{id}/audit-history': { get: { summary: 'List import audit history', responses: { 200: { description: 'Audit history' } } } },
      '/review/duplicates/{id}': { get: { summary: 'Get duplicate comparison details', responses: { 200: { description: 'Duplicate comparison' } } } },
      '/review/duplicates/{id}/merge': { post: { summary: 'Merge duplicate after reviewer confirmation', responses: { 200: { description: 'Merge decision' } } } },
      '/review/duplicates/{id}/keep-separate': { post: { summary: 'Keep duplicate candidate separate', responses: { 200: { description: 'Keep separate decision' } } } },
      '/review/duplicates/{id}/uncertain': { post: { summary: 'Mark duplicate candidate uncertain', responses: { 200: { description: 'Uncertain decision' } } } },
      '/review/claims/{id}': { get: { summary: 'Get lineage claim review details', responses: { 200: { description: 'Claim review details' } } } },
      '/review/claims/{id}/approve': { post: { summary: 'Approve a lineage claim', responses: { 201: { description: 'Approval decision' } } } },
      '/review/claims/{id}/reject': { post: { summary: 'Reject a lineage claim', responses: { 201: { description: 'Rejection decision' } } } },
      '/review/claims/{id}/dispute': { post: { summary: 'Mark a lineage claim disputed', responses: { 201: { description: 'Dispute decision' } } } },
      '/review/claims/{id}/request-evidence': { post: { summary: 'Request more evidence for a lineage claim', responses: { 201: { description: 'Evidence request decision' } } } }
    }
  },
  apis: ['./src/**/*.ts']
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'api' });
});

app.get('/admin/metrics', requireAdmin, async (_req, res) => {
  const metrics = await getDashboardMetrics();
  res.json(metrics);
});

app.get('/admin/sources/bjjheroes', requireAdmin, (_req, res) => {
  res.json(getBjjHeroesStatus());
});

app.get('/admin/imports/bjjheroes', requireAdmin, (_req, res) => {
  res.json(getBjjHeroesStatus());
});

app.post('/admin/sources/bjjheroes/pause', requireAdmin, (req, res) => {
  res.json(pauseBjjHeroesConnector(req.body?.reason));
});

app.post('/admin/sources/bjjheroes/resume', requireAdmin, (_req, res) => {
  res.json(resumeBjjHeroesConnector());
});

app.post('/admin/sources/bjjheroes/dry-run', requireAdmin, (req, res) => {
  try {
    res.json(runBjjHeroesDryRun(req.body ?? {}));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/admin/imports/bjjheroes/manual-profile', requireAdmin, async (req, res) => {
  try {
    const result = await importManualBjjHeroesProfile(req.body ?? {});
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/admin/imports/curated/demian-maia', requireAdmin, async (_req, res) => {
  try {
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../..'
    );
    const batchRoot = path.join(
      projectRoot,
      'data',
      'imports',
      'demian_maia_black_belts_2026_07_27'
    );
    const definitions = [
      {
        fileName: 'lineage_claims.csv',
        importCategory: 'lineage_claims'
      },
      {
        fileName: 'claim_evidence.csv',
        importCategory: 'claim_evidence'
      }
    ] as const;
    const jobs = [];

    for (const definition of definitions) {
      const storagePath = path.join(batchRoot, definition.fileName);
      const preview = previewImport(storagePath, 'csv', {
        importCategory: definition.importCategory
      });
      if (preview.summary.totalRows === 0 || preview.summary.invalidRows > 0) {
        throw new Error(
          `${definition.fileName} não passou na validação editorial.`
        );
      }
      const job = await createImportJobRecord({
        fileName: definition.fileName,
        originalFileName: `demian-maia-${definition.fileName}`,
        importType: 'csv',
        importCategory: definition.importCategory,
        storagePath,
        uploadedBy: res.locals.adminUser.email,
        options: {
          preparedBatch: 'demian_maia_black_belts_2026_07_27',
          reviewFirst: true
        }
      });
      if (job.status !== 'completed') {
        await setImportJobStatus(String(job.id), 'validated', JSON.stringify(preview.summary));
        await executeImportJob(String(job.id), {
          importCategory: definition.importCategory
        });
      }
      jobs.push({
        id: job.id,
        fileName: definition.fileName,
        importCategory: definition.importCategory,
        alreadyImported: job.status === 'completed'
      });
    }

    return res.status(201).json({
      batch: 'demian_maia_black_belts_2026_07_27',
      claimsReadyForReview: 4,
      canonicalTeacherId: 'name:demian-maia',
      jobs
    });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/auth/login', (_req, res) => {
  res.status(410).json({
    error: 'O login administrativo agora é realizado diretamente pelo Supabase Auth.'
  });
});

app.get('/people', protectPublicData, async (_req, res) => {
  const db = await getDb();
  if (!db) {
    res.json(listPeople());
    return;
  }
  const people = await db.person.findMany({
    orderBy: { fullName: 'asc' },
    select: { id: true, fullName: true, nicknames: true, country: true, city: true }
  });
  res.json(people);
});

app.get(
  '/community/teachers',
  protectPublicData,
  publicReadLimit('teacher-search', 90, 10 * 60 * 1000),
  async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const query = String(req.query.q ?? '').trim().slice(0, 80);
  if (query.length < 2) return res.json([]);
  const teachers = await db.person.findMany({
    where: {
      fullName: { contains: query, mode: 'insensitive' },
      ...publicTreeMembershipWhere()
    },
    orderBy: { fullName: 'asc' },
    take: 12,
    select: { id: true, fullName: true, team: true, city: true, country: true }
  });
  return res.json(teachers);
  }
);

app.post('/community/lineage-submissions', receiveCertificate, async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const rateKey = req.ip || req.socket.remoteAddress || 'unknown';
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recentAttempts = (submissionAttempts.get(rateKey) ?? []).filter((attempt) => attempt > cutoff);
  if (recentAttempts.length >= 5) {
    return res.status(429).json({ error: 'Muitas solicitações recentes. Tente novamente mais tarde.' });
  }
  try {
    const rawInput =
      typeof req.body?.payload === 'string'
        ? JSON.parse(req.body.payload)
        : req.body;
    const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    const totalCertificateBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalCertificateBytes > 40 * 1024 * 1024) {
      return res.status(400).json({ error: 'O conjunto de certificados deve ter no máximo 40 MB.' });
    }
    const created = await createLineageSubmission(
      db,
      rawInput,
      files.map((file) => ({
        fieldName: file.fieldname,
        originalname: file.originalname,
        buffer: file.buffer,
        size: file.size,
        mimetype: file.mimetype
      }))
    );
    recentAttempts.push(Date.now());
    submissionAttempts.set(rateKey, recentAttempts);
    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Revise os campos destacados.',
        fields: error.flatten().fieldErrors
      });
    }
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/community/lineage-submissions/status/:protocol', async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const submission = await getLineageSubmissionStatus(db, req.params.protocol.toUpperCase());
  return submission ? res.json(submission) : res.status(404).json({ error: 'Protocolo não encontrado.' });
});

app.get('/external-profiles/slug/:slug', async (req, res) => {
  const db = await getDb();
  if (!db) {
    res.status(404).json({ error: 'External profile not found' });
    return;
  }
  const profiles = await db.externalSourceProfile.findMany({
    include: {
      factCandidates: {
        where: { status: 'pending_review' },
        orderBy: [{ candidateType: 'asc' }, { importedAt: 'asc' }]
      }
    }
  });
  const profile = profiles.find((entry: any) => slugify(entry.externalName) === req.params.slug);
  if (!profile) {
    res.status(404).json({ error: 'External profile not found' });
    return;
  }
  res.json({
    id: profile.id,
    sourceName: profile.sourceName,
    sourceProfileUrl: profile.sourceProfileUrl,
    externalName: profile.externalName,
    nickname: profile.nickname,
    listedTeamText: profile.listedTeamText,
    capturedAt: profile.capturedAt,
    sourceStatus: profile.sourceStatus,
    editorialStatus: 'Requires review before lineage publication',
    publicVisibility: 'not public lineage',
    factCandidates: profile.factCandidates.map((candidate: any) => ({
      id: candidate.id,
      candidateType: candidate.candidateType,
      subjectName: candidate.subjectName,
      objectName: candidate.objectName,
      structuredValue: candidate.structuredValue,
      sourceUrl: candidate.sourceUrl,
      sourceLocator: candidate.sourceLocator,
      evidenceLevel: candidate.evidenceLevel,
      status: candidate.status,
      confidenceScore: candidate.confidenceScore
    }))
  });
});

app.get('/explore/tree', async (req, res) => {
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: 'Database is not available' });
    return;
  }

  const requestedName = String(req.query.name ?? '').trim();
  const requestedSlug = String(req.query.slug ?? '').trim();
  const personId = String(req.query.personId ?? '').trim();
  const externalProfileId = String(req.query.externalProfileId ?? '').trim();
  const limit = Math.min(Number(req.query.limit ?? 12), 24);

  // A `slug`-only lookup (no `name`) can't be expressed as a SQL WHERE — slugify() collapses
  // accents/case/spaces client-side — so it has to fetch a batch and match in memory. `take`
  // must cover the whole table in that case, or names later in the alphabetical order (e.g.
  // "Mitsuyo Maeda" past a few hundred other people) silently 404 as "Root not found".
  const people = personId
    ? await db.person.findMany({ where: { id: personId }, take: 1 })
    : await db.person.findMany({
      where: requestedName
        ? { fullName: { contains: requestedName, mode: 'insensitive' } }
        : {},
      orderBy: { fullName: 'asc' },
      take: requestedName ? 300 : 5000
    });
  const externalProfiles = externalProfileId
    ? await db.externalSourceProfile.findMany({ where: { id: externalProfileId }, take: 1 })
    : await db.externalSourceProfile.findMany({
      where: requestedName
        ? { externalName: { contains: requestedName, mode: 'insensitive' } }
        : {},
      orderBy: { externalName: 'asc' },
      take: requestedName ? 300 : 5000
    });

  const rootPerson = personId
    ? people[0]
    : people.find((person: any) => requestedSlug ? slugify(person.fullName) === requestedSlug : person.fullName.toLowerCase() === requestedName.toLowerCase())
      ?? people.find((person: any) => requestedSlug ? slugify(person.fullName).includes(requestedSlug) : person.fullName.toLowerCase().includes(requestedName.toLowerCase()));
  const rootExternal = externalProfileId
    ? externalProfiles[0]
    : externalProfiles.find((profile: any) => requestedSlug ? slugify(profile.externalName) === requestedSlug : profile.externalName.toLowerCase() === requestedName.toLowerCase())
      ?? externalProfiles.find((profile: any) => requestedSlug ? slugify(profile.externalName).includes(requestedSlug) : profile.externalName.toLowerCase().includes(requestedName.toLowerCase()));

  const rootName = rootPerson?.fullName ?? rootExternal?.externalName ?? requestedName;
  if (!rootName) {
    res.status(404).json({ error: 'Root not found' });
    return;
  }

  const rootId = rootPerson ? `person:${rootPerson.id}` : rootExternal ? `external:${rootExternal.id}` : `query:${slugify(rootName)}`;
  const rootProfileUrl = rootExternal?.sourceProfileUrl;
  // ExternalFactCandidate rows (the raw, un-audited BJJ Heroes bio scrape) are intentionally
  // not rendered here anymore: team/state names ("Brazilian Top Team", "Minas Gerais") and
  // mangled multi-name extractions ("Philip Smith andMurilo Santana") were showing up as if
  // they were athletes. The same source bios were already re-extracted with proper entity
  // resolution and manual audit into the records/ dataset (Person + LineageClaim), which is
  // what actually powers the tree now. The raw candidates stay in the DB, unused here, as
  // material for a future team/academy tree (v2.0) rather than mixed into the athlete one.
  const claims = rootPerson
    ? await db.lineageClaim.findMany({
      where: {
        status: { in: ['confirmed', 'corroborated', 'verified'] },
        OR: [
          { studentPersonId: rootPerson.id },
          { teacherPersonId: rootPerson.id }
        ]
      },
      include: { studentPerson: true, teacherPerson: true, evidences: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    : [];

  // "How many black belts has this person promoted?" — the question that started this whole
  // project. Batched into one groupBy for every person who might appear as a node in this
  // response, rather than a count() per node.
  const personIdsForBeltCounts = Array.from(
    new Set(
      [rootPerson?.id, ...claims.flatMap((claim: any) => [claim.studentPersonId, claim.teacherPersonId])].filter(
        (id): id is string => Boolean(id)
      )
    )
  );
  const beltCounts = personIdsForBeltCounts.length
    ? await db.lineageClaim.groupBy({
      by: ['teacherPersonId'],
      where: {
        teacherPersonId: { in: personIdsForBeltCounts },
        claimType: 'black_belt_awarded_by',
        status: { in: ['confirmed', 'corroborated', 'verified'] }
      },
      _count: { _all: true }
    })
    : [];
  const beltCountByPersonId = new Map(beltCounts.map((entry: any) => [entry.teacherPersonId as string, entry._count._all as number]));

  const nodes = new Map<string, Record<string, unknown>>();
  const links: Array<Record<string, unknown>> = [];
  nodes.set(rootId, {
    id: rootId,
    entityType: rootPerson ? 'person' : rootExternal ? 'external_profile' : 'query',
    entityId: rootPerson?.id ?? rootExternal?.id,
    name: rootName,
    subtitle: rootPerson ? 'Local person record' : rootExternal ? 'External discovery profile' : 'Database search node',
    description: rootPerson ? 'Local person record from the review-first database.' : rootExternal ? 'Imported external discovery profile pending editorial handling.' : 'Virtual explorer node built from matching fact candidates in the database.',
    status: rootPerson ? 'verified' : 'pending',
    sourceUrl: rootProfileUrl,
    profileHref: rootPerson ? `/people/${slugify(rootPerson.fullName)}` : undefined,
    blackBeltsAwarded: rootPerson ? beltCountByPersonId.get(rootPerson.id) ?? 0 : undefined,
    expandable: true
  });

  // Note: rootExternal's source profile is intentionally not rendered as its own graph
  // node — it's just "BJJ Heroes" (the source name), not a lineage entity, and only ever
  // added visual clutter. Its URL is already exposed via the root node's own `sourceUrl`.

  for (const claim of claims as any[]) {
    const other = claim.studentPersonId === rootPerson?.id ? claim.teacherPerson : claim.studentPerson;
    if (!other) continue;
    const otherId = `person:${other.id}`;
    const publicStatus = ['confirmed', 'corroborated', 'verified'].includes(claim.status);
    nodes.set(otherId, {
      id: otherId,
      entityType: 'person',
      entityId: other.id,
      name: other.fullName,
      subtitle: publicStatus ? 'Approved lineage' : 'Lineage claim pending',
      description: claim.relationshipLabel,
      status: publicStatus ? 'verified' : 'pending',
      profileHref: `/people/${slugify(other.fullName)}`,
      blackBeltsAwarded: beltCountByPersonId.get(other.id) ?? 0,
      expandable: true
    });
    links.push({
      id: `claim:${claim.id}`,
      from: `person:${claim.teacherPersonId}`,
      to: `person:${claim.studentPersonId}`,
      label: claim.relationshipLabel,
      status: publicStatus ? 'verified' : 'pending',
      evidenceLevel: claim.evidenceLevel,
      sourceCount: claim.evidences.length
    });
  }

  res.json({
    rootId,
    expandedName: rootName,
    nodes: Array.from(nodes.values()),
    links,
    counts: {
      candidates: 0,
      claims: claims.length,
      nodes: nodes.size,
      links: links.length
    }
  });
});

// Builds the full nested lineage forest (every disconnected tree, root-to-descendants)
// in one shot from the whole Person + LineageClaim table — unlike /explore/tree (which
// lazily returns just the immediate neighbors of one root), this is meant to be fetched
// once and walked/collapsed entirely client-side, matching the motion-prototype UI.
app.get(
  '/explore/forest',
  protectPublicData,
  publicReadLimit('explore-forest', 24, 10 * 60 * 1000),
  async (_req, res) => {
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: 'Database is not available' });
    return;
  }

  const people = await db.person.findMany({
    select: { id: true, fullName: true, nicknames: true, team: true, bio: true, profileUrl: true }
  });
  const claims = await db.lineageClaim.findMany({
    where: { status: { in: ['confirmed', 'corroborated', 'verified'] }, teacherPersonId: { not: null } },
    select: { studentPersonId: true, teacherPersonId: true, claimType: true, status: true, notes: true },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }]
  });

  const personById = new Map(people.map((p: any) => [p.id, p]));
  const primaryTeacherClaim = new Map<string, (typeof claims)[number]>();
  for (const claim of claims as any[]) {
    if (!claim.teacherPersonId || !personById.has(claim.teacherPersonId) || !personById.has(claim.studentPersonId)) continue;
    if (!primaryTeacherClaim.has(claim.studentPersonId)) primaryTeacherClaim.set(claim.studentPersonId, claim);
  }

  const childrenOf = new Map<string, Array<{ studentId: string; claim: (typeof claims)[number] }>>();
  primaryTeacherClaim.forEach((claim, studentId) => {
    const list = childrenOf.get(claim.teacherPersonId as string) ?? [];
    list.push({ studentId, claim });
    childrenOf.set(claim.teacherPersonId as string, list);
  });

  function buildNode(personId: string, claim: any, visited: Set<string>): Record<string, unknown> {
    const person = personById.get(personId) as any;
    const isRoot = !claim;
    const importedFromBjjHeroes = isBjjHeroesUrl(person.profileUrl);
    const confidence = isRoot ? 'root' : claim.status === 'confirmed' ? 'high' : 'medium';
    const source = isRoot ? 'root' : claim.claimType === 'trained_under' ? 'manual_curation' : 'bio_extraction';
    const kids = (childrenOf.get(personId) ?? [])
      .filter((entry) => !visited.has(entry.studentId))
      .map((entry) => buildNode(entry.studentId, entry.claim, new Set(visited).add(personId)));
    return {
      id: person.id,
      name: person.fullName,
      nickname: person.nicknames?.[0] ?? '',
      team: person.team ?? '',
      // A captura original permanece no banco para auditoria, mas não é
      // reproduzida pela API pública. A web cria uma síntese editorial nova
      // usando somente os vínculos estruturados.
      url: importedFromBjjHeroes ? '' : person.profileUrl ?? '',
      bio: importedFromBjjHeroes ? '' : person.bio ?? '',
      confidence,
      source,
      evidence: claim?.notes ?? '',
      children: kids.length ? kids : undefined
    };
  }

  function countAll(node: Record<string, unknown>): number {
    const kids = (node.children as Array<Record<string, unknown>>) ?? [];
    return kids.reduce((sum, kid) => sum + 1 + countAll(kid), 0);
  }

  const rootIds = people.map((p: any) => p.id).filter((id: string) => !primaryTeacherClaim.has(id));
  const forest = rootIds
    .map((id: string) => buildNode(id, null, new Set()))
    .sort((a: any, b: any) => countAll(b) - countAll(a));

  res.json(forest);
  }
);

app.post('/external-profiles/:id/approve-person', requireAdmin, async (req, res) => {
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: 'Database is not available' });
    return;
  }
  const profile = await db.externalSourceProfile.findUnique({
    where: { id: req.params.id },
    include: { factCandidates: true }
  });
  if (!profile) {
    res.status(404).json({ error: 'External profile not found' });
    return;
  }

  const existing = await db.person.findFirst({
    where: { fullName: { equals: profile.externalName, mode: 'insensitive' } }
  });
  const nicknames = profile.nickname ? [profile.nickname] : [];
  const person = existing
    ? await db.person.update({
      where: { id: existing.id },
      data: { nicknames: Array.from(new Set([...(existing.nicknames ?? []), ...nicknames])) }
    })
    : await db.person.create({
      data: {
        fullName: profile.externalName,
        nicknames
      }
    });

  await db.externalFactCandidate.updateMany({
    where: {
      externalProfileId: profile.id,
      candidateType: 'person_discovery'
    },
    data: { status: 'approved_person_record' }
  });
  await db.externalSourceProfile.update({
    where: { id: profile.id },
    data: { sourceStatus: 'approved_person_record' }
  });
  await db.reviewQueue.create({
    data: { entityType: 'person', entityId: person.id, status: 'approved' }
  }).catch(() => undefined);
  await db.changeHistory.create({
    data: {
      entityType: 'person',
      entityId: person.id,
      action: 'approve_external_person_discovery',
      changedBy: req.body?.reviewer ?? 'curator',
      details: JSON.stringify({
        externalProfileId: profile.id,
        sourceName: profile.sourceName,
        sourceProfileUrl: profile.sourceProfileUrl,
        note: req.body?.notes ?? 'Approved person discovery only; lineage and affiliation remain pending review.'
      })
    }
  }).catch(() => undefined);

  res.status(201).json({
    person,
    externalProfileId: profile.id,
    status: 'approved_person_record',
    publicLineageCreated: false,
    pendingCandidates: profile.factCandidates.filter((candidate: any) => candidate.candidateType !== 'person_discovery').length
  });
});

app.post('/people', requireAdmin, (req, res) => {
  const person = createPerson(req.body);
  res.status(201).json(person);
});

app.get('/sources', (_req, res) => {
  res.json(listSources());
});

app.post('/sources', requireAdmin, (req, res) => {
  const source = createSource(req.body);
  res.status(201).json(source);
});

app.get('/relationships', requireAdmin, (_req, res) => {
  res.json(listRelationships());
});

app.get('/public/lineage-graph', (_req, res) => {
  res.json(listPublicLineageGraph());
});

app.get(
  '/public/people/:id',
  protectPublicData,
  publicReadLimit('public-person', 120, 10 * 60 * 1000),
  async (req, res) => {
  const db = await getDb();
  if (!db) {
    res.json(getPublicPersonProfile(String(req.params.id)));
    return;
  }
  const person = await db.person.findUnique({
    where: { id: req.params.id },
    include: {
      affiliations: { include: { organization: true } },
      studentClaims: {
        where: { status: { in: ['confirmed', 'corroborated', 'verified'] } },
        include: { teacherPerson: true, evidences: true }
      },
      teacherClaims: {
        where: { status: { in: ['confirmed', 'corroborated', 'verified'] } },
        include: { studentPerson: true, evidences: true }
      }
    }
  });
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const lineagePath: Array<Record<string, unknown>> = [];
  const lineagePathClaims: Array<Record<string, unknown>> = [];
  let current = person;
  for (let depth = 0; depth < 8; depth += 1) {
    lineagePath.push({
      id: current.id,
      fullName: current.fullName,
      country: current.country,
      nicknames: current.nicknames
    });
    const teacherClaim = await db.lineageClaim.findFirst({
      where: {
        studentPersonId: current.id,
        status: { in: ['confirmed', 'corroborated', 'verified'] },
        teacherPersonId: { not: null }
      },
      include: { teacherPerson: true, evidences: true },
      orderBy: [{ evidenceLevel: 'asc' }, { createdAt: 'asc' }]
    });
    if (!teacherClaim?.teacherPerson || lineagePath.some((node) => node.id === teacherClaim.teacherPerson.id)) break;
    // `/public/people/:id`'s own studentClaims/teacherClaims only cover the queried
    // person — capture each hop's claim here too so callers (e.g. the explore Story
    // Mode) can show a real relationshipLabel/evidenceLevel at every step, not just
    // the last one.
    lineagePathClaims.push({
      id: teacherClaim.id,
      studentPersonId: teacherClaim.studentPersonId,
      studentName: current.fullName,
      teacherPersonId: teacherClaim.teacherPersonId,
      teacherName: teacherClaim.teacherPerson.fullName,
      claimType: teacherClaim.claimType,
      relationshipLabel: teacherClaim.relationshipLabel,
      evidenceLevel: teacherClaim.evidenceLevel,
      sourceCount: teacherClaim.evidences.length,
      sourceUrls: teacherClaim.evidences.map((evidence: any) => evidence.url)
    });
    current = teacherClaim.teacherPerson;
  }
  lineagePath.reverse();
  const publicRelationships = [
    ...lineagePathClaims,
    ...person.studentClaims.map((claim: any) => ({
      id: claim.id,
      studentPersonId: claim.studentPersonId,
      studentName: person.fullName,
      teacherPersonId: claim.teacherPersonId,
      teacherName: claim.teacherPerson?.fullName,
      claimType: claim.claimType,
      relationshipLabel: claim.relationshipLabel,
      evidenceLevel: claim.evidenceLevel,
      sourceCount: claim.evidences.length,
      sourceUrls: claim.evidences.map((evidence: any) => evidence.url)
    })),
    ...person.teacherClaims.map((claim: any) => ({
      id: claim.id,
      studentPersonId: claim.studentPersonId,
      studentName: claim.studentPerson?.fullName,
      teacherPersonId: claim.teacherPersonId,
      teacherName: person.fullName,
      claimType: claim.claimType,
      relationshipLabel: claim.relationshipLabel,
      evidenceLevel: claim.evidenceLevel,
      sourceCount: claim.evidences.length,
      sourceUrls: claim.evidences.map((evidence: any) => evidence.url)
    }))
  ].filter((claim, index, all) => all.findIndex((entry) => entry.id === claim.id) === index);
  res.json({
    personId: person.id,
    fullName: person.fullName,
    nicknames: person.nicknames,
    country: person.country,
    city: person.city,
    lineageStatus: person.studentClaims.length ? 'Confirmed' : 'No verified lineage yet',
    affiliations: person.affiliations.map((affiliation: any) => ({
      id: affiliation.id,
      organizationId: affiliation.organizationId,
      organizationName: affiliation.organization.name,
      affiliationType: affiliation.affiliationType
    })),
    lineagePath,
    publicRelationships,
    promotionGroups: []
  });
  }
);

app.get('/organizations/review', requireAdmin, (_req, res) => {
  res.json({ organizations: listOrganizations(), relationships: listOrganizationRelationships() });
});

app.post('/organizations/review', requireAdmin, (req, res) => {
  res.status(201).json(createOrganization(req.body));
});

app.post('/organizations/review/canonicalize', requireAdmin, (req, res) => {
  res.status(201).json(canonicalizeOrganizationDuplicate(req.body));
});

app.get('/promotion-groups', (_req, res) => {
  res.json(listPromotionGroups());
});

app.post('/promotion-groups', requireAdmin, (req, res) => {
  res.status(201).json(createPromotionGroup(req.body));
});

app.post('/relationships', requireAdmin, (req, res) => {
  const relationship = createRelationship(req.body);
  res.status(201).json(relationship);
});

app.post('/relationships/:id/approve', requireAdmin, (req, res) => {
  try {
    const relationship = approveRelationship(String(req.params.id));
    res.json(relationship);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
});

app.post('/imports/upload', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const { importType, importCategory, uploadedBy, options } = req.body as { importType: string; importCategory?: string; uploadedBy?: string; options?: string };
    const parsedOptions = options ? JSON.parse(options) : {};
    const stored = await storeUploadFile({ originalname: file.originalname, buffer: file.buffer, size: file.size, mimetype: file.mimetype });
    const job = await createImportJobRecord({ fileName: stored.fileName, originalFileName: file.originalname, importType, importCategory, fileSize: file.size, storagePath: stored.storagePath, uploadedBy, mapping: {}, options: parsedOptions });
    return res.status(201).json(job);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/preview', requireAdmin, async (req, res) => {
  try {
    const job = await getImportJob(String(req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Import job not found' });
    }
    const preview = previewImport(job.storagePath as string, (job.importType as string) as 'csv' | 'xlsx' | 'sqlite');
    return res.json(preview);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/map-columns', requireAdmin, async (req, res) => {
  try {
    const mapping = req.body as Record<string, unknown>;
    const updated = await updateImportJobMapping(String(req.params.id), mapping);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/validate', requireAdmin, async (req, res) => {
  try {
    const job = await getImportJob(String(req.params.id));
    if (!job) {
      return res.status(404).json({ error: 'Import job not found' });
    }
    if (job.status === 'completed') {
      return res.status(409).json({ error: 'Este lote já foi executado.' });
    }
    const preview = previewImport(
      job.storagePath as string,
      job.importType as 'csv' | 'xlsx' | 'sqlite',
      { importCategory: job.importCategory ?? 'people' }
    );
    if (preview.summary.totalRows === 0) {
      return res.status(400).json({ error: 'O arquivo não contém linhas importáveis.' });
    }
    if (preview.summary.invalidRows > 0) {
      return res.status(422).json({
        error: `${preview.summary.invalidRows} linha(s) inválida(s) precisam ser corrigidas antes da execução.`,
        preview
      });
    }
    const updated = await setImportJobStatus(
      String(req.params.id),
      'validated',
      JSON.stringify(preview.summary)
    );
    return res.json({ job: updated, preview });
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/execute', requireAdmin, async (req, res) => {
  try {
    const result = await executeImportJob(String(req.params.id), req.body as { importCategory?: string; mapping?: Record<string, unknown> });
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/rollback', requireAdmin, async (req, res) => {
  try {
    const result = await rollbackImportJob(String(req.params.id));
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/imports', requireAdmin, async (_req, res) => {
  const jobs = await listImportJobs();
  return res.json(jobs);
});

app.get('/imports/presets/research', requireAdmin, (_req, res) => {
  res.json(getImportPresets());
});

app.post('/imports/readiness-report', requireAdmin, async (req, res) => {
  const report = await createImportReadinessReport(req.body as { categories: Record<string, Array<Record<string, unknown>>> });
  res.json(report);
});

app.get('/imports/:id', requireAdmin, async (req, res) => {
  const job = await getImportJob(String(req.params.id));
  return job ? res.json(job) : res.status(404).json({ error: 'Import job not found' });
});

app.get('/imports/:id/detail', requireAdmin, async (req, res) => {
  const detail = await getImportOperationalDetail(String(req.params.id));
  return detail ? res.json(detail) : res.status(404).json({ error: 'Import job not found' });
});

app.get('/imports/:id/rows', requireAdmin, async (req, res) => {
  const rows = await listImportRows(String(req.params.id));
  return res.json(rows);
});

app.get('/imports/:id/report', requireAdmin, async (req, res) => {
  const report = await getImportReport(String(req.params.id));
  return res.json(report);
});

app.get('/imports/:id/duplicates', requireAdmin, async (req, res) => {
  const duplicates = await listImportDuplicateCandidates(String(req.params.id));
  return res.json(duplicates);
});

app.get('/imports/:id/review-queue', requireAdmin, async (req, res) => {
  const queue = await listImportReviewQueue(String(req.params.id));
  return res.json(queue);
});

app.get('/imports/:id/imported-records', requireAdmin, async (req, res) => {
  const records = await listImportImportedRecords(String(req.params.id));
  return res.json(records);
});

app.get('/imports/:id/audit-history', requireAdmin, async (req, res) => {
  const history = await listImportAuditHistory(String(req.params.id));
  return res.json(history);
});

app.get('/imports/:id/report.csv', requireAdmin, async (req, res) => {
  const report = await getImportReport(String(req.params.id));
  res.type('text/csv').send(`job_id,row_count,review_queue_count,imported_count,skipped_count,duplicate_count\n${report.job?.id ?? req.params.id},${report.rowCount},${report.reviewQueueCount},${report.importedCount},${report.skippedCount},${report.duplicateCount}`);
});

app.get('/imports/:id/status', requireAdmin, async (req, res) => {
  const status = await getImportStatus(String(req.params.id));
  return res.json(status);
});

app.get('/imports/:id/download', requireAdmin, async (req, res) => {
  const job = await getImportJob(String(req.params.id));
  if (!job || !job.storagePath) {
    return res.status(404).json({ error: 'Import job not found' });
  }
  return res.download(job.storagePath as string, job.originalFileName as string);
});

app.get('/review/claims', requireAdmin, async (req, res) => {
  res.json(await listClaimReviews(String(req.query.status ?? 'pending_review')));
});

app.get('/review/submissions', requireAdmin, async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const submissions = await listLineageSubmissions(db, String(req.query.status ?? 'pending_review'));
  return res.json(submissions.map(privateSubmissionView));
});

app.get('/review/submissions/:id', requireAdmin, async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const submission = await getLineageSubmission(db, String(req.params.id));
  return submission ? res.json(privateSubmissionView(submission)) : res.status(404).json({ error: 'Solicitação não encontrada.' });
});

app.get('/review/submissions/:id/certificate', requireAdmin, async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const submission = await getLineageSubmission(db, String(req.params.id));
  if (!submission?.certificateStoragePath) {
    return res.status(404).json({ error: 'Esta solicitação não possui certificado.' });
  }
  try {
    const certificate = await readCommunityCertificate(submission.certificateStoragePath);
    const originalName = submission.certificateOriginalName || 'certificado';
    res.type(submission.certificateMimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(originalName).replaceAll("'", '%27')}`
    );
    return res.send(certificate);
  } catch (error) {
    return res.status(404).json({ error: (error as Error).message });
  }
});

app.get('/review/submissions/:id/certificates/:certificateId', requireAdmin, async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const submission = await getLineageSubmission(db, String(req.params.id));
  const certificate = submission?.certificates?.find(
    (entry: any) => entry.id === String(req.params.certificateId)
  );
  if (!certificate) {
    return res.status(404).json({ error: 'Certificado não encontrado nesta solicitação.' });
  }
  try {
    const file = await readCommunityCertificate(certificate.storagePath);
    res.type(certificate.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(certificate.originalName).replaceAll("'", '%27')}`
    );
    return res.send(file);
  } catch (error) {
    return res.status(404).json({ error: (error as Error).message });
  }
});

app.post('/review/submissions/:id/:action', requireAdmin, async (req, res) => {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: 'Database is not available' });
  const action = req.params.action as 'approve' | 'reject' | 'request_evidence';
  if (!['approve', 'reject', 'request_evidence'].includes(action)) {
    return res.status(400).json({ error: 'Ação editorial inválida.' });
  }
  try {
    const updated = await decideLineageSubmission(db, String(req.params.id), action, {
      ...(req.body ?? {}),
      reviewerId: res.locals.adminUser.id
    });
    return res.status(201).json(privateSubmissionView(updated));
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/review/claims/:id', requireAdmin, async (req, res) => {
  const claim = await getClaimReview(String(req.params.id));
  return claim ? res.json(claim) : res.status(404).json({ error: 'Claim not found' });
});

app.post('/review/claims/:id/approve', requireAdmin, async (req, res) => {
  try {
    const decision = await decideClaimReview(
      String(req.params.id),
      'approve',
      req.body.notes ?? 'Approved',
      req.body.evidenceLevel,
      { ...req.body, reviewerId: res.locals.adminUser.id }
    );
    res.status(201).json(decision);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
});

app.post('/review/claims/:id/reclassify', requireAdmin, async (req, res) => {
  try {
    const decision = await reclassifyClaimReview(String(req.params.id), req.body.claimType, req.body.relationshipLabel, req.body.notes ?? 'Relationship type reclassified');
    res.status(201).json(decision);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/review/claims/:id/reject', requireAdmin, async (req, res) => {
  try {
    const decision = await decideClaimReview(
      String(req.params.id),
      'reject',
      req.body.notes ?? 'Rejected',
      undefined,
      { reviewerId: res.locals.adminUser.id }
    );
    res.status(201).json(decision);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
});

app.post('/review/claims/:id/dispute', requireAdmin, async (req, res) => {
  const decision = await decideClaimReview(
    String(req.params.id),
    'dispute',
    req.body.notes ?? 'Marked disputed',
    undefined,
    { reviewerId: res.locals.adminUser.id }
  );
  res.status(201).json(decision);
});

app.post('/review/claims/:id/request-evidence', requireAdmin, async (req, res) => {
  const decision = await decideClaimReview(
    String(req.params.id),
    'request_evidence',
    req.body.notes ?? 'More evidence requested',
    undefined,
    { reviewerId: res.locals.adminUser.id }
  );
  res.status(201).json(decision);
});

app.get('/review/duplicates', requireAdmin, async (req, res) => {
  const duplicates = await listDuplicateCandidates(req.query as Record<string, unknown>);
  res.json(duplicates);
});

app.post('/review/duplicates/bulk', requireAdmin, async (req, res) => {
  const result = await bulkDecideDuplicates(req.body as { ids?: string[]; filters?: Record<string, unknown>; action: 'ignore_low_confidence' | 'keep_separate' | 'needs_manual_review'; notes?: string });
  res.json(result);
});

app.get('/review/duplicates/:id', requireAdmin, async (req, res) => {
  const duplicate = await getDuplicateReview(String(req.params.id));
  return duplicate ? res.json(duplicate) : res.status(404).json({ error: 'Duplicate candidate not found' });
});

app.post('/review/duplicates/:id/merge', requireAdmin, async (req, res) => {
  const decision = await decideDuplicate(String(req.params.id), 'merge', req.body.notes);
  res.json(decision);
});

app.post('/review/duplicates/:id/keep-separate', requireAdmin, async (req, res) => {
  const decision = await decideDuplicate(String(req.params.id), 'keep_separate', req.body.notes);
  res.json(decision);
});

app.post('/review/duplicates/:id/uncertain', requireAdmin, async (req, res) => {
  const decision = await decideDuplicate(String(req.params.id), 'uncertain', req.body.notes);
  res.json(decision);
});

app.post('/research-tasks/generate-census', requireAdmin, async (_req, res) => {
  const result = await generateCensusResearchTasks();
  res.status(201).json(result);
});

app.get('/research-tasks', requireAdmin, (_req, res) => {
  res.json(getGeneratedResearchTasks());
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
