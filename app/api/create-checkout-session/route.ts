import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-04-22.dahlia',
})

/** Admin Supabase client to verify the user token server-side. */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe secret key not configured' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Optionally resolve the logged-in user to embed their ID in Stripe metadata.
  // This lets the webhook update the correct profile without relying on email.
  let userId: string | undefined
  let userEmail: string | undefined
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    userId    = user?.id
    userEmail = user?.email
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    ...(userEmail ? { customer_email: userEmail } : {}),
    metadata: userId ? { userId } : {},
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Chess Pro',
            description: 'Advanced AI Coach, custom themes, priority matchmaking & more.',
          },
          unit_amount: 499, // $4.99
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/success`,
    cancel_url: `${baseUrl}/pricing`,
  })

  return NextResponse.json({ url: session.url })
}
