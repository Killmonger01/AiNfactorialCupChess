'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BoardComponent from '@/components/Board'
import GameStatus from '@/components/GameStatus'
import MoveHistory from '@/components/MoveHistory'
import SetupModal from '@/components/SetupModal'
import AuthModal from '@/components/AuthModal'
import UserMenu from '@/components/UserMenu'
import { useChess, type GameMode } from '@/hooks/useChess'
import { useAuth } from '@/hooks/useAuth'
import { useIsPro } from '@/hooks/useIsPro'
import { saveGame } from '@/lib/db'
import { toAlgebraicNotation, createInitialGameState } from '@/lib/chess'
import { supabase } from '@/lib/supabase'
import { createMultiplayerGame, getOrCreatePlayerId } from '@/lib/multiplayer'

const DIFFICULTY_LABELS: Record<number, string> = {
  2: 'Easy',
  10: 'Medium',
  20: 'Hard',
}

export default function Home() {
  const router = useRouter()

  const {
    gameState,
    history,
    selectedSquare,
    legalMoves,
    lastMove,
    mode,
    skillLevel,
    playerColor,
    movesCount,
    aiThinking,
    engineReady,
    handleSquareClick,
    undoMove,
    newGame,
    resign,
  } = useChess()

  const { user, loading: authLoading, signOut } = useAuth()
  const { isPro } = useIsPro()

  const [setupOpen, setSetupOpen]         = useState(false)
  const [authOpen, setAuthOpen]           = useState(false)
  const [resignConfirm, setResignConfirm] = useState(false)
  const [mpLoading, setMpLoading]         = useState(false)
  // Prevents saving the same completed game more than once
  const gameSavedRef = useRef<boolean>(false)

  // Show setup modal on first load if there is no saved game
  useEffect(() => {
    const saved = localStorage.getItem('chess_game_state_v2')
    if (!saved) setSetupOpen(true)
  }, [])

  // Auto-save completed games for logged-in users
  useEffect(() => {
    if (!user) return
    if (!gameState.isCheckmate && !gameState.isStalemate) return
    if (gameSavedRef.current) return  // already saved this game

    gameSavedRef.current = true

    // Derive result from whose turn it is when checkmate/stalemate is detected
    const result: 'white_wins' | 'black_wins' | 'draw' = gameState.isStalemate
      ? 'draw'
      : gameState.currentTurn === 'black'
        ? 'white_wins'   // black is in checkmate → white wins
        : 'black_wins'   // white is in checkmate → black wins

    // Inline difficulty mapping: 0-2 easy, 3-10 medium, 11-20 hard
    const ai_difficulty: 'easy' | 'medium' | 'hard' | null =
      mode !== 'ai' ? null
        : skillLevel <= 2  ? 'easy'
        : skillLevel <= 10 ? 'medium'
        : 'hard'

    const pgn = history.map(e => toAlgebraicNotation(e.move)).join(' ')

    saveGame({
      user_id:      user.id,
      pgn,
      result,
      opponent:     mode === 'ai' ? 'ai' : 'human',
      ai_difficulty,
      moves_count:  movesCount,
    }).catch(err => console.error('Failed to save game:', err))
  }, [gameState.isCheckmate, gameState.isStalemate, gameState.currentTurn, user, movesCount, history, mode, skillLevel])

  // Reset the save flag whenever a new game begins
  useEffect(() => {
    if (movesCount === 0) gameSavedRef.current = false
  }, [movesCount])

  function handleStart(m: GameMode, skill: number, color: 'white' | 'black' = 'white') {
    setSetupOpen(false)
    newGame(m, skill, color)
  }

  async function handleStartMultiplayer() {
    if (mpLoading) return
    console.log('[MP] Play with Friend clicked')
    setMpLoading(true)
    setSetupOpen(false)
    try {
      const playerId     = getOrCreatePlayerId()
      console.log('[MP] player id:', playerId)
      const initialState = createInitialGameState()
      const gameId       = await createMultiplayerGame(supabase, initialState, playerId)
      console.log('[MP] game created, id:', gameId)
      router.push(`/play/${gameId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[MP] createMultiplayerGame failed:', msg)
      // Show the error visibly so the user (and developer) can act on it
      window.alert(
        `Could not create multiplayer game:\n\n${msg}\n\n` +
        'Make sure the multiplayer_games table exists in Supabase ' +
        'and your NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars are set.'
      )
      // Reopen modal so the user can try another mode
      setSetupOpen(true)
    } finally {
      setMpLoading(false)
    }
  }

  const diffLabel = DIFFICULTY_LABELS[skillLevel] ?? `Level ${skillLevel}`

  return (
    <>
      {setupOpen && (
        <SetupModal
          onStart={handleStart}
          onStartMultiplayer={handleStartMultiplayer}
          multiplayerLoading={mpLoading}
        />
      )}
      {authOpen  && <AuthModal  onClose={() => setAuthOpen(false)} />}

      {/* ── Top header ───────────────────────────────────────────────────── */}
      <header
        className="w-full px-6 py-3.5 flex items-center justify-between flex-shrink-0"
        style={{
          background: 'rgba(7,11,15,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(16,185,129,0.1)',
          boxShadow: '0 1px 0 rgba(16,185,129,0.05)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 0 16px rgba(16,185,129,0.4)',
            }}
          >
            <span style={{ fontSize: '1rem', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>♟</span>
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Outfit', sans-serif" }}>
            Chess
          </span>
        </div>

        {/* Nav */}
        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            className="text-sm font-medium transition-all duration-200"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)' }}
          >
            Profile
          </Link>

          {isPro ? (
            <span
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, #f0a500, #d97706)',
                color: '#1a0a00',
                boxShadow: '0 0 16px rgba(240,165,0,0.35)',
                letterSpacing: '0.03em',
              }}
            >
              ✨ Pro
            </span>
          ) : (
            <Link
              href="/pricing"
              className="text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-all duration-200"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: 'var(--accent)',
              }}
              onMouseEnter={e => {
                const a = e.currentTarget as HTMLAnchorElement
                a.style.background = 'rgba(16,185,129,0.18)'
                a.style.boxShadow = '0 0 16px rgba(16,185,129,0.2)'
              }}
              onMouseLeave={e => {
                const a = e.currentTarget as HTMLAnchorElement
                a.style.background = 'rgba(16,185,129,0.1)'
                a.style.boxShadow = 'none'
              }}
            >
              Upgrade ✨
            </Link>
          )}

          <UserMenu
            user={user}
            loading={authLoading}
            onSignOut={signOut}
            onSignIn={() => setAuthOpen(true)}
          />
        </div>
      </header>

      <main className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center p-6 gap-6">
        <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl">
          {/* Board — chess table feel */}
          <div className="flex-1 flex justify-center relative">
            {/* Outer table shadow */}
            <div
              style={{
                filter: 'drop-shadow(0 32px 64px rgba(0,0,0,0.85)) drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
              }}
            >
              <BoardComponent
                board={gameState.board}
                selectedSquare={selectedSquare}
                legalMoves={legalMoves}
                lastMove={lastMove}
                onSquareClick={handleSquareClick}
                flipped={mode === 'ai' && playerColor === 'black'}
              />
            </div>
            {/* AI thinking overlay */}
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
                background: mode === 'ai'
                  ? 'rgba(16,185,129,0.08)'
                  : 'rgba(255,255,255,0.04)',
                border: mode === 'ai'
                  ? '1px solid rgba(16,185,129,0.2)'
                  : '1px solid var(--border)',
                borderRadius: '999px',
                color: mode === 'ai' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              {mode === 'ai'
                ? `🤖 vs AI — ${diffLabel}${!engineReady ? ' (loading…)' : ''}`
                : '👥 Two Players'}
            </div>

            {/* Status */}
            <GameStatus gameState={gameState} onNewGame={() => newGame(mode, skillLevel)} />

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(16,185,129,0.06)' }} />

            {/* Controls */}
            <div className="flex gap-2">
              <button
                onClick={() => setSetupOpen(true)}
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
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  borderRadius: '10px',
                }}
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

            {/* Resign */}
            {!gameState.isCheckmate && !gameState.isStalemate && !gameState.isResigned && (
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
