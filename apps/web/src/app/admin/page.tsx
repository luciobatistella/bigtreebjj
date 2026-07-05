'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function AdminPage() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch(`${apiBase}/admin/metrics`).then((response) => response.json()).then(setMetrics).catch(() => undefined);
  }, []);

  const cards = [
    ['Total People', metrics?.totalPeople],
    ['Total Organizations', metrics?.totalOrganizations],
    ['Total Sources', metrics?.totalSources],
    ['Total Lineage Claims', metrics?.totalLineageClaims],
    ['Confirmed Claims', metrics?.confirmedClaims],
    ['Pending Claims', metrics?.pendingClaims],
    ['Open Review Tasks', metrics?.openReviewTasks],
    ['Open Duplicate Candidates', metrics?.openDuplicateCandidates],
    ['Recent Imports', metrics?.recentImports?.length ?? 0]
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Admin panel</p>
        <h1 className="mt-3 text-3xl font-semibold">Administration</h1>
        <p className="mt-2 text-slate-300">Operational review, imports, duplicates, and claim approval.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value ?? '...'}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Import Health</h2>
          <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div><dt className="text-slate-500">Latest import status</dt><dd>{metrics?.importHealth?.latestImportStatus ?? 'none'}</dd></div>
            <div><dt className="text-slate-500">Rows needing review</dt><dd>{metrics?.importHealth?.rowsNeedingReview ?? 0}</dd></div>
            <div><dt className="text-slate-500">Failed import rows</dt><dd>{metrics?.importHealth?.failedImportRows ?? 0}</dd></div>
            <div><dt className="text-slate-500">Unresolved references</dt><dd>{metrics?.importHealth?.unresolvedReferences ?? 0}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Workspace</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-lg border border-slate-700 px-4 py-3 hover:bg-slate-800" href="/admin/imports">Import Center</Link>
            <Link className="rounded-lg border border-slate-700 px-4 py-3 hover:bg-slate-800" href="/admin/review">Review Queue</Link>
            <Link className="rounded-lg border border-slate-700 px-4 py-3 hover:bg-slate-800" href="/admin/review/duplicates">Duplicate Review</Link>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Recent Imports</h2>
        <div className="mt-4 space-y-3">
          {(metrics?.recentImports ?? []).map((job: any) => (
            <Link key={job.id} href={`/admin/imports/${job.id}`} className="block rounded-lg bg-slate-950 p-3 hover:bg-slate-800">
              <p className="font-medium">{job.originalFileName}</p>
              <p className="text-sm text-slate-400">{job.status} · {job.importType} · {job.importCategory ?? 'people'}</p>
            </Link>
          ))}
          {!metrics?.recentImports?.length ? <p className="text-sm text-slate-400">No imports yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
