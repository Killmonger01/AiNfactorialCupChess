'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BoardComponent from '@/components/Board'
import GameStatus from '@/components/GameStatus'
import MoveHistory from '@/components/MoveHistory'
import AuthModal from '@/components/AuthModal'
import UserMenu from '@/components/UserMenu'
import { useChess, type GameMode } from '@/hooks/useChess'
import { useAuth } from '@/hooks/useAuth'
import { useIsPro } from '@/hooks/useIsPro'
import { saveGame } from '@/lib/db'
import { toAlgebraicNotation, createInitialGameState } from '@/lib/chess'
import { ROYALE_RULE_LABELS, createInitialGameStateRoyale } from '@/lib/royale'
import { createInitialGameStateDice, getDiceSlots, DICE_PIECE_ICONS, hasDiceMove } from '@/lib/diceChess'
import { supabase } from '@/lib/supabase'
import { createMultiplayerGame, getOrCreatePlayerId } from '@/lib/multiplayer'

// ─── Config ───────────────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { label: 'Easy',   skill: 2  as const, desc: 'Makes mistakes — great for beginners' },
  { label: 'Medium', skill: 10 as const, desc: 'A balanced challenge' },
  { label: 'Hard',   skill: 20 as const, desc: 'Near-perfect play' },
]

const DIFF_LABEL: Record<number, string> = { 2: 'Easy', 10: 'Medium', 20: 'Hard' }

type ActiveCard = 'ai' | 'pvp' | 'royale' | 'fog' | 'dice'

// ─── Shared color picker for online game creation ────────────────────────────

const COLOR_OPTS = [
  { v: 'white',  icon: '♙', label: 'White' },
  { v: 'random', icon: '⚄', label: 'Random' },
  { v: 'black',  icon: '♟', label: 'Black' },
] as const

function OnlineColorPicker({
  value, onChange,
}: {
  value: 'white' | 'random' | 'black'
  onChange: (v: 'white' | 'random' | 'black') => void
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        Your color (online)
      </p>
      <div className="flex gap-2">
        {COLOR_OPTS.map(opt => (
          <button
            key={opt.v}
            onClick={() => onChange(opt.v)}
            className="flex-1 flex flex-col items-center py-2.5 rounded-xl transition-all duration-150"
            style={{
              border: value === opt.v ? '1px solid rgba(16,185,129,0.55)' : '1px solid var(--border)',
              background: value === opt.v ? 'rgba(16,185,129,0.1)' : 'transparent',
              boxShadow: value === opt.v ? '0 0 10px rgba(16,185,129,0.12)' : 'none',
            }}
          >
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{opt.icon}</span>
            <span className="text-xs mt-1 font-medium" style={{ color: value === opt.v ? '#10b981' : 'var(--text-muted)' }}>
              {opt.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Landing sub-components ───────────────────────────────────────────────────

function ModeCard({
  icon, title, desc, accent, accentBg, border, badge, onClick,
}: {
  icon: string; title: string; desc: string
  accent: string; accentBg: string; border: string
  badge?: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-4 p-5 text-left w-full transition-all duration-200 hover:-translate-y-1 relative overflow-hidden"
      style={{ background: accentBg, border: `1px solid ${border}`, borderRadius: 20 }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = accent + 'aa' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = border }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }}
      />
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 flex items-center justify-center rounded-xl text-2xl flex-shrink-0"
          style={{ background: accentBg, border: `1px solid ${border}` }}
        >
          {icon}
        </div>
        {badge && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: accentBg, color: accent, border: `1px solid ${border}` }}
          >
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="font-bold text-base mb-1.5" style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
          {title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      </div>
      <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: accent }}>
        Choose options <span>→</span>
      </div>
    </button>
  )
}

function SubPanel({
  title, children, onBack,
}: {
  title: string; children: React.ReactNode; onBack: () => void
}) {
  return (
    <div
      className="w-full p-6 flex flex-col gap-5"
      style={{
        background: 'rgba(9,14,22,0.85)',
        border: '1px solid rgba(16,185,129,0.12)',
        borderRadius: 20,
        backdropFilter: 'blur(24px)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        animation: 'modal-slide-up 0.22s cubic-bezier(0.34,1.4,0.64,1)',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm font-semibold transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          ← Back
        </button>
        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function OptionRow({
  icon, title, desc, onClick, loading, accent = '#10b981',
}: {
  icon: string; title: string; desc: string
  onClick: () => void; loading?: boolean; accent?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-4 p-4 text-left w-full transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: 14 }}
      onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.borderColor = accent + '66' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
    >
      <div
        className="w-11 h-11 flex items-center justify-center rounded-xl text-xl flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
      >
        {loading ? '⏳' : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
          {loading ? 'Creating game…' : title}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      </div>
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>→</span>
    </button>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()

  const {
    gameState, history, selectedSquare, legalMoves, lastMove,
    mode, skillLevel, playerColor, movesCount, aiThinking, engineReady,
    handleSquareClick, undoMove, newGame, resign, passDice,
  } = useChess()

  const { user, loading: authLoading, signOut } = useAuth()
  const { isPro } = useIsPro()

  const [screen, setScreen]               = useState<'landing' | 'game'>('landing')
  const [mounted, setMounted]             = useState(false)
  const [activeCard, setActiveCard]       = useState<ActiveCard | null>(null)
  const [authOpen, setAuthOpen]           = useState(false)
  const [resignConfirm, setResignConfirm] = useState(false)
  const [mpLoading, setMpLoading]         = useState(false)
  const [aiSkill, setAiSkill]             = useState(10)
  const [aiColor, setAiColor]             = useState<'white' | 'random' | 'black'>('white')
  const [onlineColor, setOnlineColor]     = useState<'white' | 'random' | 'black'>('white')

  const gameSavedRef = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  // Auto-save completed games for logged-in users
  useEffect(() => {
    if (!user || (!gameState.isCheckmate && !gameState.isStalemate) || gameSavedRef.current) return
    gameSavedRef.current = true
    const result: 'white_wins' | 'black_wins' | 'draw' = gameState.isStalemate
      ? 'draw'
      : gameState.currentTurn === 'black' ? 'white_wins' : 'black_wins'
    const ai_difficulty: 'easy' | 'medium' | 'hard' | null =
      mode !== 'ai' ? null : skillLevel <= 2 ? 'easy' : skillLevel <= 10 ? 'medium' : 'hard'
    saveGame({
      user_id: user.id,
      pgn: history.map(e => toAlgebraicNotation(e.move)).join(' '),
      result,
      opponent: mode === 'ai' ? 'ai' : 'human',
      ai_difficulty,
      moves_count: movesCount,
    }).catch(console.error)
  }, [gameState.isCheckmate, gameState.isStalemate, gameState.currentTurn, user, movesCount, history, mode, skillLevel])

  useEffect(() => { if (movesCount === 0) gameSavedRef.current = false }, [movesCount])

  function goToLanding() {
    setScreen('landing')
    setActiveCard(null)
    setResignConfirm(false)
  }

  function startLocalGame(m: GameMode, skill: number, color: 'white' | 'black' = 'white', royale = false, dice = false) {
    newGame(m, skill, color, royale, dice)
    setScreen('game')
    setActiveCard(null)
  }

  async function startOnlineGame(royale = false, fogOfWar = false, color: 'white' | 'random' | 'black' = 'white', dice = false) {
    if (mpLoading) return
    setMpLoading(true)
    const resolved: 'white' | 'black' = color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color
    try {
      const playerId = getOrCreatePlayerId()
      const initialState = dice ? createInitialGameStateDice() : royale ? createInitialGameStateRoyale() : createInitialGameState()
      const gameId = await createMultiplayerGame(supabase, initialState, playerId, royale, fogOfWar, resolved, dice)
      router.push(`/play/${gameId}`)
    } catch (err) {
      console.error(err)
      window.alert(`Could not create multiplayer game:\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setMpLoading(false)
    }
  }

  // ── Header (shared between landing and game) ─────────────────────────────────

  function Header() {
    return (
      <header
        className="w-full px-6 py-3.5 flex items-center justify-between flex-shrink-0"
        style={{
          background: 'rgba(7,11,15,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(16,185,129,0.1)',
          boxShadow: '0 1px 0 rgba(16,185,129,0.05)',
        }}
      >
        <button
          onClick={goToLanding}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 16px rgba(16,185,129,0.4)' }}
          >
            <span style={{ fontSize: '1rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>♟</span>
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>
            Chess
          </span>
        </button>

        <div className="flex items-center gap-4">
          <Link href="/community" className="text-sm font-medium transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}>
            Community
          </Link>
          <Link href="/profile" className="text-sm font-medium transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}>
            Profile
          </Link>
          {isPro ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #f0a500, #d97706)', color: '#1a0a00', boxShadow: '0 0 16px rgba(240,165,0,0.35)' }}>
              ✨ Pro
            </span>
          ) : (
            <Link href="/pricing" className="text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-all duration-200"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--accent)' }}
              onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.background = 'rgba(16,185,129,0.18)'; a.style.boxShadow = '0 0 16px rgba(16,185,129,0.2)' }}
              onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.background = 'rgba(16,185,129,0.1)'; a.style.boxShadow = 'none' }}>
              Upgrade ✨
            </Link>
          )}
          <UserMenu user={user} loading={authLoading} onSignOut={signOut} onSignIn={() => setAuthOpen(true)} />
        </div>
      </header>
    )
  }

  // ── Pre-mount shell (avoids SSR/client hydration mismatch) ─────────────────

  if (!mounted) {
    return (
      <>
        <Header />
        <main className="min-h-[calc(100vh-56px)]" />
      </>
    )
  }

  // ── Landing screen ───────────────────────────────────────────────────────────

  if (screen === 'landing') {
    return (
      <>
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
        <Header />

        <main className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-6 gap-10">
          {/* Hero */}
          {activeCard === null && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-2xl text-3xl"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 0 32px rgba(16,185,129,0.4), 0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  ♟
                </div>
              </div>
              <h1
                className="text-5xl font-black mb-3"
                style={{ fontFamily: "'Outfit', sans-serif", color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
              >
                Chess
              </h1>
              <p className="text-base" style={{ color: 'var(--text-muted)' }}>
                Not your average chess game
              </p>
            </div>
          )}

          {/* Card grid or sub-panel */}
          <div className="w-full max-w-xl">
            {activeCard === null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ModeCard
                  icon="🤖"
                  title="vs AI"
                  desc="Play against the Stockfish engine — pick your difficulty"
                  accent="#10b981"
                  accentBg="rgba(16,185,129,0.06)"
                  border="rgba(16,185,129,0.18)"
                  onClick={() => setActiveCard('ai')}
                />
                <ModeCard
                  icon="👥"
                  title="vs Friend"
                  desc="Pass-and-play on one screen, or share a link to play online"
                  accent="#6366f1"
                  accentBg="rgba(99,102,241,0.06)"
                  border="rgba(99,102,241,0.18)"
                  onClick={() => setActiveCard('pvp')}
                />
                <ModeCard
                  icon="👑"
                  title="Chess Royale"
                  desc="Rules change every 8 moves — no pawns, double moves, forced captures and more"
                  accent="#f0a500"
                  accentBg="rgba(240,165,0,0.06)"
                  border="rgba(240,165,0,0.22)"
                  badge="NEW"
                  onClick={() => setActiveCard('royale')}
                />
                <ModeCard
                  icon="🌫️"
                  title="Fog of War"
                  desc="Only see squares your pieces can reach — enemy hides in the fog"
                  accent="#6495ed"
                  accentBg="rgba(100,149,237,0.06)"
                  border="rgba(100,149,237,0.18)"
                  onClick={() => setActiveCard('fog')}
                />
                <ModeCard
                  icon="🎲"
                  title="Dice Chess"
                  desc="Roll 3 random piece types — move them in any order. No check rules, capture the king to win!"
                  accent="#e879f9"
                  accentBg="rgba(232,121,249,0.06)"
                  border="rgba(232,121,249,0.18)"
                  badge="NEW"
                  onClick={() => setActiveCard('dice')}
                />
              </div>
            )}

            {/* ── AI sub-panel ──────────────────────────────────────────────── */}
            {activeCard === 'ai' && (
              <SubPanel title="🤖 vs AI" onBack={() => setActiveCard(null)}>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                    Difficulty
                  </p>
                  <div className="flex flex-col gap-2">
                    {DIFFICULTIES.map(d => (
                      <button
                        key={d.skill}
                        onClick={() => setAiSkill(d.skill)}
                        className="flex flex-col items-start rounded-xl px-4 py-3 text-left transition-all"
                        style={{
                          border: aiSkill === d.skill ? '1px solid rgba(16,185,129,0.5)' : '1px solid var(--border)',
                          borderLeft: aiSkill === d.skill ? '3px solid #10b981' : '1px solid var(--border)',
                          background: aiSkill === d.skill ? 'rgba(16,185,129,0.07)' : 'transparent',
                        }}
                      >
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{d.label}</span>
                        <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                    Your Color
                  </p>
                  <div className="flex gap-2">
                    {([
                      { v: 'white',  icon: '♙', label: 'White' },
                      { v: 'random', icon: '⚄', label: 'Random' },
                      { v: 'black',  icon: '♟', label: 'Black' },
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setAiColor(opt.v)}
                        className="flex-1 flex flex-col items-center py-3 rounded-xl transition-all duration-150"
                        style={{
                          border: aiColor === opt.v ? '1px solid rgba(16,185,129,0.55)' : '1px solid var(--border)',
                          background: aiColor === opt.v ? 'rgba(16,185,129,0.1)' : 'transparent',
                          boxShadow: aiColor === opt.v ? '0 0 12px rgba(16,185,129,0.15)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{opt.icon}</span>
                        <span className="text-xs mt-1 font-medium" style={{ color: aiColor === opt.v ? '#10b981' : 'var(--text-muted)' }}>
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const color = aiColor === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : aiColor
                    startLocalGame('ai', aiSkill, color, false)
                  }}
                  className="w-full py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderRadius: 12,
                    boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                  }}
                >
                  Start Game
                </button>
              </SubPanel>
            )}

            {/* ── PvP sub-panel ─────────────────────────────────────────────── */}
            {activeCard === 'pvp' && (
              <SubPanel title="👥 vs Friend — Classic" onBack={() => setActiveCard(null)}>
                <p className="text-xs -mt-2" style={{ color: 'var(--text-muted)' }}>
                  Standard chess — no special rules.
                </p>
                <OnlineColorPicker value={onlineColor} onChange={setOnlineColor} />
                <div className="flex flex-col gap-3">
                  <OptionRow
                    icon="🖥️"
                    title="Local Match"
                    desc="Two players on the same screen — pass and play"
                    onClick={() => startLocalGame('pvp', 10, 'white', false)}
                  />
                  <OptionRow
                    icon="🔗"
                    title="Play Online"
                    desc="Create a game and share the link with your friend"
                    loading={mpLoading}
                    onClick={() => startOnlineGame(false, false, onlineColor)}
                  />
                </div>
              </SubPanel>
            )}

            {/* ── Chess Royale sub-panel ────────────────────────────────────── */}
            {activeCard === 'royale' && (
              <SubPanel title="👑 Chess Royale" onBack={() => setActiveCard(null)}>
                <div
                  className="px-4 py-3 text-xs rounded-xl -mt-2"
                  style={{
                    background: 'rgba(240,165,0,0.07)',
                    border: '1px solid rgba(240,165,0,0.2)',
                    color: '#f0a500',
                    lineHeight: 1.6,
                  }}
                >
                  Every 8 moves a random rule kicks in — no pawns, double moves, forced captures, and more. Pure chaos.
                </div>
                <OnlineColorPicker value={onlineColor} onChange={setOnlineColor} />
                <div className="flex flex-col gap-3">
                  <OptionRow
                    icon="🖥️"
                    title="Local Match"
                    desc="Two players on the same screen"
                    accent="#f0a500"
                    onClick={() => startLocalGame('pvp', 10, 'white', true)}
                  />
                  <OptionRow
                    icon="🔗"
                    title="Play Online"
                    desc="Share a link and play remotely"
                    accent="#f0a500"
                    loading={mpLoading}
                    onClick={() => startOnlineGame(true, false, onlineColor)}
                  />
                </div>
              </SubPanel>
            )}

            {/* ── Fog of War sub-panel ──────────────────────────────────────── */}
            {activeCard === 'fog' && (
              <SubPanel title="🌫️ Fog of War" onBack={() => setActiveCard(null)}>
                <div
                  className="px-4 py-3 text-xs rounded-xl -mt-2"
                  style={{
                    background: 'rgba(100,149,237,0.07)',
                    border: '1px solid rgba(100,149,237,0.2)',
                    color: '#6495ed',
                    lineHeight: 1.6,
                  }}
                >
                  You only see squares your pieces can reach. Enemy pieces are hidden until they enter your vision zone.
                </div>
                <OnlineColorPicker value={onlineColor} onChange={setOnlineColor} />
                <OptionRow
                  icon="🔗"
                  title="Play Online"
                  desc="Create a game and share the link with your friend"
                  accent="#6495ed"
                  loading={mpLoading}
                  onClick={() => startOnlineGame(false, true, onlineColor)}
                />
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Local play isn't available — no point hiding pieces on the same screen!
                </p>
              </SubPanel>
            )}

            {/* ── Dice Chess sub-panel ──────────────────────────────────────── */}
            {activeCard === 'dice' && (
              <SubPanel title="🎲 Dice Chess" onBack={() => setActiveCard(null)}>
                <div
                  className="px-4 py-3 text-xs rounded-xl -mt-2"
                  style={{
                    background: 'rgba(232,121,249,0.07)',
                    border: '1px solid rgba(232,121,249,0.2)',
                    color: '#e879f9',
                    lineHeight: 1.6,
                  }}
                >
                  Each turn 3 random piece types are drawn — move them in any order. No check rules apply; capture the king directly to win!
                </div>
                <OnlineColorPicker value={onlineColor} onChange={setOnlineColor} />
                <div className="flex flex-col gap-3">
                  <OptionRow
                    icon="🖥️"
                    title="Local Match"
                    desc="Two players on the same screen — pass and play"
                    accent="#e879f9"
                    onClick={() => startLocalGame('dice', 10, 'white', false, true)}
                  />
                  <OptionRow
                    icon="🔗"
                    title="Play Online"
                    desc="Share a link and play remotely"
                    accent="#e879f9"
                    loading={mpLoading}
                    onClick={() => startOnlineGame(false, false, onlineColor, true)}
                  />
                </div>
              </SubPanel>
            )}
          </div>
        </main>
      </>
    )
  }

  // ── Game screen ──────────────────────────────────────────────────────────────

  const diffLabel = DIFF_LABEL[skillLevel] ?? `Level ${skillLevel}`

  return (
    <>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      <Header />

      <main className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-6 gap-6">
        <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl">
          {/* Board */}
          <div className="flex-1 flex justify-center relative">
            <div style={{ filter: 'drop-shadow(0 32px 64px rgba(0,0,0,0.85)) drop-shadow(0 8px 24px rgba(0,0,0,0.6))' }}>
              <BoardComponent
                board={gameState.board}
                selectedSquare={selectedSquare}
                legalMoves={legalMoves}
                lastMove={lastMove}
                onSquareClick={handleSquareClick}
                flipped={mode === 'ai' && playerColor === 'black'}
              />
            </div>
            {aiThinking && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold"
                  style={{
                    background: 'rgba(7,11,15,0.88)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '999px',
                    color: 'var(--accent)',
                    boxShadow: '0 0 20px rgba(16,185,129,0.15)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: 'var(--accent)', animation: 'jade-pulse 1.4s ease-in-out infinite' }}
                  />
                  AI is thinking…
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div
            className="w-full lg:w-72 flex flex-col gap-4 p-5"
            style={{
              background: 'rgba(9,14,22,0.75)',
              border: '1px solid rgba(16,185,129,0.08)',
              borderRadius: '20px',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
              minHeight: '280px',
            }}
          >
            {/* Mode indicator */}
            <div
              className="text-xs text-center py-1.5 px-3"
              style={{
                background: mode === 'ai' ? 'rgba(16,185,129,0.08)' : mode === 'dice' ? 'rgba(232,121,249,0.08)' : 'rgba(255,255,255,0.04)',
                border: mode === 'ai' ? '1px solid rgba(16,185,129,0.2)' : mode === 'dice' ? '1px solid rgba(232,121,249,0.2)' : '1px solid var(--border)',
                borderRadius: '999px',
                color: mode === 'ai' ? 'var(--accent)' : mode === 'dice' ? '#e879f9' : 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              {mode === 'ai'
                ? `🤖 vs AI — ${diffLabel}${!engineReady ? ' (loading…)' : ''}`
                : mode === 'dice' ? '🎲 Dice Chess'
                : gameState.royale ? '👑 Chess Royale' : '👥 Two Players'}
            </div>

            {/* Royale rule banner */}
            {gameState.royale && (
              <div
                style={{
                  padding: '8px 14px',
                  background: 'linear-gradient(135deg, rgba(240,165,0,0.1), rgba(240,165,0,0.04))',
                  border: '1px solid rgba(240,165,0,0.3)',
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f0a500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Chess Royale
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(240,165,0,0.65)' }}>
                    <span style={{ fontWeight: 700, color: '#f0a500' }}>{gameState.royale.movesUntilChange}</span>{' '}moves left
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff', marginTop: 3 }}>
                  {ROYALE_RULE_LABELS[gameState.royale.rule]}
                </p>
                {gameState.royale.rule === 'double_move' && gameState.royale.doubleMoveDone && (
                  <p style={{ fontSize: '0.7rem', color: '#f0a500', fontWeight: 700, marginTop: 2 }}>Move 2 of 2</p>
                )}
              </div>
            )}

            {/* Dice panel */}
            {gameState.dice && !gameState.isCheckmate && !gameState.isStalemate && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, rgba(232,121,249,0.08), rgba(232,121,249,0.03))',
                  border: '1px solid rgba(232,121,249,0.25)',
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#e879f9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    🎲 Dice — {gameState.currentTurn === 'white' ? 'White' : 'Black'}&apos;s turn
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {getDiceSlots(gameState.dice.drawnPieces, gameState.dice.remaining).map((slot, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 4px',
                        borderRadius: 8,
                        border: `1px solid ${slot.active ? 'rgba(232,121,249,0.4)' : 'rgba(255,255,255,0.07)'}`,
                        background: slot.active ? 'rgba(232,121,249,0.1)' : 'rgba(255,255,255,0.03)',
                        opacity: slot.active ? 1 : 0.35,
                        transition: 'all 0.2s',
                      }}
                    >
                      <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>
                        {DICE_PIECE_ICONS[slot.type][gameState.currentTurn]}
                      </span>
                      <span style={{ fontSize: '0.6rem', marginTop: 3, color: slot.active ? '#e879f9' : 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>
                        {slot.type}
                      </span>
                    </div>
                  ))}
                </div>
                {Object.keys(gameState.dice.remaining).length === 0 && (
                  <p style={{ fontSize: '0.7rem', color: '#e879f9', fontWeight: 700, marginTop: 6, textAlign: 'center' }}>
                    All moves used — waiting for next turn
                  </p>
                )}
              </div>
            )}

            {/* Status */}
            <GameStatus gameState={gameState} onNewGame={goToLanding} />

            <div style={{ height: '1px', background: 'rgba(16,185,129,0.06)' }} />

            {/* Controls */}
            <div className="flex gap-2">
              <button
                onClick={goToLanding}
                className="flex-1 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px active:translate-y-0"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderRadius: '10px',
                  boxShadow: '0 2px 12px rgba(16,185,129,0.3)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(16,185,129,0.5)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 12px rgba(16,185,129,0.3)' }}
              >
                New Game
              </button>
              <button
                onClick={undoMove}
                disabled={history.length === 0 || aiThinking}
                className="flex-1 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:-translate-y-px active:translate-y-0"
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '10px' }}
                onMouseEnter={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  if (!b.disabled) { b.style.borderColor = 'rgba(16,185,129,0.4)'; b.style.color = 'var(--text-primary)' }
                }}
                onMouseLeave={e => {
                  const b = e.currentTarget as HTMLButtonElement
                  b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text-muted)'
                }}
              >
                Undo
              </button>
            </div>

            {/* Pass turn button for dice mode when no moves available */}
            {gameState.dice && !gameState.isCheckmate && !gameState.isStalemate &&
              Object.keys(gameState.dice.remaining).length > 0 &&
              !hasDiceMove(gameState.board, gameState.currentTurn, gameState.dice.remaining, gameState.enPassantTarget) && (
              <button
                onClick={passDice}
                className="w-full py-2.5 text-sm font-bold transition-all duration-200 hover:-translate-y-px"
                style={{
                  background: 'linear-gradient(135deg, rgba(232,121,249,0.15), rgba(232,121,249,0.08))',
                  border: '1px solid rgba(232,121,249,0.4)',
                  color: '#e879f9',
                  borderRadius: '10px',
                }}
              >
                Pass Turn (no moves)
              </button>
            )}

            {/* Resign */}
            {movesCount > 0 && !gameState.isCheckmate && !gameState.isStalemate && !gameState.isResigned && (
              <div className="flex gap-2">
                {resignConfirm ? (
                  <>
                    <button
                      onClick={() => { setResignConfirm(false); resign() }}
                      className="flex-1 py-2 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px"
                      style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', borderRadius: '10px', boxShadow: '0 2px 12px rgba(220,38,38,0.3)' }}
                    >
                      Yes, resign
                    </button>
                    <button
                      onClick={() => setResignConfirm(false)}
                      className="flex-1 py-2 text-sm font-semibold transition-all duration-200"
                      style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '10px' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setResignConfirm(true)}
                    className="w-full py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-px"
                    style={{ background: 'transparent', border: '1px solid rgba(220,38,38,0.3)', color: '#f87171', borderRadius: '10px' }}
                    onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'rgba(220,38,38,0.6)'; b.style.color = '#ef4444' }}
                    onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'rgba(220,38,38,0.3)'; b.style.color = '#f87171' }}
                  >
                    Resign
                  </button>
                )}
              </div>
            )}

            {/* Move history */}
            <div className="flex-1 overflow-hidden" style={{ maxHeight: '360px' }}>
              <MoveHistory history={history} />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}