'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function BjjHeroesSourcePage() {
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState('Loading BJJ Heroes connector status...');

  const load = async () => {
    const response = await fetch(`${apiBase}/admin/sources/bjjheroes`);
    if (!response.ok) throw new Error('Unable to load connector status');
    setStatus(await response.json());
    setMessage('Connector status loaded.');
  };

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  const post = async (path: string, body: Record<string, unknown> = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Request failed');
    setStatus(payload);
    setMessage('Connector updated.');
  };

  const dryRun = async (event: FormEvent) => {
    event.preventDefault();
    await post('/admin/sources/bjjheroes/dry-run', { mode: 'conservative', limit: 10 });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Discovery source</p>
        <h1 className="mt-3 text-3xl font-semibold">BJJ Heroes Discovery Connector</h1>
        <p className="mt-2 text-slate-300">{message}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Catalog size discovered', status?.catalogSizeDiscovered ?? 0],
          ['Profiles queued', status?.profilesQueued ?? 0],
          ['Profiles fetched', status?.profilesFetched ?? 0],
          ['Profiles skipped', status?.profilesSkipped ?? 0],
          ['Duplicate candidates', status?.duplicateCandidates ?? 0],
          ['Potential lineage clues', status?.potentialLineageClues ?? 0],
          ['Review tasks created', status?.reviewTasksCreated ?? 0],
          ['Paused', status?.paused ? 'yes' : 'no']
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Controls</h2>
        <p className="mt-2 text-sm text-slate-400">{status?.rateLimitStatus ?? 'Rate limit not loaded.'}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form onSubmit={dryRun}>
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-white">Run 10-profile dry-run</button>
          </form>
          <button onClick={() => post('/admin/sources/bjjheroes/pause', { reason: 'Paused by curator from admin' })} className="rounded-lg border border-slate-700 px-4 py-2">Pause</button>
          <button onClick={() => post('/admin/sources/bjjheroes/resume')} className="rounded-lg border border-slate-700 px-4 py-2">Resume</button>
          <Link className="rounded-lg border border-slate-700 px-4 py-2" href="/admin/imports/bjjheroes">Manual profile import</Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Crawl logs</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          {(status?.crawlLogs ?? []).map((log: any) => (
            <div key={log.id} className="rounded border border-slate-800 bg-slate-950 p-3">
              <p>{log.message}</p>
              <p className="mt-1 text-slate-500">{log.createdAt} {log.sourceUrl ? `- ${log.sourceUrl}` : ''}</p>
            </div>
          ))}
          {!status?.crawlLogs?.length ? <p className="text-slate-400">No crawl logs yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
