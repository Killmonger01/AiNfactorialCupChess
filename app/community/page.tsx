'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getLeaderboard,
  getFriendRequests,
  getFriends,
  getIncomingInvites,
  sendFriendRequest,
  respondToFriendRequest,
  respondToGameInvite,
  sendGameInvite,
  type LeaderboardEntry,
  type FriendRequest,
  type Friend,
  type GameInvite,
  type SendFriendRequestResult,
} from '@/lib/db'
import { useAuth } from '@/hooks/useAuth'
import AuthModal from '@/components/AuthModal'
import { supabase } from '@/lib/supabase'
import { createMultiplayerGame, getOrCreatePlayerId } from '@/lib/multiplayer'
import { createInitialGameState } from '@/lib/chess'
import { SkLeaderboard, SkFriends, SkRequests } from '@/components/Skeleton'

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function winRateColor(rate: number) {
  if (rate >= 70) return '#10b981'
  if (rate >= 50) return '#f0a500'
  return '#ef4444'
}

function displayName(email: string) {
  return email.split('@')[0]
}

const FRIEND_ERR: Record<string, string> = {
  'error:user_not_found':    'No user found with that email.',
  'error:cannot_add_self':   'You cannot add yourself.',
  'error:already_exists':    'A request already exists with this user.',
  'error:not_authenticated': 'You must be logged in.',
}

// ─── Add Friend Modal ─────────────────────────────────────────────────────────

function AddFriendModal({ onClose }: { onClose: () => void }) {
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const result: SendFriendRequestResult = await sendFriendRequest(email.trim())
      if (result === 'ok') {
        setStatus('ok')
        setTimeout(onClose, 1400)
      } else {
        setErrMsg(FRIEND_ERR[result] ?? 'Something went wrong.')
        setStatus('error')
      }
    } catch (err) {
      setErrMsg(String(err))
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm p-6 flex flex-col gap-5"
        style={{
          background: 'rgba(9,14,22,0.98)',
          border: '1px solid rgba(16,185,129,0.18)',
          borderRadius: '20px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.7)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
            Add Friend
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>✕</button>
        </div>

        {status === 'ok' ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-semibold" style={{ color: '#10b981' }}>Request sent!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setStatus('idle') }}
                placeholder="friend@example.com"
                autoFocus
                className="w-full px-4 py-2.5 text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: status === 'error' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                }}
              />
              {status === 'error' && <p className="text-xs" style={{ color: '#ef4444' }}>{errMsg}</p>}
            </div>
            <button
              type="submit"
              disabled={status === 'loading' || !email.trim()}
              className="py-2.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '10px', boxShadow: '0 2px 12px rgba(16,185,129,0.3)' }}
            >
              {status === 'loading' ? 'Sending…' : 'Send Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ email, size = 36 }: { email: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 font-bold"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: 'rgba(16,185,129,0.12)',
        color: '#10b981',
        border: '1px solid rgba(16,185,129,0.25)',
      }}
    >
      {displayName(email)[0].toUpperCase()}
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ label, active, badge, onClick }: {
  label: string; active: boolean; badge?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold transition-all duration-150"
      style={{
        borderRadius: '9px',
        background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
        border: active ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {label}
      {!!badge && badge > 0 && (
        <span
          className="flex items-center justify-center rounded-full font-bold"
          style={{ width: 16, height: 16, fontSize: '0.6rem', background: '#10b981', color: '#fff' }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div
      className="text-center py-20"
      style={{ border: '1px solid var(--border)', borderRadius: '16px', background: 'rgba(9,14,22,0.6)' }}
    >
      <p className="text-3xl mb-3">{icon}</p>
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'leaderboard' | 'friends' | 'requests'

export default function CommunityPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [tab, setTab]                   = useState<Tab>('leaderboard')
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([])
  const [friends, setFriends]           = useState<Friend[]>([])
  const [friendReqs, setFriendReqs]     = useState<FriendRequest[]>([])
  const [gameInvites, setGameInvites]   = useState<GameInvite[]>([])
  const [lbLoading, setLbLoading]       = useState(true)
  const [lbError, setLbError]           = useState<string | null>(null)
  const [reqLoading, setReqLoading]     = useState(false)
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [addFriendOpen, setAddFriendOpen]   = useState(false)
  const [authOpen, setAuthOpen]         = useState(false)
  const [challenging, setChallenging]   = useState<string | null>(null) // friend_id being challenged

  useEffect(() => {
    getLeaderboard()
      .then(setLeaderboard)
      .catch(err => setLbError(String(err)))
      .finally(() => setLbLoading(false))
  }, [])

  const loadFriends = useCallback(async () => {
    if (!user) return
    setFriendsLoading(true)
    try { setFriends(await getFriends()) } catch { /* ignore */ }
    finally { setFriendsLoading(false) }
  }, [user])

  const loadRequests = useCallback(async () => {
    if (!user) return
    setReqLoading(true)
    try {
      const [fr, gi] = await Promise.all([getFriendRequests(), getIncomingInvites()])
      setFriendReqs(fr)
      setGameInvites(gi)
    } catch { /* ignore */ }
    finally { setReqLoading(false) }
  }, [user])

  useEffect(() => { if (tab === 'friends') loadFriends() }, [tab, loadFriends])
  useEffect(() => { if (tab === 'requests') loadRequests() }, [tab, loadRequests])

  // Keep requests badge count refreshed after auth resolves
  useEffect(() => {
    if (user) loadRequests()
  }, [user, loadRequests])

  async function handleFriendRequest(id: string, accept: boolean) {
    try {
      await respondToFriendRequest(id, accept)
      setFriendReqs(prev => prev.filter(r => r.id !== id))
      if (accept) loadFriends()
    } catch (err) { console.error(err) }
  }

  async function handleGameInvite(invite: GameInvite, accept: boolean) {
    try {
      await respondToGameInvite(invite.id, accept)
      setGameInvites(prev => prev.filter(i => i.id !== invite.id))
      if (accept) router.push(`/play/${invite.game_id}`)
    } catch (err) { console.error(err) }
  }

  async function handleChallenge(friend: Friend) {
    if (challenging) return
    setChallenging(friend.friend_id)
    try {
      const playerId     = getOrCreatePlayerId()
      const initialState = createInitialGameState()
      const gameId       = await createMultiplayerGame(supabase, initialState, playerId)
      await sendGameInvite(friend.friend_id, gameId)
      router.push(`/play/${gameId}`)
    } catch (err) {
      console.error(err)
      setChallenging(null)
    }
  }

  function requireAuth(then: Tab) {
    if (!user && !authLoading) { setAuthOpen(true); return }
    setTab(then)
  }

  const requestsBadge = friendReqs.length + gameInvites.length

  return (
    <>
      {addFriendOpen && <AddFriendModal onClose={() => setAddFriendOpen(false)} />}
      {authOpen      && <AuthModal onClose={() => setAuthOpen(false)} />}

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
          <Link
            href="/"
            className="text-sm font-medium transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}
          >
            ← Back
          </Link>
          <div className="flex items-center gap-2">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
            <span style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
              Community
            </span>
          </div>
        </div>

        <button
          onClick={() => user ? setAddFriendOpen(true) : setAuthOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '10px',
            color: 'var(--accent)',
          }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(16,185,129,0.18)'; b.style.boxShadow = '0 0 16px rgba(16,185,129,0.2)' }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(16,185,129,0.1)'; b.style.boxShadow = 'none' }}
        >
          + Add Friend
        </button>
      </header>

      <main className="min-h-[calc(100vh-60px)] p-8 max-w-3xl mx-auto" style={{ color: '#fff' }}>
        {/* Title + tabs */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold mb-5" style={{ fontFamily: "'Outfit', sans-serif" }}>Community</h1>
          <div className="flex items-center gap-1 p-1 w-fit" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <TabBtn label="Leaderboard" active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')} />
            <TabBtn label="Friends"     active={tab === 'friends'}     onClick={() => requireAuth('friends')} />
            <TabBtn label="Requests"    active={tab === 'requests'}    badge={requestsBadge} onClick={() => requireAuth('requests')} />
          </div>
        </div>

        {/* ── Leaderboard ── */}
        {tab === 'leaderboard' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Ranked by win rate — even one win puts you at the top.
            </p>
            {lbLoading && <SkLeaderboard rows={7} />}
            {lbError   && <p className="text-red-400 text-sm">{lbError}</p>}
            {!lbLoading && !lbError && leaderboard.length === 0 && (
              <Empty icon="♟" title="No players yet" sub="Complete a game while logged in to appear here." />
            )}
            {!lbLoading && !lbError && leaderboard.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                <div
                  className="px-5 py-3.5 flex items-center gap-3"
                  style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.07), transparent)', borderBottom: '1px solid var(--border)' }}
                >
                  <span className="text-xl">🏆</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Leading:&nbsp;
                    <span style={{ color: 'var(--text-primary)' }}>{displayName(leaderboard[0].email)}</span>
                    &nbsp;·&nbsp;
                    <span style={{ color: '#10b981' }}>{leaderboard[0].win_rate}% win rate</span>
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#1e2738', color: '#8892a4' }}>
                      <th className="text-left px-5 py-3 font-semibold w-12">#</th>
                      <th className="text-left px-4 py-3 font-semibold">Player</th>
                      <th className="text-right px-4 py-3 font-semibold">Games</th>
                      <th className="text-right px-4 py-3 font-semibold">Wins</th>
                      <th className="text-right px-5 py-3 font-semibold">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, i) => {
                      const medal = RANK_MEDAL[Number(entry.rank)]
                      const isTop = Number(entry.rank) <= 3
                      const isMe  = user?.id === entry.user_id
                      return (
                        <tr
                          key={entry.user_id}
                          style={{
                            background: isMe
                              ? 'rgba(16,185,129,0.05)'
                              : i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                            borderTop: '1px solid var(--border)',
                          }}
                        >
                          <td className="px-5 py-3.5 font-bold tabular-nums" style={{ color: isTop ? '#f0a500' : 'var(--text-muted)', fontFamily: "'Outfit', sans-serif" }}>
                            {medal ?? entry.rank}
                          </td>
                          <td className="px-4 py-3.5">
                            <Link
                              href={`/player/${entry.user_id}`}
                              className="font-medium transition-colors duration-150 hover:underline"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {displayName(entry.email)}
                            </Link>
                            {isMe && (
                              <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                you
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{entry.total_games}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums" style={{ color: '#10b981' }}>{entry.wins}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span style={{ color: winRateColor(Number(entry.win_rate)), fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                              {entry.win_rate}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Friends ── */}
        {tab === 'friends' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Your friends — challenge them to a friendly match.
            </p>
            {friendsLoading && <SkFriends rows={4} />}
            {!friendsLoading && friends.length === 0 && (
              <Empty icon="👥" title="No friends yet" sub='Add friends with the "+ Add Friend" button.' />
            )}
            {!friendsLoading && friends.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                {friends.map((f, i) => (
                  <div
                    key={f.friendship_id}
                    className="flex items-center justify-between px-5 py-4"
                    style={{
                      background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                    }}
                  >
                    {/* Avatar + name + stats */}
                    <div className="flex items-center gap-3">
                      <Avatar email={f.email} />
                      <div>
                        <Link
                          href={`/player/${f.friend_id}`}
                          className="text-sm font-semibold hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {displayName(f.email)}
                        </Link>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {f.total_games} games · <span style={{ color: winRateColor(Number(f.win_rate)) }}>{f.win_rate}% WR</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/player/${f.friend_id}`}
                        className="px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-px"
                        style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px' }}
                      >
                        Profile
                      </Link>
                      <button
                        onClick={() => handleChallenge(f)}
                        disabled={challenging === f.friend_id}
                        className="px-3.5 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
                      >
                        {challenging === f.friend_id ? 'Creating…' : '⚔ Challenge'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Requests ── */}
        {tab === 'requests' && (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Incoming friend requests and game challenges.
            </p>
            {reqLoading && <SkRequests rows={3} />}

            {!reqLoading && friendReqs.length === 0 && gameInvites.length === 0 && (
              <Empty icon="📬" title="All clear" sub="When someone adds you or challenges you, it'll show up here." />
            )}

            {!reqLoading && (
              <div className="flex flex-col gap-6">
                {/* Friend requests */}
                {friendReqs.length > 0 && (
                  <section>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                      Friend Requests
                    </p>
                    <div style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                      {friendReqs.map((req, i) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between px-5 py-4"
                          style={{
                            background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                            borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar email={req.email} />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName(req.email)}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(req.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleFriendRequest(req.id, true)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-px"
                              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleFriendRequest(req.id, false)}
                              className="px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-px"
                              style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', borderRadius: '8px' }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Game challenges */}
                {gameInvites.length > 0 && (
                  <section>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                      Game Challenges
                    </p>
                    <div style={{ border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                      {gameInvites.map((inv, i) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between px-5 py-4"
                          style={{
                            background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                            borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 flex items-center justify-center rounded-full text-lg flex-shrink-0"
                              style={{ background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.25)' }}
                            >
                              ⚔
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {displayName(inv.email)} challenges you!
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(inv.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleGameInvite(inv, true)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:-translate-y-px"
                              style={{ background: 'linear-gradient(135deg, #f0a500, #d97706)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(240,165,0,0.3)' }}
                            >
                              ⚔ Join Game
                            </button>
                            <button
                              onClick={() => handleGameInvite(inv, false)}
                              className="px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-px"
                              style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', borderRadius: '8px' }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}
