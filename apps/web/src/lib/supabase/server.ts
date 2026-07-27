import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from './config';

export function isAdminUser(user: Pick<User, 'email' | 'app_metadata'>) {
  const email = user.email?.trim().toLowerCase();
  const allowedEmails = new Set(
    [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
  const role = String(user.app_metadata?.role ?? user.app_metadata?.user_role ?? '').toLowerCase();
  return role === 'admin' || Boolean(email && allowedEmails.has(email));
}

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const { url, publishableKey } = getPublicSupabaseConfig();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Middleware refreshes them.
        }
      }
    }
  });
}
