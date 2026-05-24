'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getUserGames, getUserStats, type GameRow, type UserStats } from '@/lib/db'
import AuthModal from '@/components/AuthModal'
import ReplayModal from '@/components/ReplayModal'

const STAT_CARD_STYLES = [
  { gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))', border: 'rgba(16,185,129,0.25)', glow: 'rgba(16,185,129,0.12)' },
  { gradient: 'linear-gradient(135deg, rgba(240,165,0,0.12), rgba(240,165,0,0.04))',   border: 'rgba(240,165,0,0.25)',   glow: 'rgba(240,165,0,0.12)'   },
  { gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',   border: 'rgba(239,68,68,0.25)',   glow: 'rgba(239,68,68,0.1)'    },
  { gradient: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.04))',  border: 'rgba(99,102,241,0.25)',  glow: 'rgba(99,102,241,0.1)'   },
  { gradient: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.04))',  border: 'rgba(14,165,233,0.25)',  glow: 'rgba(14,165,233,0.1)'   },
]

const RESULT_LABEL: Record<string, { label: string; color: string }> = {
  white_wins: { label: 'Win',  color: '#10b981' },
  black_wins: { label: 'Loss', color: '#ef4444' },
  draw:       { label: 'Draw', color: 'var(--text-muted)' },
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
}

function StatCard({ label, value, icon, isWinRate, styleIdx = 0 }: { label: string; value: string | number; icon: string; isWinRate?: boolean; styleIdx?: number }) {
  const numVal = typeof value === 'string' ? parseFloat(value) : value
  const cs = STAT_CARD_STYLES[styleIdx % STAT_CARD_STYLES.length]
  const valueColor = isWinRate ? (numVal >= 50 ? '#10b981' : '#ef4444') : 'var(--text-primary)'
  return (
    <div
      className="flex flex-col items-center px-6 py-5 transition-all duration-200 hover:-translate-y-1"
      style={{
        background: cs.gradient,
        border: `1px solid ${cs.border}`,
        borderRadius: '16px',
        boxShadow: `0 4px 24px ${cs.glow}`,
      }}
    >
      <span className="text-2xl mb-2">{icon}</span>
      <span className="text-3xl font-bold tabular-nums" style={{ color: valueColor, fontFamily: "'Outfit', sans-serif" }}>{value}</span>
      <span className="text-xs mt-1.5 font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()

  const [stats,   setStats]   = useState<UserStats | null>(null)
  const [games,   setGames]   = useState<GameRow[]>([])
  const [dbError, setDbError] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [replayGame, setReplayGame] = useState<GameRow | null>(null)

  // Redirect to sign-in modal if not logged in after auth resolves
  useEffect(() => {
    if (!authLoading && !user) setAuthOpen(true)
  }, [authLoading, user])

  useEffect(() => {
    if (!user) return
    Promise.all([getUserStats(user.id), getUserGames(user.id)])
      .then(([s, g]) => { setStats(s); setGames(g) })
      .catch(err => setDbError(String(err)))
  }, [user])

  return (
    <>
      {authOpen && (
        <AuthModal onClose={() => {
          setAuthOpen(false)
          if (!user) router.push('/')
        }} />
      )}

      {replayGame && (
        <ReplayModal game={replayGame} onClose={() => setReplayGame(null)} />
      )}

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
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
            <span style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>My Profile</span>
          </div>
        </div>
        {user && (
          <button
            onClick={signOut}
            className="text-sm font-medium transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
          >
            Sign Out
          </button>
        )}
      </header>

      <main
        className="min-h-[calc(100vh-60px)] p-8 max-w-3xl mx-auto"
        style={{ color: '#fff' }}
      >
        {authLoading && (
          <p className="text-center mt-20" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        )}

        {!authLoading && user && (
          <>
            {/* Email */}
            <h1 className="text-2xl font-bold mb-1">{user.email}</h1>
            <p className="text-xs mb-10 font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Member since {new Date(user.created_at).toLocaleDateString()}</p>

            {dbError && (
              <p className="text-red-400 text-sm mb-6">{dbError}</p>
            )}

            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-12">
                <StatCard label="Games"    value={stats.total}         icon="🎮" styleIdx={0} />
                <StatCard label="Wins"     value={stats.wins}          icon="🏆" styleIdx={1} />
                <StatCard label="Losses"   value={stats.losses}        icon="💔" styleIdx={2} />
                <StatCard label="Draws"    value={stats.draws}         icon="🤝" styleIdx={3} />
                <StatCard label="Win Rate" value={`${stats.winRate}%`} icon="📈" isWinRate styleIdx={4} />
              </div>
            )}

            {/* Game history */}
            <h2 className="text-xl font-bold mb-5">Game History</h2>
            {games.length === 0 ? (
              <p className="text-sm" style={{ color: '#a0aec0' }}>
                No games recorded yet. Play a game and finish it to save it here.
              </p>
            ) : (
              <div className="overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: '14px' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#1e2738', color: '#8892a4' }}>
                      <th className="text-left px-4 py-2 font-semibold">Date</th>
                      <th className="text-left px-4 py-2 font-semibold">Opponent</th>
                      <th className="text-left px-4 py-2 font-semibold">Difficulty</th>
                      <th className="text-left px-4 py-2 font-semibold">Result</th>
                      <th className="text-right px-4 py-2 font-semibold">Moves</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g, i) => {
                      const res = RESULT_LABEL[g.result] ?? { label: g.result, color: '#a0aec0' }
                      return (
                        <tr
                          key={g.id}
                          onClick={() => setReplayGame(g)}
                          className="cursor-pointer transition-colors"
                          style={{
                            background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                            borderTop: '1px solid var(--border)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)')}
                        >
                          <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                            {new Date(g.played_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 capitalize">{g.opponent}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                            {g.ai_difficulty ? DIFFICULTY_LABEL[g.ai_difficulty] ?? g.ai_difficulty : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              style={{
                                background: g.result === 'white_wins' ? 'rgba(16,185,129,0.12)' : g.result === 'black_wins' ? 'rgba(239,68,68,0.12)' : 'rgba(160,174,192,0.08)',
                                color: res.color,
                                border: g.result === 'white_wins' ? '1px solid rgba(16,185,129,0.3)' : g.result === 'black_wins' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(160,174,192,0.15)',
                                borderRadius: '999px',
                                padding: '2px 10px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {res.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right" style={{ color: 'var(--text-muted)' }}>
                            {g.moves_count}
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
      </main>
    </>
  )
}
