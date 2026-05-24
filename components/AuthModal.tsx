'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  onClose: () => void
}

type Tab = 'signin' | 'signup'

export default function AuthModal({ onClose }: Props) {
  const [tab, setTab]         = useState<Tab>('signin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [info, setInfo]       = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    try {
      if (tab === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setInfo('Check your email for a confirmation link.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl border-2 p-8 shadow-2xl"
        style={{ background: '#16213e', borderColor: '#0f3460' }}
      >
        {/* Tabs */}
        <div className="flex rounded-lg mb-6 overflow-hidden border" style={{ borderColor: '#0f3460' }}>
          {(['signin', 'signup'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); setInfo(null) }}
              className="flex-1 py-2 text-sm font-semibold transition-colors"
              style={{
                background:  tab === t ? '#0f3460' : 'transparent',
                color:       tab === t ? '#fff' : '#a0aec0',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#a0aec0' }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{ background: '#0f3460', borderColor: '#1a4a8a', focusRingColor: '#769656' } as React.CSSProperties}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#a0aec0' }}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2"
              style={{ background: '#0f3460' } as React.CSSProperties}
              placeholder="••••••••"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
          {info && (
            <p className="text-xs text-green-400 text-center">{info}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#769656' }}
          >
            {loading ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-xs transition-opacity hover:opacity-70"
          style={{ color: '#a0aec0' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
