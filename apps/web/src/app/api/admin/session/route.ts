import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isAdminUser } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    if (!isAdminUser(user)) {
      return NextResponse.json({ authenticated: true, authorized: false }, { status: 403 });
    }
    return NextResponse.json({
      authenticated: true,
      authorized: true,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: (error as Error).message },
      { status: 503 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Cookie cleanup below is handled by the Supabase server client when configured.
  }
  return NextResponse.json({ signedOut: true });
}
