import { describe, expect, it } from 'vitest';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import {
  createImportReadinessReport,
  createImportJobRecord,
  decideDuplicate,
  executeImportJob,
  generateCensusResearchTasks,
  getDashboardMetrics,
  getImportPresets,
  getImportOperationalDetail,
  getImportReport,
  listImportDuplicateCandidates,
  listImportImportedRecords,
  listImportReviewQueue,
  previewImport,
  rollbackImportJob
} from './importService.js';
import { decideClaimReview, getClaimReview } from './reviewService.js';
import {
  canonicalizeOrganizationDuplicate,
  createOrganization,
  createPromotionGroup,
  getPublicPersonProfile,
  listPublicLineageGraph,
  publishLineageRelationship,
  reclassifyRelationship
} from './domain.js';
import {
  getBjjHeroesStatus,
  importManualBjjHeroesProfile,
  pauseBjjHeroesConnector,
  resumeBjjHeroesConnector,
  runBjjHeroesDryRun
} from './bjjHeroesService.js';

describe('import service workflow', () => {
  const writeTempCsv = (name: string, content: string) => {
    const dir = path.resolve(__dirname, '../../../data/test-imports');
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, name);
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  };

  it('creates an import job and returns preview data for a sample CSV', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/people_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'people_sample.csv',
      originalFileName: 'people_sample.csv',
      importType: 'csv',
      importCategory: 'people',
      storagePath: fixturePath,
      mapping: {}
    });

    expect(job.id).toContain('import-');
    expect(job.preview).toContain('Eddie');
  });

  it('executed imports produce rows and a review summary', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/duplicate_people_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'duplicate_people_sample.csv',
      originalFileName: 'duplicate_people_sample.csv',
      importType: 'csv',
      importCategory: 'people',
      storagePath: fixturePath,
      mapping: {}
    });

    const result = await executeImportJob(job.id, { importCategory: 'people' });
    const report = await getImportReport(job.id);

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.reviewQueueEntries.length).toBeGreaterThan(0);
    expect(report.rowCount).toBeGreaterThan(0);
    expect(report.reviewQueueCount).toBeGreaterThan(0);
  });

  it('rollback marks the import job as rolled back', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/people_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'people_sample.csv',
      originalFileName: 'people_sample.csv',
      importType: 'csv',
      importCategory: 'people',
      storagePath: fixturePath,
      mapping: {}
    });

    const result = await rollbackImportJob(job.id);

    expect(result.status).toBe('rolled_back');
  });

  it('returns import detail API data with operational counters', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/people_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'people_sample.csv',
      originalFileName: 'people_sample.csv',
      importType: 'csv',
      importCategory: 'people',
      storagePath: fixturePath,
      mapping: { full_name: 'full_name' },
      options: { delimiter: ';' }
    });

    await executeImportJob(job.id, { importCategory: 'people' });
    const detail = await getImportOperationalDetail(job.id);

    expect(detail?.originalFileName).toBe('people_sample.csv');
    expect(detail?.selectedCsvDelimiter).toBe(';');
    expect(detail?.totalRows).toBeGreaterThan(0);
  });

  it('lists duplicate candidates and preserves provenance on merge decisions', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/duplicate_people_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'duplicate_people_sample.csv',
      originalFileName: 'duplicate_people_sample.csv',
      importType: 'csv',
      importCategory: 'people',
      storagePath: fixturePath,
      mapping: {}
    });

    await executeImportJob(job.id, { importCategory: 'people' });
    const candidates = await listImportDuplicateCandidates(job.id);
    const decision = await decideDuplicate(String(candidates[0].id), 'merge', 'Confirmed same person');

    expect(candidates.length).toBeGreaterThan(0);
    expect(decision.provenancePreserved).toContain('ImportRows');
  });

  it('records keep-separate duplicate decisions', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/duplicate_people_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'duplicate_people_sample.csv',
      originalFileName: 'duplicate_people_sample.csv',
      importType: 'csv',
      importCategory: 'people',
      storagePath: fixturePath,
      mapping: {}
    });

    await executeImportJob(job.id, { importCategory: 'people' });
    const [candidate] = await listImportDuplicateCandidates(job.id);
    const decision = await decideDuplicate(String(candidate.id), 'keep_separate', 'Different people');

    expect(decision.status).toBe('keep_separate');
  });

  it('returns review queue navigation for import review tasks', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/duplicate_people_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'duplicate_people_sample.csv',
      originalFileName: 'duplicate_people_sample.csv',
      importType: 'csv',
      importCategory: 'people',
      storagePath: fixturePath,
      mapping: {}
    });

    await executeImportJob(job.id, { importCategory: 'people' });
    const queue = await listImportReviewQueue(job.id);

    expect(queue[0].openReviewUrl).toContain('/admin/');
  });

  it('approves claims through the review service', async () => {
    const decision = await decideClaimReview('claim-review-test', 'approve', 'Evidence verified', 'primary_source');
    const claim = await getClaimReview('claim-review-test');

    expect(decision.status).toBe('confirmed');
    expect(claim?.status).toBe('confirmed');
  });

  it('keeps imported lineage claims hidden publicly until reviewed', async () => {
    const fixturePath = path.resolve(__dirname, '../../../fixtures/lineage_claims_sample.csv');
    const job = await createImportJobRecord({
      fileName: 'lineage_claims_sample.csv',
      originalFileName: 'lineage_claims_sample.csv',
      importType: 'csv',
      importCategory: 'lineage_claims',
      storagePath: fixturePath,
      mapping: {}
    });

    await executeImportJob(job.id, { importCategory: 'lineage_claims' });
    const records = await listImportImportedRecords(job.id);

    expect(records['Lineage Claims'][0].status).toBe('pending review');
    expect(records['Lineage Claims'][0].publicVisibility).toBe('not public');
  });

  it('previews the curated Demian Maia review batch without excluded candidates', () => {
    const fixturePath = path.resolve(
      __dirname,
      '../../../data/imports/demian_maia_black_belts_2026_07_27/lineage_claims.csv'
    );
    const preview = previewImport(fixturePath, 'csv', { importCategory: 'lineage_claims' });
    const rawRows = preview.rows.map((row) => row.raw as Record<string, string>);

    expect(preview.summary).toEqual({ totalRows: 4, validRows: 4, invalidRows: 0 });
    expect(rawRows.map((row) => row.student_name)).toEqual([
      'Mark Turner',
      'Daniel Amado Perez',
      'Nathan Drona',
      'Vitalino Silva'
    ]);
    expect(rawRows.every((row) => row.teacher_name === 'Demian Maia')).toBe(true);
    expect(
      rawRows.every((row) => row.promoter_person_id === 'name:demian-maia')
    ).toBe(true);
    expect(rawRows.every((row) => row.status === 'pending_review')).toBe(true);
    expect(rawRows.some((row) => row.student_name === 'Nelson de Souza Lopes')).toBe(false);
  });

  it('calculates dashboard metrics from imported rows', async () => {
    const metrics = await getDashboardMetrics();

    expect(metrics.totalPeople).toBeGreaterThanOrEqual(0);
    expect(metrics.importHealth).toHaveProperty('rowsNeedingReview');
  });

  it('does not create duplicate candidates below the configured threshold', () => {
    const fixturePath = writeTempCsv('surname-only.csv', 'full_name,country\nErich Munis dos Santos,Brazil\nTarcisio Damasceno Santos,Brazil\n');
    const preview = previewImport(fixturePath, 'csv', { importCategory: 'people' });

    expect(preview.rows.flatMap((row) => row.duplicate_candidates as unknown[]).length).toBe(0);
  });

  it('limits duplicate candidates to the top 3 per imported row', () => {
    const fixturePath = writeTempCsv('top-three.csv', [
      'full_name,nickname,country,city',
      'Joao Silva,Joao,Brazil,Rio',
      'Joao A Silva,Joao,Brazil,Rio',
      'Joao B Silva,Joao,Brazil,Rio',
      'Joao C Silva,Joao,Brazil,Rio',
      'Joao Silva,Joao,Brazil,Rio'
    ].join('\n'));
    const preview = previewImport(fixturePath, 'csv', { importCategory: 'people' });
    const lastRow = preview.rows.at(-1) as any;

    expect(lastRow.duplicate_candidates.length).toBeLessThanOrEqual(3);
  });

  it('does not automatically merge organization branches with a global team', () => {
    const fixturePath = writeTempCsv('organization-branches.csv', [
      'name,organization_type',
      'Alliance Jiu-Jitsu,team',
      'Alliance Greenville,academy'
    ].join('\n'));
    const preview = previewImport(fixturePath, 'csv', { importCategory: 'organizations' });
    const secondRow = preview.rows[1] as any;

    expect(secondRow.duplicate_candidates.length).toBe(0);
  });

  it('official observations and affiliations do not create lineage claims', async () => {
    const observationsPath = writeTempCsv('official-observation-test.csv', 'observation_id,person_id,source_id,source_url,observation_type\nOBS-1,P-1,SRC-1,https://example.com,ranking oficial\n');
    const affiliationsPath = writeTempCsv('affiliation-test.csv', 'affiliation_id,person_id,organization_id,relation_type\nAFF-1,P-1,O-1,equipe reportada em ranking\n');
    const before = await getDashboardMetrics();
    const observationJob = await createImportJobRecord({ fileName: 'official-observation-test.csv', originalFileName: 'official-observation-test.csv', importType: 'csv', importCategory: 'official_observations', storagePath: observationsPath });
    const affiliationJob = await createImportJobRecord({ fileName: 'affiliation-test.csv', originalFileName: 'affiliation-test.csv', importType: 'csv', importCategory: 'person_affiliations', storagePath: affiliationsPath });

    await executeImportJob(observationJob.id, { importCategory: 'official_observations' });
    await executeImportJob(affiliationJob.id, { importCategory: 'person_affiliations' });
    const metrics = await getDashboardMetrics();

    expect(metrics.totalLineageClaims).toBe(before.totalLineageClaims);
  });

  it('generates research tasks for observed people without lineage', async () => {
    const peoplePath = writeTempCsv('research-people.csv', 'person_id,full_name\nP-RESEARCH-1,Research Person\n');
    const observationsPath = writeTempCsv('research-observation.csv', 'observation_id,person_id,source_id,source_url,observation_type\nOBS-RESEARCH-1,P-RESEARCH-1,SRC-1,https://example.com,ranking oficial\n');
    const peopleJob = await createImportJobRecord({ fileName: 'research-people.csv', originalFileName: 'research-people.csv', importType: 'csv', importCategory: 'people', storagePath: peoplePath });
    const observationJob = await createImportJobRecord({ fileName: 'research-observation.csv', originalFileName: 'research-observation.csv', importType: 'csv', importCategory: 'official_observations', storagePath: observationsPath });

    await executeImportJob(peopleJob.id, { importCategory: 'people' });
    await executeImportJob(observationJob.id, { importCategory: 'official_observations' });
    const result = await generateCensusResearchTasks();
    const task = result.tasks.find((entry: any) => entry.personId === 'P-RESEARCH-1') as any;

    expect(task.type).toBe('Find black belt promotion source');
    expect(task.suggestedSearches[0]).toContain('black belt under');
  });

  it('exposes Historical Lineage Research v0.6 preset defaults', () => {
    const presets = getImportPresets();

    expect(presets.historicalLineageResearchV06.name).toBe('Historical Lineage Research v0.6');
    expect(presets.historicalLineageResearchV06.defaults.autoPublish).toBe(false);
  });

  it('creates an import readiness report', async () => {
    const report = await createImportReadinessReport({
      categories: {
        persons: [{ person_id: 'P1', full_name: 'A' }, { person_id: 'P2', full_name: 'A' }],
        organizations: [{ name: 'Alliance' }, { name: 'Alliance' }],
        sources: [{ url: 'https://example.com/a' }, { url: 'https://example.com/a' }],
        lineage_claims: [{ claim_id: 'C1', student_person_id: 'P1', promoter_person_id: 'MISSING' }],
        claim_evidence: []
      }
    });

    expect(report.possibleDuplicatePeople).toBe(1);
    expect(report.claimsWithMissingTeacher).toBe(1);
    expect(report.rowsRequiringReview).toBeGreaterThan(0);
  });

  it('canonicalizes organizations without losing branch data or aliases', () => {
    const canonical = createOrganization({ name: 'Atos Jiu-Jitsu', organizationType: 'team', aliases: ['Atos'], sources: ['source:atos-hq'], provenance: ['import-row:12'] });
    const branch = createOrganization({ name: 'Atos HQ', organizationType: 'academy_branch', city: 'San Diego', aliases: ['Atos San Diego'], sources: ['source:atos-hq-location'], provenance: ['import-row:13'] });

    const decision = canonicalizeOrganizationDuplicate({
      canonicalOrganizationId: canonical.id,
      duplicateOrganizationId: branch.id,
      aliases: ['Atos HQ'],
      relationshipType: 'organization_branch',
      notes: 'Branch remains distinct but points to the canonical team brand.'
    });

    expect(decision.canonical.aliases).toContain('Atos HQ');
    expect(decision.canonical.sources).toContain('source:atos-hq-location');
    expect(decision.duplicate.canonicalId).toBe(canonical.id);
    expect(decision.relationship?.relationshipType).toBe('organization_branch');
  });

  it('approves a single-promoter claim for public lineage', () => {
    const relationship = publishLineageRelationship({
      id: 'claim-kaynan-andre',
      studentPersonId: 'P0319',
      teacherPersonId: 'P0158',
      claimType: 'black_belt_awarded_by',
      relationshipLabel: 'Black belt awarded by',
      evidenceLevel: 'High',
      sourceUrls: ['https://atosjiujitsuhq.com/2018/06/06/kaynan-duarte-wins-double-gold-worlds-2018/'],
      reviewerNote: 'Atos HQ explicitly says Kaynan was awarded his black belt by Prof. Andre Galvao.'
    });

    expect(relationship.status).toBe('confirmed');
    expect(relationship.publicVisible).toBe(true);
    expect(listPublicLineageGraph().some((edge) => edge.id === 'claim-kaynan-andre')).toBe(true);
  });

  it('reclassifies a reviewed relationship when award language is not supported', () => {
    const relationship = publishLineageRelationship({
      id: 'claim-trained-under',
      studentPersonId: 'student-trained-under',
      teacherPersonId: 'teacher-trained-under',
      claimType: 'black_belt_awarded_by',
      relationshipLabel: 'Black belt awarded by',
      evidenceLevel: 'Medium',
      sourceUrls: ['https://example.com/profile'],
      reviewerNote: 'Initial publication test relationship.'
    });

    const reclassified = reclassifyRelationship(relationship.id, 'trained_under', 'Trained under', 'Source supports training under, not black belt award.');

    expect(reclassified.claimType).toBe('trained_under');
    expect(reclassified.relationshipLabel).toBe('Trained under');
  });

  it('keeps pending claims hidden from public person profiles', () => {
    const profile = getPublicPersonProfile('pending-student');

    expect(profile.lineageStatus).toBe('No verified lineage yet');
    expect(profile.publicRelationships.length).toBe(0);
  });

  it('shows approved claims on the public lineage graph', () => {
    const relationship = publishLineageRelationship({
      id: 'claim-nisar-andre',
      studentPersonId: 'P0426',
      teacherPersonId: 'P0158',
      claimType: 'black_belt_awarded_by',
      relationshipLabel: 'Black belt awarded by',
      evidenceLevel: 'High',
      sourceUrls: ['https://atosjiujitsuhq.com/2018/04/20/instructor-spotlight-nisar-loynab/'],
      reviewerNote: 'Atos HQ explicitly says Nisar received his black belt from Professor Andre Galvao.'
    });

    const graph = listPublicLineageGraph();

    expect(graph.some((edge) => edge.id === relationship.id)).toBe(true);
  });

  it('holds multiple teacher roles in a PromotionGroup without a false single-teacher public edge', () => {
    const group = createPromotionGroup({
      studentPersonId: 'P0321',
      title: 'Sarah Galvao black belt promotion review',
      status: 'under_editorial_review',
      teacherRoles: [
        { teacherPersonId: 'P0158', teacherName: 'Andre Galvao', role: 'awarded_by', claimId: 'R0361', status: 'pending_review' },
        { teacherPersonId: 'P0322', teacherName: 'Angelica Galvao', role: 'co_awarded_by', claimId: 'R0362', status: 'pending_review' }
      ],
      notes: 'Do not flatten into a single promoter until each role is confirmed.'
    });
    const profile = getPublicPersonProfile('P0321');
    const graph = listPublicLineageGraph();

    expect(group.teacherRoles.length).toBe(2);
    expect(profile.promotionGroups[0].publicLabel).toContain('multiple instructors');
    expect(graph.some((edge) => edge.studentPersonId === 'P0321')).toBe(false);
  });

  it('runs the BJJ Heroes connector dry-run in conservative mode', () => {
    const status = runBjjHeroesDryRun({ mode: 'conservative', limit: 10 });

    expect(status.connectorName).toBe('BJJ Heroes Discovery Connector');
    expect(status.profilesQueued).toBeGreaterThanOrEqual(10);
  });

  it('imports a manual BJJ Heroes URL as pending review candidates', async () => {
    resumeBjjHeroesConnector();
    const result = await importManualBjjHeroesProfile({
      profileUrl: 'https://www.bjjheroes.com/bjj-fighters/example-person',
      externalName: 'Example Person',
      listedTeamText: 'Example Team'
    });
    const imported = result as any;
    const records = await listImportImportedRecords(String(imported.candidateImportJobId));

    expect(result.reviewTasksCreated).toBeGreaterThanOrEqual(2);
    expect(records['External Fact Candidates'][0].status).toBe('pending review');
    expect(records['External Fact Candidates'][0].publicVisibility).toBe('not public');
    expect((records['External Fact Candidates'][0].sourceAttribution as any).source).toBe('BJJ Heroes');
  });

  it('pauses BJJ Heroes manual import when curator pauses connector', async () => {
    pauseBjjHeroesConnector('test pause');

    await expect(importManualBjjHeroesProfile({
      profileUrl: 'https://www.bjjheroes.com/bjj-fighters/paused-person',
      externalName: 'Paused Person'
    })).rejects.toThrow('paused');

    resumeBjjHeroesConnector();
    expect(getBjjHeroesStatus().paused).toBe(false);
  });

  it('blocks BJJ Heroes authorized partner mode without env authorization', () => {
    const previous = process.env.BJJHEROES_AUTHORIZED_PARTNER;
    delete process.env.BJJHEROES_AUTHORIZED_PARTNER;

    expect(() => runBjjHeroesDryRun({ mode: 'authorized_partner', limit: 30 })).toThrow('authorized_partner');

    if (previous !== undefined) process.env.BJJHEROES_AUTHORIZED_PARTNER = previous;
  });
});
