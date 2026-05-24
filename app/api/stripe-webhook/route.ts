import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-04-22.dahlia',
})

/** Admin client — bypasses RLS. */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * POST /api/stripe-webhook
 *
 * Stripe sends signed events here. We verify the signature, then on
 * `checkout.session.completed` we set is_pro = true for the purchasing user.
 *
 * The user's Supabase ID is stored in `session.metadata.userId` when the
 * checkout session was created (see /api/create-checkout-session).
 *
 * Fallback: if metadata is missing we look up the user by email from the
 * customer_details object Stripe attaches to completed sessions.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  // Read raw body — required for Stripe signature verification.
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    console.error('[stripe-webhook] signature verification failed:', message)
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Preferred path: user ID stored in metadata during session creation.
    const userId = session.metadata?.userId

    if (userId) {
      await upsertPro(userId)
    } else {
      // Fallback: resolve user by email.
      const email = session.customer_details?.email ?? session.customer_email
      if (email) {
        await upsertProByEmail(email)
      } else {
        console.warn('[stripe-webhook] no userId or email found in session', session.id)
      }
    }
  }

  return NextResponse.json({ received: true })
}

/** Set is_pro = true for a known Supabase user ID. */
async function upsertPro(userId: string) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, is_pro: true }, { onConflict: 'id' })
  if (error) console.error('[stripe-webhook] upsertPro error:', error.message)
}

/**
 * Fallback: find the Supabase user by email (via profiles table) and upgrade them.
 * Requires `email` column on the profiles table.
 */
async function upsertProByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (error || !data) {
    console.error('[stripe-webhook] upsertProByEmail — user not found for email:', email)
    return
  }
  await upsertPro(data.id)
}
