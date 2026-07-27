'use client';

import { createSupabaseBrowserClient } from './supabase/browser';

const adminApiProxy = '/api/admin/backend';

export class AdminSessionError extends Error {
  constructor(message = 'Sua sessão editorial expirou.') {
    super(message);
    this.name = 'AdminSessionError';
  }
}

export function goToAdminLogin(nextPath?: string) {
  const next = nextPath ?? `${window.location.pathname}${window.location.search}`;
  window.location.href = `/admin/login?next=${encodeURIComponent(next)}`;
}

export async function adminApiFetch(
  path: string,
  init: RequestInit = {},
  allowRefresh = true
): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  let {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session && allowRefresh) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
  }
  if (!session?.access_token) throw new AdminSessionError();

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${adminApiProxy}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? 'no-store'
  });
  if (response.status === 401 && allowRefresh) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session) return adminApiFetch(path, init, false);
  }
  if (response.status === 401 || response.status === 403) {
    throw new AdminSessionError(
      response.status === 403
        ? 'Seu usuário não possui permissão editorial.'
        : 'Sua sessão editorial expirou.'
    );
  }
  return response;
}
