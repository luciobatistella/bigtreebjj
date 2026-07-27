import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './config';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, publishableKey } = getPublicSupabaseConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
