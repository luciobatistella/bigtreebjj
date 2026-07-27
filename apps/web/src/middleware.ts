import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function isAdminUser(user: { email?: string; app_metadata?: Record<string, unknown> }) {
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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isLogin = request.nextUrl.pathname === '/admin/login';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    if (isLogin) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    loginUrl.searchParams.set('error', 'configuration');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        response.headers.set('Cache-Control', 'private, no-store');
      }
    }
  });
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!isLogin && (!user || !isAdminUser(user))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login';
    loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    if (user) loginUrl.searchParams.set('error', 'forbidden');
    return NextResponse.redirect(loginUrl);
  }
  if (isLogin && user && isAdminUser(user)) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = '/admin';
    adminUrl.search = '';
    return NextResponse.redirect(adminUrl);
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*']
};
