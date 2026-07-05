'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const tabs = ['Overview', 'Preview Rows', 'Imported Records', 'Warnings & Errors', 'Duplicate Candidates', 'Review Queue', 'Report', 'Audit History'];

function parseJson(value: unknown) {
  if (!value || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(parseJson(value), null, 2)}</pre>;
}

export default function ImportJobDetailPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [detail, setDetail] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [records, setRecords] = useState<Record<string, any[]>>({});
  const [report, setReport] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [message, setMessage] = useState('Loading import job...');

  useEffect(() => {
    const load = async () => {
      const [detailResponse, rowsResponse, duplicateResponse, queueResponse, recordsResponse, reportResponse, auditResponse] = await Promise.all([
        fetch(`${apiBase}/imports/${params.id}/detail`),
        fetch(`${apiBase}/imports/${params.id}/rows`),
        fetch(`${apiBase}/imports/${params.id}/duplicates`),
        fetch(`${apiBase}/imports/${params.id}/review-queue`),
        fetch(`${apiBase}/imports/${params.id}/imported-records`),
        fetch(`${apiBase}/imports/${params.id}/report`),
        fetch(`${apiBase}/imports/${params.id}/audit-history`)
      ]);
      if (detailResponse.ok) setDetail(await detailResponse.json());
      if (rowsResponse.ok) setRows(await rowsResponse.json());
      if (duplicateResponse.ok) setDuplicates(await duplicateResponse.json());
      if (queueResponse.ok) setQueue(await queueResponse.json());
      if (recordsResponse.ok) setRecords(await recordsResponse.json());
      if (reportResponse.ok) setReport(await reportResponse.json());
      if (auditResponse.ok) setAudit(await auditResponse.json());
      setMessage('Import job loaded.');
    };
    load().catch(() => setMessage('Unable to load import job.'));
  }, [params.id]);

  const warnings = useMemo(() => rows.filter((row) => {
    const validation = parseJson(row.validationResult) as any;
    return row.status === 'review_required' || validation?.valid === false || validation?.warnings?.length || validation?.errors?.length;
  }), [rows]);

  const handleRollback = async () => {
    const response = await fetch(`${apiBase}/imports/${params.id}/rollback`, { method: 'POST' });
    const payload = await response.json();
    setMessage(payload.status ?? 'Rollback completed');
  };

  const handleDownload = async () => {
    const response = await fetch(`${apiBase}/imports/${params.id}/download`);
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = detail?.originalFileName ?? 'import-file';
      anchor.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Import job detail</p>
        <h1 className="mt-3 text-3xl font-semibold">{detail?.originalFileName ?? params.id}</h1>
        <p className="mt-2 text-slate-300">{message}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Status', detail?.status],
          ['Total rows', detail?.totalRows],
          ['Imported rows', detail?.importedRows],
          ['Needs review', detail?.reviewQueueItemsCreated],
          ['Failed rows', detail?.failedRows],
          ['Duplicates', detail?.duplicateCandidates],
          ['Rollback', detail?.rollbackStatus],
          ['Uploaded by', detail?.importingUser]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-100">{value ?? 'n/a'}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-lg px-3 py-2 text-sm ${activeTab === tab ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-semibold">Operational summary</h2>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {[
                ['Original file name', detail?.originalFileName],
                ['File type', detail?.fileType],
                ['Import category', detail?.importCategory],
                ['Upload date', detail?.uploadDate],
                ['CSV delimiter', detail?.selectedCsvDelimiter],
                ['XLSX worksheet', detail?.selectedXlsxWorksheet ?? 'n/a'],
                ['SQLite table', detail?.selectedSqliteTable ?? 'n/a'],
                ['Skipped rows', detail?.skippedRows]
              ].map(([label, value]) => (
                <div key={label}><dt className="text-slate-500">{label}</dt><dd>{value ?? 'n/a'}</dd></div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={handleRollback} className="rounded-lg border border-rose-700 px-4 py-2 text-rose-300 hover:bg-rose-950">Rollback</button>
              <button onClick={handleDownload} className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800">Download original</button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-semibold">Mapping and validation</h2>
            <JsonBlock value={{ mappedColumns: detail?.mappedColumns, validationSummary: detail?.validationSummary }} />
          </div>
        </section>
      ) : null}

      {activeTab === 'Preview Rows' ? (
        <section className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id ?? index} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="font-medium">Row {row.originalRowNumber} · {row.status}</p>
              <JsonBlock value={row.rawPayload} />
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === 'Imported Records' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {Object.entries(records).map(([group, items]) => (
            <div key={group} className="rounded-lg border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-xl font-semibold">{group}</h2>
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                {items.length ? items.map((record) => (
                  <div key={`${group}-${record.id}`} className="rounded-lg bg-slate-950 p-3">
                    <Link className="font-medium text-emerald-300" href={record.adminUrl}>{record.id}</Link>
                    <p>Status: {record.status} · Visibility: {record.publicVisibility}</p>
                    {record.badges?.length ? <p className="mt-2 flex flex-wrap gap-2">{record.badges.map((badge: string) => <span key={badge} className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{badge}</span>)}</p> : null}
                    {group === 'Lineage Claims' ? <p>Evidence count: {record.evidenceCount} · Source import row: {record.sourceImportRow}</p> : <p>Source import row: {record.sourceImportRow}</p>}
                  </div>
                )) : <p className="text-slate-500">No imported records in this group.</p>}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === 'Warnings & Errors' ? (
        <section className="space-y-3">
          {warnings.map((row) => <div key={row.id ?? row.originalRowNumber} className="rounded-lg border border-amber-800 bg-amber-950/30 p-4"><p>Row {row.originalRowNumber} · {row.status}</p><JsonBlock value={row.validationResult} /></div>)}
          {!warnings.length ? <p className="text-slate-400">No warnings or errors found for this import.</p> : null}
        </section>
      ) : null}

      {activeTab === 'Duplicate Candidates' ? (
        <section className="space-y-4">
          {duplicates.map((candidate) => (
            <div key={candidate.id} className="rounded-lg border border-slate-800 bg-slate-900 p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div><h3 className="font-semibold">Incoming record</h3><JsonBlock value={candidate.incomingRecord} /></div>
                <div><h3 className="font-semibold">Possible existing record</h3><JsonBlock value={candidate.possibleExistingRecord} /></div>
              </div>
              <p className="mt-3 text-sm text-slate-300">Confidence: {candidate.similarityConfidence} · Matching fields: {(candidate.matchingFields ?? []).join(', ') || 'n/a'} · Source row: {candidate.importSourceRow} · Suggested action: {candidate.suggestedAction}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white" href={candidate.openComparisonUrl}>Open person comparison</Link>
                <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Merge with existing person</button>
                <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Keep separate</button>
                <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Ignore candidate</button>
              </div>
            </div>
          ))}
          {!duplicates.length ? <p className="text-slate-400">No duplicate candidates for this import.</p> : null}
        </section>
      ) : null}

      {activeTab === 'Review Queue' ? (
        <section className="space-y-3">
          {queue.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="font-semibold text-slate-100">{item.type} · {item.priority}</p>
                <p>Related entity: {item.relatedEntity} · Source import row: {item.sourceImportRow} · Created: {item.createdDate} · Status: {item.status}</p>
                {item.suggestedSearches?.length ? <div className="mt-2 flex flex-wrap gap-2">{item.suggestedSearches.map((search: string) => <code key={search} className="rounded bg-slate-950 px-2 py-1 text-xs text-emerald-200">{search}</code>)}</div> : null}
              </div>
              <Link className="rounded-lg bg-emerald-600 px-3 py-2 text-white" href={item.openReviewUrl}>Open review</Link>
            </div>
          ))}
          {!queue.length ? <p className="text-slate-400">No review queue items for this import.</p> : null}
        </section>
      ) : null}

      {activeTab === 'Report' ? <section className="rounded-lg border border-slate-800 bg-slate-900 p-5"><JsonBlock value={report} /></section> : null}
      {activeTab === 'Audit History' ? (
        <section className="space-y-3">
          {audit.map((entry) => <div key={entry.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm"><p className="font-semibold">{entry.action}</p><p className="text-slate-400">{entry.createdAt} · {entry.entityType} · {entry.entityId}</p><JsonBlock value={entry.details} /></div>)}
        </section>
      ) : null}
    </main>
  );
}
