'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase'

export default function SuccessPage() {
  const firedRef   = useRef(false)
  const setProDone = useRef(false)

  // Grant Pro status for the currently logged-in user.
  useEffect(() => {
    if (setProDone.current) return
    setProDone.current = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.access_token) {
        console.log('[set-pro] no session — user not logged in')
        return
      }
      console.log('[set-pro] calling /api/set-pro for user:', session.user?.id)
      const res = await fetch('/api/set-pro', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      console.log('[set-pro] response:', res.status, json)
    })
  }, [])

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    // Burst from both sides
    const end = Date.now() + 3000
    const colors = ['#769656', '#22c55e', '#a3e635', '#ffffff', '#fbbf24']

    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }

    frame()
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <div
        className="flex flex-col items-center text-center p-10 rounded-3xl max-w-md w-full"
        style={{
          background: 'rgba(9,14,22,0.96)',
          border: '1px solid rgba(16,185,129,0.2)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 40px rgba(16,185,129,0.08)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Animated checkmark */}
        <div
          className="flex items-center justify-center rounded-full mb-6"
          style={{
            width: '80px',
            height: '80px',
            background: 'rgba(16,185,129,0.12)',
            border: '2px solid rgba(16,185,129,0.4)',
            animation: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>✓</span>
        </div>

        <h1
          className="text-3xl font-extrabold mb-3"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}
        >
          You&apos;re now Pro! 🎉
        </h1>
        <p className="text-base mb-8" style={{ color: 'var(--text-muted)' }}>
          All features are unlocked. Enjoy your upgraded experience!
        </p>

        <Link
          href="/"
          className="w-full py-3 rounded-xl text-sm font-bold text-center transition-all block"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.boxShadow =
              '0 6px 28px rgba(16,185,129,0.55)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.boxShadow =
              '0 4px 20px rgba(16,185,129,0.4)'
          }}
        >
          ← Back to Game
        </Link>
      </div>

      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
