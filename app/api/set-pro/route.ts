import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** Admin client — bypasses RLS using the service role key. */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * GET /api/set-pro
 *
 * Called from the success page after a Stripe checkout redirect.
 * Requires `Authorization: Bearer <access_token>` header.
 * Upserts is_pro = true into the profiles table for the authenticated user.
 */
export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  // Extract bearer token from the Authorization header.
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the token with Supabase and get the user.
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Upsert so it works whether or not a profile row exists yet.
  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email, is_pro: true },
      { onConflict: 'id' },
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
