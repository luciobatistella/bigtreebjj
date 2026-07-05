'use client';

import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(value, null, 2)}</pre>;
}

export default function DuplicateComparisonPage({ params }: { params: { id: string } }) {
  const [duplicate, setDuplicate] = useState<any>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('Loading duplicate candidate...');

  const load = async () => {
    const response = await fetch(`${apiBase}/review/duplicates/${params.id}`);
    if (response.ok) {
      setDuplicate(await response.json());
      setMessage('Duplicate candidate loaded.');
    } else {
      setMessage('Duplicate candidate not found.');
    }
  };

  useEffect(() => {
    load().catch(() => setMessage('Unable to load duplicate candidate.'));
  }, [params.id]);

  const decide = async (action: 'merge' | 'keep-separate' | 'uncertain') => {
    if (action === 'merge' && !window.confirm('Merge these people and preserve aliases, sources, ImportRows, and ChangeHistory?')) return;
    const response = await fetch(`${apiBase}/review/duplicates/${params.id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: note })
    });
    const payload = await response.json();
    setMessage(`${payload.action} saved. Status: ${payload.status}`);
    await load();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Person comparison</p>
        <h1 className="mt-3 text-3xl font-semibold">Duplicate Candidate</h1>
        <p className="mt-2 text-slate-300">{message}</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Incoming Person</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-300">
            <div><dt className="text-slate-500">Name</dt><dd>{duplicate?.incomingPerson?.full_name ?? duplicate?.incomingPerson?.name ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Aliases</dt><dd>{(duplicate?.incomingPerson?.aliases ?? duplicate?.incomingPerson?.nicknames ?? []).join?.(', ') ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Country</dt><dd>{duplicate?.incomingPerson?.country ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">City</dt><dd>{duplicate?.incomingPerson?.city ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Team</dt><dd>{duplicate?.incomingPerson?.team ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Source</dt><dd>{duplicate?.incomingPerson?.source ?? 'import'}</dd></div>
            <div><dt className="text-slate-500">Import row</dt><dd>{duplicate?.importRow ?? 'n/a'}</dd></div>
          </dl>
          <JsonBlock value={duplicate?.incomingPerson ?? {}} />
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Existing Person</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-300">
            <div><dt className="text-slate-500">Name</dt><dd>{duplicate?.existingPerson?.full_name ?? duplicate?.existingPerson?.name ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Aliases</dt><dd>{(duplicate?.existingPerson?.aliases ?? duplicate?.existingPerson?.nicknames ?? []).join?.(', ') ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Country</dt><dd>{duplicate?.existingPerson?.country ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">City</dt><dd>{duplicate?.existingPerson?.city ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Team</dt><dd>{duplicate?.existingPerson?.team ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Existing sources</dt><dd>{duplicate?.existingPerson?.source ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Existing history</dt><dd>{duplicate?.existingPerson?.history ?? 'n/a'}</dd></div>
          </dl>
          <JsonBlock value={duplicate?.existingPerson ?? {}} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Reviewer actions</h2>
        <textarea className="mt-4 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add internal note" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => decide('merge')} className="rounded-lg bg-emerald-600 px-4 py-2 text-white">Merge</button>
          <button onClick={() => decide('keep-separate')} className="rounded-lg border border-slate-700 px-4 py-2">Keep separate</button>
          <button onClick={() => decide('uncertain')} className="rounded-lg border border-slate-700 px-4 py-2">Mark uncertain</button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Audit history</h2>
        <JsonBlock value={duplicate?.auditHistory ?? []} />
      </section>
    </main>
  );
}
