import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
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
  listSources,
  loginAdmin,
  verifyAuth
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
import { decideClaimReview, getClaimReview, reclassifyClaimReview } from './reviewService.js';
import { storeUploadFile } from './storage.js';

dotenv.config({ path: '../../.env' });

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '25mb' }));

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

app.get('/admin/metrics', async (_req, res) => {
  const metrics = await getDashboardMetrics();
  res.json(metrics);
});

app.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    res.json(loginAdmin(email, password));
  } catch (error) {
    res.status(401).json({ error: (error as Error).message });
  }
});

app.get('/people', (_req, res) => {
  res.json(listPeople());
});

app.post('/people', (req, res) => {
  const person = createPerson(req.body);
  res.status(201).json(person);
});

app.get('/sources', (_req, res) => {
  res.json(listSources());
});

app.post('/sources', (req, res) => {
  const source = createSource(req.body);
  res.status(201).json(source);
});

app.get('/relationships', (_req, res) => {
  res.json(listRelationships());
});

app.get('/public/lineage-graph', (_req, res) => {
  res.json(listPublicLineageGraph());
});

app.get('/public/people/:id', (req, res) => {
  res.json(getPublicPersonProfile(req.params.id));
});

app.get('/organizations/review', (_req, res) => {
  res.json({ organizations: listOrganizations(), relationships: listOrganizationRelationships() });
});

app.post('/organizations/review', (req, res) => {
  res.status(201).json(createOrganization(req.body));
});

app.post('/organizations/review/canonicalize', (req, res) => {
  res.status(201).json(canonicalizeOrganizationDuplicate(req.body));
});

app.get('/promotion-groups', (_req, res) => {
  res.json(listPromotionGroups());
});

app.post('/promotion-groups', (req, res) => {
  res.status(201).json(createPromotionGroup(req.body));
});

app.post('/relationships', (req, res) => {
  const relationship = createRelationship(req.body);
  res.status(201).json(relationship);
});

app.post('/relationships/:id/approve', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    verifyAuth(token);
    const relationship = approveRelationship(req.params.id);
    res.json(relationship);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
});

app.post('/imports/upload', upload.single('file'), async (req, res) => {
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

app.post('/imports/:id/preview', async (req, res) => {
  try {
    const job = await getImportJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Import job not found' });
    }
    const preview = previewImport(job.storagePath as string, (job.importType as string) as 'csv' | 'xlsx' | 'sqlite');
    return res.json(preview);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/map-columns', async (req, res) => {
  try {
    const mapping = req.body as Record<string, unknown>;
    const updated = await updateImportJobMapping(req.params.id, mapping);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/validate', async (req, res) => {
  try {
    const updated = await setImportJobStatus(req.params.id, 'validated');
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/execute', async (req, res) => {
  try {
    const result = await executeImportJob(req.params.id, req.body as { importCategory?: string; mapping?: Record<string, unknown> });
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/imports/:id/rollback', async (req, res) => {
  try {
    const result = await rollbackImportJob(req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/imports', async (_req, res) => {
  const jobs = await listImportJobs();
  return res.json(jobs);
});

app.get('/imports/presets/research', (_req, res) => {
  res.json(getImportPresets());
});

app.post('/imports/readiness-report', async (req, res) => {
  const report = await createImportReadinessReport(req.body as { categories: Record<string, Array<Record<string, unknown>>> });
  res.json(report);
});

app.get('/imports/:id', async (req, res) => {
  const job = await getImportJob(req.params.id);
  return job ? res.json(job) : res.status(404).json({ error: 'Import job not found' });
});

app.get('/imports/:id/detail', async (req, res) => {
  const detail = await getImportOperationalDetail(req.params.id);
  return detail ? res.json(detail) : res.status(404).json({ error: 'Import job not found' });
});

app.get('/imports/:id/rows', async (req, res) => {
  const rows = await listImportRows(req.params.id);
  return res.json(rows);
});

app.get('/imports/:id/report', async (req, res) => {
  const report = await getImportReport(req.params.id);
  return res.json(report);
});

app.get('/imports/:id/duplicates', async (req, res) => {
  const duplicates = await listImportDuplicateCandidates(req.params.id);
  return res.json(duplicates);
});

app.get('/imports/:id/review-queue', async (req, res) => {
  const queue = await listImportReviewQueue(req.params.id);
  return res.json(queue);
});

app.get('/imports/:id/imported-records', async (req, res) => {
  const records = await listImportImportedRecords(req.params.id);
  return res.json(records);
});

app.get('/imports/:id/audit-history', async (req, res) => {
  const history = await listImportAuditHistory(req.params.id);
  return res.json(history);
});

app.get('/imports/:id/report.csv', async (req, res) => {
  const report = await getImportReport(req.params.id);
  res.type('text/csv').send(`job_id,row_count,review_queue_count,imported_count,skipped_count,duplicate_count\n${report.job?.id ?? req.params.id},${report.rowCount},${report.reviewQueueCount},${report.importedCount},${report.skippedCount},${report.duplicateCount}`);
});

app.get('/imports/:id/status', async (req, res) => {
  const status = await getImportStatus(req.params.id);
  return res.json(status);
});

app.get('/imports/:id/download', async (req, res) => {
  const job = await getImportJob(req.params.id);
  if (!job || !job.storagePath) {
    return res.status(404).json({ error: 'Import job not found' });
  }
  return res.download(job.storagePath as string, job.originalFileName as string);
});

app.get('/review/claims', (_req, res) => {
  res.json(listRelationships());
});

app.get('/review/claims/:id', async (req, res) => {
  const claim = await getClaimReview(req.params.id);
  return claim ? res.json(claim) : res.status(404).json({ error: 'Claim not found' });
});

app.post('/review/claims/:id/approve', async (req, res) => {
  try {
    if (req.headers.authorization) {
      verifyAuth(req.headers.authorization?.replace('Bearer ', ''));
    }
    const decision = await decideClaimReview(req.params.id, 'approve', req.body.notes ?? 'Approved', req.body.evidenceLevel, req.body);
    res.status(201).json(decision);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
});

app.post('/review/claims/:id/reclassify', async (req, res) => {
  try {
    const decision = await reclassifyClaimReview(req.params.id, req.body.claimType, req.body.relationshipLabel, req.body.notes ?? 'Relationship type reclassified');
    res.status(201).json(decision);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/review/claims/:id/reject', async (req, res) => {
  try {
    if (req.headers.authorization) {
      verifyAuth(req.headers.authorization?.replace('Bearer ', ''));
    }
    const decision = await decideClaimReview(req.params.id, 'reject', req.body.notes ?? 'Rejected');
    res.status(201).json(decision);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
});

app.post('/review/claims/:id/dispute', async (req, res) => {
  const decision = await decideClaimReview(req.params.id, 'dispute', req.body.notes ?? 'Marked disputed');
  res.status(201).json(decision);
});

app.post('/review/claims/:id/request-evidence', async (req, res) => {
  const decision = await decideClaimReview(req.params.id, 'request_evidence', req.body.notes ?? 'More evidence requested');
  res.status(201).json(decision);
});

app.get('/review/duplicates', async (req, res) => {
  const duplicates = await listDuplicateCandidates(req.query as Record<string, unknown>);
  res.json(duplicates);
});

app.post('/review/duplicates/bulk', async (req, res) => {
  const result = await bulkDecideDuplicates(req.body as { ids?: string[]; filters?: Record<string, unknown>; action: 'ignore_low_confidence' | 'keep_separate' | 'needs_manual_review'; notes?: string });
  res.json(result);
});

app.get('/review/duplicates/:id', async (req, res) => {
  const duplicate = await getDuplicateReview(req.params.id);
  return duplicate ? res.json(duplicate) : res.status(404).json({ error: 'Duplicate candidate not found' });
});

app.post('/review/duplicates/:id/merge', async (req, res) => {
  const decision = await decideDuplicate(req.params.id, 'merge', req.body.notes);
  res.json(decision);
});

app.post('/review/duplicates/:id/keep-separate', async (req, res) => {
  const decision = await decideDuplicate(req.params.id, 'keep_separate', req.body.notes);
  res.json(decision);
});

app.post('/review/duplicates/:id/uncertain', async (req, res) => {
  const decision = await decideDuplicate(req.params.id, 'uncertain', req.body.notes);
  res.json(decision);
});

app.post('/research-tasks/generate-census', async (_req, res) => {
  const result = await generateCensusResearchTasks();
  res.status(201).json(result);
});

app.get('/research-tasks', (_req, res) => {
  res.json(getGeneratedResearchTasks());
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
