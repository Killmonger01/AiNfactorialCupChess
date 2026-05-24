'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BoardComponent from '@/components/Board'
import { getLegalMoves, movePiece } from '@/lib/chess'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import { useAuth } from '@/hooks/useAuth'
import { saveGame } from '@/lib/db'
import type { Square } from '@/lib/types'

export default function MultiplayerGamePage({
  params,
}: {
  params: { gameId: string }
}) {
  const { gameId } = params
  const router = useRouter()

  const {
    role,
    opponentConnected,
    gameState,
    lastMove,
    status,
    error,
    applyMove,
    resign,
  } = useMultiplayer(gameId)

  const { user } = useAuth()

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoves, setLegalMoves]         = useState<Square[]>([])
  const [copied, setCopied]                 = useState(false)
  const [resignConfirm, setResignConfirm]   = useState(false)

  // Refs for game-save logic
  const gameSavedRef    = useRef(false)
  const moveHistoryRef  = useRef<string[]>([])
  const lastMoveSigRef  = useRef<string>('')

  // Track each move for PGN as lastMove changes
  useEffect(() => {
    if (!lastMove) return
    const sig = `${lastMove.from.row},${lastMove.from.col}-${lastMove.to.row},${lastMove.to.col}`
    if (sig === lastMoveSigRef.current) return  // skip duplicate (e.g. echo on reconnect)
    lastMoveSigRef.current = sig
    moveHistoryRef.current.push(lastMove.notation ?? '?')
  }, [lastMove])

  // Save to Supabase when the game ends, if the user is logged in
  useEffect(() => {
    if (!gameState?.isCheckmate && !gameState?.isStalemate) return
    if (!user || gameSavedRef.current) return
    gameSavedRef.current = true

    const result: 'white_wins' | 'black_wins' | 'draw' = gameState.isStalemate
      ? 'draw'
      : gameState.currentTurn === 'black'
        ? 'white_wins'   // black is in checkmate → white wins
        : 'black_wins'   // white is in checkmate → black wins

    saveGame({
      user_id:      user.id,
      pgn:          moveHistoryRef.current.join(' '),
      result,
      opponent:     'human',
      ai_difficulty: null,
      moves_count:  moveHistoryRef.current.length,
    }).catch(err => console.error('[MP] Failed to save game:', err))
  }, [gameState?.isCheckmate, gameState?.isStalemate, gameState?.currentTurn, user])

  // Clear selection whenever the active turn changes (own move sent or opponent moved)
  useEffect(() => {
    setSelectedSquare(null)
    setLegalMoves([])
  }, [gameState?.currentTurn])

  const isMyTurn =
    !!role &&
    !!gameState &&
    gameState.currentTurn === role &&
    opponentConnected &&
    status === 'active' &&
    !gameState.isCheckmate &&
    !gameState.isStalemate

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (!isMyTurn || !gameState) return

      // If a piece is already selected, try to move it
      if (selectedSquare) {
        const isLegal = legalMoves.some(m => m.row === sq.row && m.col === sq.col)
        if (isLegal) {
          const result = movePiece(gameState.board, selectedSquare, sq, gameState)
          setSelectedSquare(null)
          setLegalMoves([])
          applyMove(result.gameState, result.move).catch(console.error)
          return
        }
      }

      // Select a piece that belongs to us
      const piece = gameState.board[sq.row][sq.col]
      if (piece && piece.color === role) {
        setSelectedSquare(sq)
        setLegalMoves(getLegalMoves(gameState.board, sq, gameState))
      } else {
        setSelectedSquare(null)
        setLegalMoves([])
      }
    },
    [isMyTurn, gameState, selectedSquare, legalMoves, role, applyMove],
  )

  const shareUrl =
    typeof window !== 'undefined' ? window.location.href : `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/play/${gameId}`

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const gameOver = !!gameState && (gameState.isCheckmate || gameState.isStalemate)

  // ── Error screen ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#1a1a2e' }}>
        <p className="text-red-400 text-center px-4">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 rounded-lg text-white font-semibold"
          style={{ background: '#0f3460' }}
        >
          Back to Home
        </button>
      </div>
    )
  }

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (status === 'connecting' || !gameState || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a2e' }}>
        <p style={{ color: '#a0aec0' }}>Connecting…</p>
      </div>
    )
  }

  // ── Status bar text ─────────────────────────────────────────────────────────
  let statusText = ''
  let statusColor = '#a0aec0'
  if (gameState.isCheckmate) {
    statusText = gameState.isResigned
      ? `${gameState.resignedBy === 'white' ? 'White' : 'Black'} resigned — ${gameState.winner === 'white' ? 'White' : 'Black'} wins!`
      : `Checkmate — ${gameState.winner === 'white' ? 'White' : 'Black'} wins!`
    statusColor = '#e05252'
  } else if (gameState.isStalemate) {
    statusText = 'Stalemate — Draw!'
    statusColor = '#e05252'
  } else if (!opponentConnected) {
    statusText = 'Waiting for opponent…'
  } else if (gameState.isCheck) {
    statusText = isMyTurn ? '⚠ CHECK — Your move' : "⚠ Check — Opponent's move"
    statusColor = '#f59e0b'
  } else {
    statusText = isMyTurn ? 'Your turn' : "Opponent's turn…"
    statusColor = isMyTurn ? '#769656' : '#a0aec0'
  }

  return (
    <div className="min-h-screen" style={{ background: '#1a1a2e' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="w-full px-4 py-3 flex items-center justify-between"
        style={{ background: '#0f3460' }}
      >
        <button
          onClick={() => router.push('/')}
          className="text-white font-bold tracking-wide hover:opacity-80 transition-opacity"
        >
          ♟ Chess
        </button>
        <span className="text-sm" style={{ color: '#a0aec0' }}>
          Playing as{' '}
          <span className="font-semibold text-white capitalize">{role}</span>
        </span>
      </header>

      <main className="flex flex-col items-center p-4 gap-4 pt-6">

        {/* ── Share-link banner (white waiting) ──────────────────────── */}
        {status === 'waiting' && role === 'white' && (
          <div
            className="w-full max-w-lg rounded-xl p-4"
            style={{ background: '#16213e', border: '1px solid #0f3460' }}
          >
            <p className="text-white font-semibold text-sm text-center mb-3">
              Share this link with your friend
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none"
                style={{ background: '#0f3460' }}
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0"
                style={{ background: '#769656' }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-center mt-3" style={{ color: '#a0aec0' }}>
              Waiting for opponent to join…
            </p>
          </div>
        )}

        {/* ── Status bar ─────────────────────────────────────────────── */}
        <div
          className="rounded-xl px-5 py-2 text-sm font-semibold"
          style={{ background: '#16213e', color: statusColor }}
        >
          {statusText}
        </div>

        {/* ── Board ──────────────────────────────────────────────────── */}
        <BoardComponent
          board={gameState.board}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          onSquareClick={handleSquareClick}
          flipped={role === 'black'}
        />

        {/* ── Role + connection indicator ─────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs" style={{ color: '#a0aec0' }}>
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{
              background: role === 'white' ? '#f0d9b5' : '#1a1a1a',
              border: '1px solid #555',
            }}
          />
          <span>
            You are <span className="font-semibold text-white capitalize">{role}</span>
          </span>
          <span className="opacity-40">·</span>
          <span style={{ color: opponentConnected ? '#769656' : '#f59e0b' }}>
            {opponentConnected ? 'Opponent connected' : 'Opponent not connected'}
          </span>
        </div>

        {/* ── Game-over actions ───────────────────────────────────────── */}
        {gameOver && (
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-6 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#0f3460' }}
          >
            Back to Home
          </button>
        )}
        {/* ── Resign ─────────────────────────────────────────────────────── */}
        {!gameOver && status === 'active' && (
          <div className="flex gap-2 w-full max-w-sm">
            {resignConfirm ? (
              <>
                <button
                  onClick={async () => { setResignConfirm(false); await resign() }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 2px 10px rgba(220,38,38,0.3)' }}
                >
                  Yes, resign
                </button>
                <button
                  onClick={() => setResignConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: '#0f3460' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setResignConfirm(true)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'transparent', border: '1px solid rgba(220,38,38,0.35)', color: '#f87171' }}
              >
                Resign
              </button>
            )}
          </div>
        )}      </main>
    </div>
  )
}
