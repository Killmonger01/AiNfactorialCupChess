'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getUserPublicProfile,
  getFriendshipStatus,
  sendFriendRequest,
  respondToFriendRequest,
  sendGameInvite,
  type UserPublicProfile,
  type FriendshipStatus,
  type SendFriendRequestResult,
} from '@/lib/db'
import { SkPlayerProfile } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/AuthModal'
import { supabase } from '@/lib/supabase'
import { createMultiplayerGame, getOrCreatePlayerId } from '@/lib/multiplayer'
import { createInitialGameState } from '@/lib/chess'

// ─── helpers ─────────────────────────────────────────────────────────────────

function displayName(email: string) {
  return email.split('@')[0]
}

function winRateColor(rate: number) {
  if (rate >= 70) return '#10b981'
  if (rate >= 50) return '#f0a500'
  return '#ef4444'
}

const FRIEND_ERR: Record<string, string> = {
  'error:user_not_found':    'User not found.',
  'error:cannot_add_self':   'That\'s you!',
  'error:already_exists':    'Request already sent.',
  'error:not_authenticated': 'Log in first.',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, highlight,
}: { label: string; value: string | number; icon: string; highlight?: string }) {
  return (
    <div
      className="flex flex-col items-center px-6 py-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
      }}
    >
      <span className="text-2xl mb-2">{icon}</span>
      <span className="text-3xl font-bold tabular-nums" style={{ color: highlight ?? 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
        {value}
      </span>
      <span className="text-xs mt-1.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

// ─── Friend / challenge action button ────────────────────────────────────────

function FriendActions({
  userId,
  friendStatus,
  onStatusChange,
  onChallenge,
  challenging,
  isMe,
}: {
  userId: string
  friendStatus: FriendshipStatus | null
  onStatusChange: (s: FriendshipStatus) => void
  onChallenge: () => void
  challenging: boolean
  isMe: boolean
}) {
  const [addLoading, setAddLoading] = useState(false)
  const [addErr, setAddErr]         = useState('')

  async function handleAdd() {
    setAddLoading(true)
    setAddErr('')
    try {
      // We can use email from profile via sendFriendRequest, but we only have userId here.
      // Use the Supabase function that accepts email — we'll fetch email from the profile.
      // Actually, the profile email is passed as a prop from the parent.
      // We'll rely on the parent calling sendFriendRequest with the email.
      // For simplicity, re-fetch email here via profile.
      const profile = await getUserPublicProfile(userId)
      if (!profile) { setAddErr('User not found.'); return }
      const result: SendFriendRequestResult = await sendFriendRequest(profile.email)
      if (result === 'ok') {
        onStatusChange('sent_pending')
      } else {
        setAddErr(FRIEND_ERR[result] ?? 'Error.')
      }
    } catch (err) {
      setAddErr(String(err))
    } finally {
      setAddLoading(false)
    }
  }

  if (isMe || friendStatus === null) return null

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      <div className="flex items-center gap-2">
        {friendStatus === 'none' && (
          <button
            onClick={handleAdd}
            disabled={addLoading}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px disabled:opacity-50"
            style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '10px',
              color: 'var(--accent)',
            }}
          >
            {addLoading ? 'Sending…' : '+ Add Friend'}
          </button>
        )}

        {friendStatus === 'sent_pending' && (
          <span
            className="px-5 py-2 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-muted)' }}
          >
            Request Sent ✓
          </span>
        )}

        {friendStatus === 'received_pending' && (
          <span
            className="px-5 py-2 text-sm font-semibold"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', color: '#10b981' }}
          >
            They want to add you — check Requests
          </span>
        )}

        {friendStatus === 'accepted' && (
          <>
            <span
              className="px-4 py-2 text-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', color: '#10b981' }}
            >
              Friends ✓
            </span>
            <button
              onClick={onChallenge}
              disabled={challenging}
              className="px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '10px', boxShadow: '0 2px 12px rgba(16,185,129,0.3)' }}
            >
              {challenging ? 'Creating…' : '⚔ Challenge'}
            </button>
          </>
        )}
      </div>
      {addErr && <p className="text-xs" style={{ color: '#ef4444' }}>{addErr}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerPage({ params }: { params: { userId: string } }) {
  const { userId } = params
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [profile,      setProfile]      = useState<UserPublicProfile | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [notFound,     setNotFound]     = useState(false)
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus | null>(null)
  const [challenging,  setChallenging]  = useState(false)
  const [authOpen,     setAuthOpen]     = useState(false)

  const isMe = user?.id === userId

  useEffect(() => {
    getUserPublicProfile(userId)
      .then(p => {
        if (!p) setNotFound(true)
        else setProfile(p)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [userId])

  // Load friendship status once auth resolves
  useEffect(() => {
    if (!user || !userId || isMe) return
    getFriendshipStatus(user.id, userId).then(setFriendStatus)
  }, [user, userId, isMe])

  async function handleChallenge() {
    if (!user) { setAuthOpen(true); return }
    setChallenging(true)
    try {
      const playerId     = getOrCreatePlayerId()
      const initialState = createInitialGameState()
      const gameId       = await createMultiplayerGame(supabase, initialState, playerId)
      await sendGameInvite(userId, gameId)
      router.push(`/play/${gameId}`)
    } catch (err) {
      console.error(err)
      setChallenging(false)
    }
  }

  return (
    <>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {/* Header */}
      <header
        className="w-full px-6 py-3.5 flex items-center justify-between flex-shrink-0"
        style={{
          background: 'rgba(7,11,15,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(16,185,129,0.1)',
          boxShadow: '0 1px 0 rgba(16,185,129,0.05)',
        }}
      >
        <div className="flex items-center gap-5">
          <button
            onClick={() => router.back()}
            className="text-sm font-medium transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
          >
            ← Back
          </button>
          <Link
            href="/community"
            className="text-sm font-medium transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}
          >
            Community
          </Link>
        </div>
      </header>

      <main className="min-h-[calc(100vh-60px)] p-8 max-w-2xl mx-auto" style={{ color: '#fff' }}>
        {loading && <SkPlayerProfile />}

        {!loading && notFound && (
          <div className="text-center mt-20">
            <p className="text-4xl mb-4">🤷</p>
            <p className="font-semibold text-lg mb-2">Player not found</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>This user doesn't exist or hasn't played any games yet.</p>
            <Link
              href="/community"
              className="text-sm font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              ← Back to Community
            </Link>
          </div>
        )}

        {!loading && profile && (
          <>
            {/* Player card */}
            <div
              className="flex flex-col items-center text-center gap-4 p-8 mb-8"
              style={{
                background: 'rgba(9,14,22,0.75)',
                border: '1px solid rgba(16,185,129,0.08)',
                borderRadius: '20px',
                backdropFilter: 'blur(24px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {/* Big avatar */}
              <div
                className="flex items-center justify-center rounded-full font-bold text-3xl"
                style={{
                  width: 80, height: 80,
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.06))',
                  border: '2px solid rgba(16,185,129,0.3)',
                  color: '#10b981',
                  boxShadow: '0 0 32px rgba(16,185,129,0.15)',
                }}
              >
                {displayName(profile.email)[0].toUpperCase()}
              </div>

              <div>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {displayName(profile.email)}
                  {isMe && (
                    <span className="ml-2 text-xs px-2 py-1 rounded-full align-middle" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                      you
                    </span>
                  )}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Chess Player</p>
              </div>

              {/* Friend actions */}
              {!authLoading && !isMe && (
                <FriendActions
                  userId={userId}
                  friendStatus={user ? friendStatus : null}
                  onStatusChange={setFriendStatus}
                  onChallenge={handleChallenge}
                  challenging={challenging}
                  isMe={isMe}
                />
              )}
              {!authLoading && !user && !isMe && (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="text-sm font-semibold transition-all duration-200 hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Log in to add friend or challenge
                </button>
              )}
            </div>

            {/* Stats */}
            {(profile.total_games > 0) ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <StatCard label="Games"    value={profile.total_games} icon="🎮" />
                <StatCard label="Wins"     value={profile.wins}        icon="🏆" />
                <StatCard label="Losses"   value={profile.losses}      icon="💔" />
                <StatCard label="Draws"    value={profile.draws}       icon="🤝" />
                <StatCard
                  label="Win Rate"
                  value={`${profile.win_rate}%`}
                  icon="📈"
                  highlight={winRateColor(Number(profile.win_rate))}
                />
              </div>
            ) : (
              <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
                No games recorded yet.
              </p>
            )}
          </>
        )}
      </main>
    </>
  )
}
