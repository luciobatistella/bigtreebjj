'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';

type ImportJob = {
  id: string;
  originalFileName: string;
  status: string;
  importType: string;
  importCategory?: string;
  summary?: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function ImportAdminPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState('csv');
  const [importCategory, setImportCategory] = useState('people');
  const [delimiter, setDelimiter] = useState(',');
  const [worksheet, setWorksheet] = useState('');
  const [table, setTable] = useState('');
  const [message, setMessage] = useState('Upload a file to create a review-first import job.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [presets, setPresets] = useState<any>(null);

  const refreshJobs = async () => {
    const response = await fetch(`${apiBase}/imports`);
    if (response.ok) setJobs(await response.json());
  };

  useEffect(() => {
    refreshJobs().catch(() => undefined);
    fetch(`${apiBase}/imports/presets/research`).then((response) => response.json()).then(setPresets).catch(() => undefined);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setMessage('Choose a file before uploading.');
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('importType', importType);
    formData.append('importCategory', importCategory);
    formData.append('uploadedBy', 'admin');
    formData.append('options', JSON.stringify({ delimiter, worksheet: worksheet || undefined, table: table || undefined }));

    try {
      const response = await fetch(`${apiBase}/imports/upload`, { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Upload failed');
      setMessage(`Import job created: ${payload.id}`);
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-16">
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Import Center</p>
        <h1 className="mt-4 text-4xl font-semibold">Research Data Import</h1>
        <p className="mt-3 text-slate-300">Upload CSV, XLSX, or SQLite research files for review. Imports enter review and never publish automatically.</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-2xl font-semibold">Upload research file</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm text-slate-300">
              Import preset
              <select className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" defaultValue="Historical Research Dataset">
                <option value="Historical Research Dataset">Historical Research Dataset</option>
              </select>
            </label>
            <p className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-100">
              {presets?.protectedPreset?.name ?? 'Historical Research Dataset'} keeps lineage claims pending, evidence private, duplicates review-required, and claims unpublished.
            </p>
            <label className="block text-sm text-slate-300">
              File
              <input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" type="file" accept=".csv,.xlsx,.sqlite,.db" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <label className="block text-sm text-slate-300">
              Import type
              <select className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={importType} onChange={(event) => setImportType(event.target.value)}>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
                <option value="sqlite">SQLite</option>
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Category
              <select className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={importCategory} onChange={(event) => setImportCategory(event.target.value)}>
                <option value="people">People Dataset</option>
                <option value="organizations">Organizations Dataset</option>
                <option value="sources">Sources Dataset</option>
                <option value="lineage_claims">Lineage Claims Dataset</option>
                <option value="evidence">Evidence Dataset</option>
              </select>
            </label>
            {importType === 'csv' ? <label className="block text-sm text-slate-300">Delimiter<input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={delimiter} onChange={(event) => setDelimiter(event.target.value)} placeholder="," /></label> : null}
            {importType === 'xlsx' ? <label className="block text-sm text-slate-300">Worksheet name<input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={worksheet} onChange={(event) => setWorksheet(event.target.value)} placeholder="Sheet1" /></label> : null}
            {importType === 'sqlite' ? <label className="block text-sm text-slate-300">Table name<input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={table} onChange={(event) => setTable(event.target.value)} placeholder="people" /></label> : null}
            <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-700/70" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Create import job'}
            </button>
            <p className="text-sm text-slate-400">{message}</p>
          </div>
        </form>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-2xl font-semibold">Recent imports</h2>
          <div className="mt-4 space-y-3 text-slate-300">
            {jobs.length === 0 ? <p className="text-sm text-slate-400">No imports yet.</p> : jobs.map((job) => (
              <Link key={job.id} href={`/admin/imports/${job.id}`} className="block rounded-lg border border-slate-800 bg-slate-950 p-4 hover:bg-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{job.originalFileName}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">{job.status}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{job.importType} · {job.importCategory ?? 'people'}</p>
                {job.summary ? <p className="mt-2 text-sm text-slate-500">{job.summary}</p> : null}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
