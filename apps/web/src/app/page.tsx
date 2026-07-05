"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

const stats = [
  { label: 'People', value: '0' },
  { label: 'Relationships', value: '0' },
  { label: 'Sources', value: '0' },
  { label: 'Confirmed', value: '0' }
];

const evidenceLevels = [
  'Primary source',
  'Official federation',
  'Official academy or team',
  'Athlete statement',
  'Teacher statement',
  'Specialized source',
  'Community submission',
  'Unverified'
];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      router.push('/people/eddie-bravo');
      return;
    }

    if (normalized.includes('eddie') || normalized.includes('bravo')) {
      router.push('/people/eddie-bravo');
      return;
    }

    if (normalized.includes('demian') || normalized.includes('maia')) {
      router.push('/people/demian-maia');
      return;
    }

    router.push(`/people/${encodeURIComponent(normalized.replace(/\s+/g, '-'))}`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-16">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Local-first lineage archive</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">The Big Tree BJJ</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-300">The Global Jiu-Jitsu Lineage Database</p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
            placeholder="Search people, instructors, academies, teams, or federations"
          />
          <button type="submit" className="rounded-lg bg-emerald-500 px-4 py-3 font-medium text-slate-950">Search</button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-3xl font-semibold">{stat.value}</div>
            <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
          <h2 className="text-2xl font-semibold">Evidence levels</h2>
          <ul className="mt-4 space-y-2 text-slate-300">
            {evidenceLevels.map((level) => (
              <li key={level} className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">{level}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
          <h2 className="text-2xl font-semibold">Quick links</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Link className="rounded-lg border border-slate-800 px-4 py-3 hover:bg-slate-800" href="/people/eddie-bravo">Person profile demo</Link>
            <Link className="rounded-lg border border-slate-800 px-4 py-3 hover:bg-slate-800" href="/admin">Admin panel</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
