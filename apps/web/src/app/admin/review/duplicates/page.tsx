'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function DuplicateReviewPage() {
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [filters, setFilters] = useState({ entityType: '', importJobId: '', status: 'open', minConfidence: '', maxConfidence: '', country: '', organizationType: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('Loading duplicate candidates...');

  const load = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await fetch(`${apiBase}/review/duplicates?${params.toString()}`);
    if (response.ok) {
      const payload = await response.json();
      setDuplicates(payload);
      setMessage(`${payload.length} candidates loaded.`);
    }
  };

  useEffect(() => {
    load().catch(() => setMessage('Unable to load duplicate candidates.'));
  }, []);

  const handleFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelected([]);
    load().catch(() => setMessage('Unable to load duplicate candidates.'));
  };

  const bulk = async (action: 'ignore_low_confidence' | 'keep_separate' | 'needs_manual_review') => {
    const response = await fetch(`${apiBase}/review/duplicates/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected.length ? selected : undefined, filters: selected.length ? undefined : filters, action })
    });
    const payload = await response.json();
    setMessage(`${payload.updated} updated, ${payload.skipped} skipped. Bulk merge is disabled.`);
    setSelected([]);
    await load();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-10">
      <section className="border-b border-slate-800 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Duplicate Review</p>
        <h1 className="mt-3 text-3xl font-semibold">Duplicate Candidates</h1>
        <p className="mt-2 text-slate-300">{message}</p>
      </section>

      <form onSubmit={handleFilter} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 md:grid-cols-4">
        <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}>
          <option value="">All entity types</option>
          <option value="people">People</option>
          <option value="organizations">Organizations</option>
        </select>
        <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Import job" value={filters.importJobId} onChange={(event) => setFilters({ ...filters, importJobId: event.target.value })} />
        <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="manual_review">Manual review</option>
          <option value="ignored">Ignored</option>
          <option value="keep_separate">Keep separate</option>
        </select>
        <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Country" value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })} />
        <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Min confidence" value={filters.minConfidence} onChange={(event) => setFilters({ ...filters, minConfidence: event.target.value })} />
        <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Max confidence" value={filters.maxConfidence} onChange={(event) => setFilters({ ...filters, maxConfidence: event.target.value })} />
        <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Organization type" value={filters.organizationType} onChange={(event) => setFilters({ ...filters, organizationType: event.target.value })} />
        <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white" type="submit">Apply filters</button>
      </form>

      <section className="flex flex-wrap gap-3">
        <button onClick={() => bulk('ignore_low_confidence')} className="rounded-lg border border-slate-700 px-4 py-2">Mark low-confidence ignored</button>
        <button onClick={() => bulk('keep_separate')} className="rounded-lg border border-slate-700 px-4 py-2">Keep separate in bulk</button>
        <button onClick={() => bulk('needs_manual_review')} className="rounded-lg border border-slate-700 px-4 py-2">Needs manual review</button>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="p-3">Select</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Confidence</th>
              <th className="p-3">Source row</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {duplicates.map((candidate) => (
              <tr key={candidate.id} className="border-t border-slate-800 bg-slate-950/60">
                <td className="p-3"><input type="checkbox" checked={selected.includes(candidate.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, candidate.id] : selected.filter((id) => id !== candidate.id))} /></td>
                <td className="p-3">{candidate.entityType}</td>
                <td className="p-3">{candidate.confidence.toFixed(2)}</td>
                <td className="p-3">{candidate.importSourceRow ?? 'n/a'}</td>
                <td className="p-3">{candidate.status}</td>
                <td className="p-3"><Link className="text-emerald-300" href={candidate.openComparisonUrl}>Open comparison</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
