// Supabase project identifiers are public by design. These fallbacks keep
// browser authentication functional on managed hosts that inject environment
// variables only after Next.js has already produced its client bundle.
const PROJECT_SUPABASE_URL = 'https://vtpepbqukbswonovtocn.supabase.co';
const PROJECT_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_9vzVVe1EXLajukc5P0VVjw_d0lgvJC3';

export function getPublicSupabaseConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    PROJECT_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    PROJECT_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('Supabase Auth não está configurado para o painel editorial.');
  }
  return { url, publishableKey };
}
