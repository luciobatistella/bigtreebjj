'use client';

import Link from 'next/link';
import { FormEvent, useEffect, MouseEvent, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function BjjHeroesImportPage() {
  const [profileUrl, setProfileUrl] = useState('');
  const [externalName, setExternalName] = useState('');
  const [listedTeamText, setListedTeamText] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState('Manual profile URL import creates pending review candidates only.');

  const load = async () => {
    const response = await fetch(`${apiBase}/admin/imports/bjjheroes`);
    if (response.ok) setStatus(await response.json());
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent, dryRun = false) => {
    event.preventDefault();
    const response = await fetch(`${apiBase}/admin/imports/bjjheroes/manual-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileUrl, externalName, listedTeamText, dryRun })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? 'Import failed');
      return;
    }
    setStatus(payload);
    setMessage(dryRun ? 'Dry-run completed without creating import rows.' : `Pending review import created: ${payload.candidateImportJobId}`);
  };

  const dryRun = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const response = await fetch(`${apiBase}/admin/imports/bjjheroes/manual-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileUrl, externalName, listedTeamText, dryRun: true })
    });
    const payload = await response.json();
    setStatus(payload);
    setMessage(response.ok ? 'Dry-run completed without creating import rows.' : payload.error ?? 'Dry-run failed');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">BJJ Heroes import</p>
        <h1 className="mt-3 text-3xl font-semibold">Manual Profile URL Import</h1>
        <p className="mt-2 text-slate-300">{message}</p>
      </section>

      <form className="rounded-lg border border-slate-800 bg-slate-900 p-5" onSubmit={(event) => submit(event, false)}>
        <h2 className="text-xl font-semibold">Profile URL</h2>
        <div className="mt-4 grid gap-4">
          <label className="text-sm text-slate-300">BJJ Heroes profile URL<input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="https://www.bjjheroes.com/bjj-fighters/name" /></label>
          <label className="text-sm text-slate-300">External name<input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={externalName} onChange={(event) => setExternalName(event.target.value)} /></label>
          <label className="text-sm text-slate-300">Listed team text<input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={listedTeamText} onChange={(event) => setListedTeamText(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-white" type="submit">Create pending review import</button>
          <button className="rounded-lg border border-slate-700 px-4 py-2" type="button" onClick={dryRun}>Dry-run URL</button>
          {status?.lastImportJobId ? <Link className="rounded-lg border border-slate-700 px-4 py-2" href={`/admin/imports/${status.lastImportJobId}`}>Open last import</Link> : null}
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Profiles queued', status?.profilesQueued ?? 0],
          ['Profiles fetched', status?.profilesFetched ?? 0],
          ['Profiles skipped', status?.profilesSkipped ?? 0],
          ['Review tasks created', status?.reviewTasksCreated ?? 0]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </section>
    </main>
  );
}
