'use client';

import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(value, null, 2)}</pre>;
}

export default function ClaimReviewPage({ params }: { params: { id: string } }) {
  const [claim, setClaim] = useState<any>(null);
  const [note, setNote] = useState('');
  const [evidenceLevel, setEvidenceLevel] = useState('');
  const [message, setMessage] = useState('Loading claim...');

  const load = async () => {
    const response = await fetch(`${apiBase}/review/claims/${params.id}`);
    if (response.ok) {
      const payload = await response.json();
      setClaim(payload);
      setEvidenceLevel(payload.evidenceLevel ?? 'imported');
      setMessage('Claim loaded.');
    } else {
      setMessage('Claim not found.');
    }
  };

  useEffect(() => {
    load().catch(() => setMessage('Unable to load claim.'));
  }, [params.id]);

  const decide = async (action: 'approve' | 'reject' | 'dispute' | 'request-evidence') => {
    if (action === 'approve' && claim?.claimType === 'black_belt_awarded_by' && !window.confirm('Approve this black belt promotion claim?')) return;
    const response = await fetch(`${apiBase}/review/claims/${params.id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: note, evidenceLevel })
    });
    const payload = await response.json();
    setMessage(`${payload.action} saved. Status: ${payload.status}`);
    await load();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Claim review</p>
        <h1 className="mt-3 text-3xl font-semibold">{claim?.student ?? 'Lineage claim'} to {claim?.teacher ?? 'teacher'}</h1>
        <p className="mt-2 text-slate-300">{message}</p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Claim details</h2>
          <dl className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div><dt className="text-slate-500">Student</dt><dd>{claim?.student ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Teacher</dt><dd>{claim?.teacher ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Claim type</dt><dd>{claim?.claimType ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Promotion group</dt><dd>{claim?.promotionGroup ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Evidence level</dt><dd>{claim?.evidenceLevel ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd>{claim?.status ?? 'n/a'}</dd></div>
            <div><dt className="text-slate-500">Imported source row</dt><dd>{claim?.importedSourceRow ?? 'n/a'}</dd></div>
          </dl>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Sources and evidence</h2>
          <JsonBlock value={{ linkedSources: claim?.linkedSources ?? [], evidenceUrls: claim?.evidenceUrls ?? [] }} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold">Reviewer actions</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.4fr_1fr]">
          <label className="text-sm text-slate-300">Evidence level<select className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={evidenceLevel} onChange={(event) => setEvidenceLevel(event.target.value)}>
            <option value="imported">Imported</option>
            <option value="community_submission">Community submission</option>
            <option value="primary_source">Primary source</option>
            <option value="official_record">Official record</option>
          </select></label>
          <label className="text-sm text-slate-300">Internal notes<textarea className="mt-2 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950 p-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add reviewer note" /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => decide('approve')} className="rounded-lg bg-emerald-600 px-4 py-2 text-white">Approve</button>
          <button onClick={() => decide('reject')} className="rounded-lg border border-rose-700 px-4 py-2 text-rose-300">Reject</button>
          <button onClick={() => decide('dispute')} className="rounded-lg border border-slate-700 px-4 py-2">Mark disputed</button>
          <button onClick={() => decide('request-evidence')} className="rounded-lg border border-slate-700 px-4 py-2">Request evidence</button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Internal notes</h2>
          <p className="mt-3 text-sm text-slate-300">{claim?.internalNotes || 'No internal notes yet.'}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-xl font-semibold">Audit history</h2>
          <JsonBlock value={claim?.auditHistory ?? []} />
        </div>
      </section>
    </main>
  );
}
