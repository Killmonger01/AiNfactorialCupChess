'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const FREE_FEATURES = [
  'Play vs AI',
  'Game history',
  'Basic board themes',
  'Online multiplayer',
]

const PRO_FEATURES = [
  'Everything in Free',
  '🎨 Custom piece skins & board themes',
  '🤖 Advanced AI Coach analysis',
  '⚡ Priority matchmaking',
  '🏆 Leaderboard highlights',
]

export default function PricingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    try {
      // Pass the user's access token so the server can embed their ID in Stripe metadata.
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch('/api/create-checkout-session', { method: 'POST', headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create session')
      if (data.url) window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      {/* Header */}
      <header
        className="w-full px-6 py-3.5 flex items-center justify-between flex-shrink-0"
        style={{
          background: 'rgba(7,11,15,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(16,185,129,0.1)',
        }}
      >
        <Link href="/" style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, textDecoration: 'none', fontFamily: "'Outfit', sans-serif" }}>
          <span style={{ color: '#10b981' }}>♟</span>{' '}Chess
        </Link>
        <Link
          href="/"
          className="text-sm font-medium transition-all duration-200"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}
        >
          ← Back to Game
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <h1
            className="text-4xl font-extrabold mb-4"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}
          >
            Simple, honest pricing
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            Start free. Upgrade when you&apos;re ready.
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
          {/* Free Card */}
          <div
            className="flex-1 flex flex-col p-8 rounded-2xl"
            style={{
              background: 'rgba(13,21,32,0.8)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="mb-6">
              <span
                className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
              >
                Free
              </span>
            </div>
            <div className="mb-6">
              <span style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>$0</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>/mo</span>
            </div>
            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>✓</span>
                  <span style={{ fontSize: '0.95rem' }}>{f}</span>
                </li>
              ))}
            </ul>
            <button
              disabled
              className="w-full py-3 rounded-xl text-sm font-semibold cursor-not-allowed"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid #2a3550',
                color: '#4a5568',
              }}
            >
              Current Plan
            </button>
          </div>

          {/* Pro Card */}
          <div
            className="flex-1 flex flex-col p-8 rounded-2xl relative"
            style={{
              background: 'rgba(13,21,32,0.9)',
              border: '2px solid rgba(16,185,129,0.5)',
              boxShadow: '0 0 0 1px rgba(16,185,129,0.08), 0 0 60px rgba(16,185,129,0.15), 0 20px 40px rgba(0,0,0,0.6)',
            }}
          >
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span
                className="text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                ✨ Most Popular
              </span>
            </div>

            <div className="mb-6">
              <span
                className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
              >
                Pro
              </span>
            </div>
            <div className="mb-6">
              <span style={{ fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>$4.99</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>/mo</span>
            </div>
            <ul className="flex flex-col gap-3 mb-8 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: '#10b981', fontSize: '1rem' }}>✓</span>
                  <span style={{ fontSize: '0.95rem' }}>{f}</span>
                </li>
              ))}
            </ul>

            {error && (
              <p className="text-sm text-center mb-3" style={{ color: '#f87171' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: loading
                  ? 'rgba(16,185,129,0.35)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(16,185,129,0.4)',
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 6px 28px rgba(16,185,129,0.55)'
              }}
              onMouseLeave={(e) => {
                if (!loading)
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 4px 20px rgba(16,185,129,0.4)'
              }}
            >
              {loading ? 'Redirecting…' : 'Upgrade to Pro →'}
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs" style={{ color: 'var(--text-subtle)' }}>
          Payments processed by Stripe. Cancel anytime. No hidden fees.
        </p>
      </main>
    </div>
  )
}
