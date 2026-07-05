export default function ReviewAdminPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-16">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">Review Queue</p>
        <h1 className="mt-4 text-4xl font-semibold">Editorial Review</h1>
        <p className="mt-3 text-slate-300">Approve, reject, dispute, request more evidence, and manage duplicates for imported claims.</p>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
        <h2 className="text-2xl font-semibold">Review actions</h2>
        <ul className="mt-4 space-y-2 text-slate-300">
          <li>Approve lineage claim</li>
          <li>Reject claim</li>
          <li>Mark as disputed</li>
          <li>Request more evidence</li>
          <li>Merge duplicate people</li>
        </ul>
      </section>
    </main>
  );
}
