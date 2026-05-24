'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getIncomingInvites, respondToGameInvite, type GameInvite } from '@/lib/db'

const TIMEOUT_SEC = 60

function displayName(email: string) {
  return email.split('@')[0]
}

export function ChallengeNotification() {
  const { user }  = useAuth()
  const router    = useRouter()

  const [invite,      setInvite]      = useState<GameInvite | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SEC)
  const [accepting,   setAccepting]   = useState(false)

  // Track which invite IDs we've already surfaced so we never double-show
  const shownRef   = useRef<Set<string>>(new Set())
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Subscribe to new rows in game_invites where to_user_id = me
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`challenge-notif-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'game_invites',
          filter: `to_user_id=eq.${user.id}`,
        },
        async () => {
          try {
            const invites   = await getIncomingInvites()
            const newInvite = invites.find(i => !shownRef.current.has(i.id))
            if (newInvite) {
              shownRef.current.add(newInvite.id)
              setInvite(newInvite)
              setSecondsLeft(TIMEOUT_SEC)
            }
          } catch { /* silently ignore fetch errors */ }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Countdown — auto-dismiss when it hits 0 (no DB change, invite stays in Requests tab)
  useEffect(() => {
    if (!invite) return
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setInvite(null)
          return TIMEOUT_SEC
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [invite])

  if (!invite) return null

  async function handleAccept() {
    if (!invite || accepting) return
    setAccepting(true)
    try { await respondToGameInvite(invite.id, true) } catch { /* ignore */ }
    const gameId = invite.game_id
    setInvite(null)
    router.push(`/play/${gameId}`)
  }

  async function handleDecline() {
    if (!invite) return
    try { await respondToGameInvite(invite.id, false) } catch { /* ignore */ }
    setInvite(null)
  }

  const progress = (secondsLeft / TIMEOUT_SEC) * 100

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', animation: 'fade-in-backdrop 0.2s ease' }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm flex flex-col items-center gap-5 p-8 relative overflow-hidden"
        style={{
          background: 'rgba(9,14,22,0.98)',
          border: '1px solid rgba(240,165,0,0.3)',
          borderRadius: '24px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.85), 0 0 48px rgba(240,165,0,0.1)',
          animation: 'modal-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Gold top-glow strip */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(240,165,0,0.6), transparent)' }}
        />

        {/* Swords icon */}
        <div
          className="w-20 h-20 flex items-center justify-center rounded-full text-4xl"
          style={{
            background: 'linear-gradient(135deg, rgba(240,165,0,0.15), rgba(240,165,0,0.04))',
            border: '2px solid rgba(240,165,0,0.35)',
            boxShadow: '0 0 32px rgba(240,165,0,0.15)',
            animation: 'swords-pulse 1.4s ease-in-out infinite',
          }}
        >
          ⚔
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            Challenge!
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: '#f0a500', fontWeight: 700 }}>
              {displayName(invite.email)}
            </span>
            {' '}is challenging you to a game
          </p>
        </div>

        {/* Progress bar countdown */}
        <div className="w-full flex flex-col items-center gap-1.5">
          <div
            className="w-full h-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${progress}%`,
                background: progress > 50
                  ? 'linear-gradient(90deg, #f0a500, #f5c518)'
                  : progress > 20
                  ? 'linear-gradient(90deg, #f0a500, #ef4444)'
                  : '#ef4444',
              }}
            />
          </div>
          <p className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {secondsLeft}s
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleDecline}
            className="flex-1 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0"
            style={{
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171',
              borderRadius: '12px',
            }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(239,68,68,0.06)' }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent' }}
          >
            Decline
          </button>

          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex-1 py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #f0a500, #d97706)',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(240,165,0,0.4)',
            }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; if (!b.disabled) b.style.boxShadow = '0 6px 28px rgba(240,165,0,0.6)' }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = '0 4px 20px rgba(240,165,0,0.4)' }}
          >
            {accepting ? 'Joining…' : '⚔ Accept!'}
          </button>
        </div>
      </div>
    </div>
  )
}
