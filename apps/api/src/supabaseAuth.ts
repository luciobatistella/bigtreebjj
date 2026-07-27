import { createClient, type User } from '@supabase/supabase-js';

export type AdminIdentity = {
  id: string;
  email: string;
  role: 'admin';
};

export class AdminAuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.statusCode = statusCode;
  }
}

function allowedAdminEmails() {
  return new Set(
    [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminUser(
  user: Pick<User, 'id' | 'email' | 'app_metadata'>,
  explicitEmails = allowedAdminEmails()
) {
  const email = user.email?.trim().toLowerCase();
  const declaredRole = String(user.app_metadata?.role ?? user.app_metadata?.user_role ?? '').toLowerCase();
  return declaredRole === 'admin' || Boolean(email && explicitEmails.has(email));
}

let supabaseAuthClient: ReturnType<typeof createClient> | null = null;

function getSupabaseAuthClient() {
  if (supabaseAuthClient) return supabaseAuthClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new AdminAuthError('Supabase Auth não está configurado no servidor.', 503);
  }
  supabaseAuthClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  return supabaseAuthClient;
}

export async function verifySupabaseAdminToken(token?: string): Promise<AdminIdentity> {
  if (!token) {
    throw new AdminAuthError('Sessão editorial ausente.', 401);
  }
  const {
    data: { user },
    error
  } = await getSupabaseAuthClient().auth.getUser(token);
  if (error || !user) {
    throw new AdminAuthError('Sessão editorial inválida ou expirada.', 401);
  }
  if (!isAdminUser(user)) {
    throw new AdminAuthError('Este usuário não possui acesso editorial.', 403);
  }
  return {
    id: user.id,
    email: user.email ?? 'admin',
    role: 'admin'
  };
}
