'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '../../i18n/locale';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const copy = {
  pt: {
    confirm: 'Aprovar esta descoberta como um registro local de pessoa? Os indícios de linhagem e afiliação continuarão aguardando revisão.',
    notes: 'Aprovado pelo perfil de descoberta',
    failed: 'Falha ao aprovar',
    approved: 'Pessoa aprovada. Recarregando o perfil local...',
    approving: 'Aprovando...',
    approve: 'Aprovar registro da pessoa'
  },
  en: {
    confirm: 'Approve this discovery as a local person record? Lineage and affiliation clues will remain pending review.',
    notes: 'Approved from discovery profile',
    failed: 'Approval failed',
    approved: 'Person approved. Reloading local profile...',
    approving: 'Approving...',
    approve: 'Approve person record'
  }
} as const;

export function ApproveDiscoveryButton({ externalProfileId, locale }: { externalProfileId: string; locale: Locale }) {
  const router = useRouter();
  const text = copy[locale];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const approve = async () => {
    if (!window.confirm(text.confirm)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/external-profiles/${externalProfileId}/approve-person`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: text.notes })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? text.failed);
      setMessage(text.approved);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <button disabled={busy} onClick={approve} className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700">
        {busy ? text.approving : text.approve}
      </button>
      {message ? <p className="mt-2 text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
