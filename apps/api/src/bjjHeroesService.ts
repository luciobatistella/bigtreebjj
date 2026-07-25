import { promises as fs } from 'fs';
import path from 'path';
import { createImportJobRecord, executeImportJob } from './importService.js';

type ConnectorStatus = {
  connectorName: string;
  mode: 'conservative' | 'authorized_partner';
  paused: boolean;
  catalogSizeDiscovered: number;
  profilesQueued: number;
  profilesFetched: number;
  profilesSkipped: number;
  rateLimitStatus: string;
  duplicateCandidates: number;
  potentialLineageClues: number;
  reviewTasksCreated: number;
  crawlLogs: Array<Record<string, unknown>>;
  lastImportJobId?: string;
};

const status: ConnectorStatus = {
  connectorName: 'BJJ Heroes Discovery Connector',
  mode: 'conservative',
  paused: false,
  catalogSizeDiscovered: 0,
  profilesQueued: 0,
  profilesFetched: 0,
  profilesSkipped: 0,
  rateLimitStatus: '8s delay plus 2-5s jitter; one request at a time',
  duplicateCandidates: 0,
  potentialLineageClues: 0,
  reviewTasksCreated: 0,
  crawlLogs: []
};

function log(message: string, level = 'info', sourceUrl?: string) {
  status.crawlLogs.unshift({ id: `crawl-log-${Date.now()}-${status.crawlLogs.length}`, level, message, sourceUrl, createdAt: new Date().toISOString() });
  status.crawlLogs = status.crawlLogs.slice(0, 50);
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function validateMode(mode = 'conservative') {
  if (mode === 'authorized_partner' && process.env.BJJHEROES_AUTHORIZED_PARTNER !== 'true') {
    throw new Error('authorized_partner mode requires BJJHEROES_AUTHORIZED_PARTNER=true');
  }
  if (mode !== 'conservative' && mode !== 'authorized_partner') {
    throw new Error('mode must be conservative or authorized_partner');
  }
  return mode as ConnectorStatus['mode'];
}

async function writeRowsCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  const dir = path.resolve(process.cwd(), 'data/generated/bjjheroes');
  await fs.mkdir(dir, { recursive: true });
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, csv, 'utf-8');
  return filePath;
}

export function getBjjHeroesStatus() {
  return status;
}

export function pauseBjjHeroesConnector(reason = 'Paused by curator') {
  status.paused = true;
  log(reason, 'warn');
  return status;
}

export function resumeBjjHeroesConnector() {
  status.paused = false;
  log('Resumed by curator');
  return status;
}

export function runBjjHeroesDryRun(input: { mode?: string; limit?: number; profileUrl?: string }) {
  const mode = validateMode(input.mode);
  const limit = input.limit ?? 10;
  if (mode === 'conservative' && limit > 20) {
    throw new Error('conservative mode limit cannot exceed 20 profiles');
  }
  status.mode = mode;
  status.catalogSizeDiscovered = Math.max(status.catalogSizeDiscovered, input.profileUrl ? 1 : limit);
  status.profilesQueued += input.profileUrl ? 1 : limit;
  status.profilesSkipped += input.profileUrl ? 1 : 0;
  log(`Dry-run completed for ${input.profileUrl ?? `${limit} catalogue entries`}`, 'info', input.profileUrl);
  return { ...status, dryRun: true };
}

export async function importManualBjjHeroesProfile(input: { profileUrl: string; externalName?: string; nickname?: string; listedTeamText?: string; dryRun?: boolean }) {
  if (!input.profileUrl.includes('bjjheroes.com')) {
    throw new Error('Manual profile URL must be a BJJ Heroes URL');
  }
  if (status.paused) {
    throw new Error('BJJ Heroes connector is paused');
  }
  status.profilesQueued += 1;
  if (input.dryRun) {
    status.profilesSkipped += 1;
    log('Manual profile dry-run skipped import creation', 'info', input.profileUrl);
    return { ...status, dryRun: true };
  }
  const now = new Date().toISOString();
  const profileRow = {
    source_name: 'BJJ Heroes',
    source_profile_url: input.profileUrl,
    external_name: input.externalName ?? input.profileUrl.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? 'BJJ Heroes profile',
    nickname: input.nickname ?? '',
    listed_team_text: input.listedTeamText ?? '',
    captured_at: now,
    source_status: 'manual_url_pending_fetch',
    raw_hash: 'not_fetched_manual_url',
    created_at: now,
    status: 'pending_review',
    evidence_level: 'specialized_source',
    source_attribution: JSON.stringify({ source: 'BJJ Heroes', source_url: input.profileUrl, use: 'Specialized discovery source', editorial_status: 'Requires review before lineage publication' })
  };
  const candidateRow = {
    external_profile_id: profileRow.source_profile_url,
    candidate_type: 'person_discovery',
    subject_name: profileRow.external_name,
    object_name: '',
    structured_value: JSON.stringify({ source_profile_url: input.profileUrl, listed_team_text: input.listedTeamText ?? '' }),
    source_url: input.profileUrl,
    source_locator: 'manual profile URL',
    evidence_level: 'specialized_source',
    status: 'pending_review',
    confidence_score: '0.6',
    imported_at: now,
    source_name: 'BJJ Heroes',
    source_attribution: profileRow.source_attribution
  };
  const profileCsv = await writeRowsCsv(`bjjheroes-profile-${Date.now()}.csv`, [profileRow]);
  const candidateCsv = await writeRowsCsv(`bjjheroes-fact-candidate-${Date.now()}.csv`, [candidateRow]);
  const profileJob = await createImportJobRecord({ fileName: path.basename(profileCsv), originalFileName: path.basename(profileCsv), importType: 'csv', importCategory: 'external_source_profiles', storagePath: profileCsv, uploadedBy: 'bjjheroes-connector', options: { preset: 'BJJ Heroes Discovery Connector', reviewFirst: true } });
  await executeImportJob(profileJob.id as string, { importCategory: 'external_source_profiles' });
  const candidateJob = await createImportJobRecord({ fileName: path.basename(candidateCsv), originalFileName: path.basename(candidateCsv), importType: 'csv', importCategory: 'external_fact_candidates', storagePath: candidateCsv, uploadedBy: 'bjjheroes-connector', options: { preset: 'BJJ Heroes Discovery Connector', reviewFirst: true } });
  await executeImportJob(candidateJob.id as string, { importCategory: 'external_fact_candidates' });
  status.profilesFetched += 1;
  status.potentialLineageClues += input.listedTeamText ? 1 : 0;
  status.reviewTasksCreated += 2;
  status.lastImportJobId = candidateJob.id as string;
  log('Manual BJJ Heroes profile imported as pending review candidates', 'info', input.profileUrl);
  return { ...status, profileImportJobId: profileJob.id, candidateImportJobId: candidateJob.id };
}
