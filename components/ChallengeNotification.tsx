'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getIncomingInvites, respondToGameInvite, type GameInvite } from '@/lib/db'

function displayName(email: string) {
  return email.split('@')[0]
}

export function ChallengeNotification() {
  const { user } = useAuth()
  const router   = useRouter()

  const [invite,    setInvite]    = useState<GameInvite | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [visible,   setVisible]   = useState(false) // controls slide-in animation

  // IDs we've already surfaced — use a ref to avoid re-subscribing on every render
  const shownRef = useRef<Set<string>>(new Set())

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
              // small delay so the element is mounted before CSS transition kicks in
              requestAnimationFrame(() => setVisible(true))
            }
          } catch { /* ignore */ }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  function dismiss() {
    setVisible(false)
    // wait for slide-out animation then clear invite
    setTimeout(() => setInvite(null), 320)
  }

  async function handleAccept() {
    if (!invite || accepting) return
    setAccepting(true)
    try { await respondToGameInvite(invite.id, true) } catch { /* ignore */ }
    const gameId = invite.game_id
    dismiss()
    router.push(`/play/${gameId}`)
  }

  async function handleDecline() {
    if (!invite) return
    try { await respondToGameInvite(invite.id, false) } catch { /* ignore */ }
    dismiss()
  }

  if (!invite) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 72,                         // sit just below the header
        left: '50%',
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(-24px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.3s cubic-bezier(0.34,1.4,0.64,1), opacity 0.25s ease',
        zIndex: 300,
        pointerEvents: visible ? 'auto' : 'none',
        width: 'max-content',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 16px 12px 14px',
          background: 'rgba(9,14,22,0.97)',
          border: '1px solid rgba(240,165,0,0.4)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(240,165,0,0.08), 0 0 24px rgba(240,165,0,0.12)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 38, height: 38,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(240,165,0,0.18), rgba(240,165,0,0.05))',
            border: '1px solid rgba(240,165,0,0.35)',
            animation: 'swords-pulse 1.4s ease-in-out infinite',
          }}
        >
          ⚔
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f0a500', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}>
            Challenge!
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {displayName(invite.email)}
            </span>
            {' '}wants to play{' '}
            {invite.royale ? (
              <span style={{ color: '#f0a500', fontWeight: 700 }}>Chess Royale</span>
            ) : (
              'Normal Chess'
            )}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleDecline}
            style={{
              padding: '6px 14px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171',
              borderRadius: 9,
              cursor: 'pointer',
              transition: 'background 0.15s, transform 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            onMouseDown={e  => { (e.currentTarget as HTMLButtonElement).style.transform  = 'scale(0.96)' }}
            onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform  = 'scale(1)' }}
          >
            Decline
          </button>

          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{
              padding: '6px 16px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: accepting ? 'rgba(240,165,0,0.5)' : 'linear-gradient(135deg, #f0a500, #d97706)',
              color: '#1a0a00',
              border: 'none',
              borderRadius: 9,
              cursor: accepting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 12px rgba(240,165,0,0.35)',
              transition: 'box-shadow 0.15s, transform 0.12s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!accepting) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(240,165,0,0.55)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(240,165,0,0.35)' }}
            onMouseDown={e  => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)' }}
            onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          >
            {accepting ? 'Joining…' : '⚔ Accept'}
          </button>
        </div>
      </div>
    </div>
  )
}
