'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BoardComponent from '@/components/Board'
import { getLegalMoves, movePiece } from '@/lib/chess'
import { getLegalMovesRoyale, movePieceRoyale, ROYALE_RULE_LABELS } from '@/lib/royale'
import { getVisibleSquares } from '@/lib/fogOfWar'
import {
  getDiceLegalMoves,
  movePieceDice,
  passDiceTurn,
  getDiceSlots,
  DICE_PIECE_ICONS,
  hasDiceMove,
} from '@/lib/diceChess'
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
    fogOfWar,
    diceMode,
    applyMove,
    resign,
  } = useMultiplayer(gameId)

  const { user } = useAuth()

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoves, setLegalMoves]         = useState<Square[]>([])
  const [copied, setCopied]                 = useState(false)
  const [resignConfirm, setResignConfirm]   = useState(false)

  const gameSavedRef    = useRef(false)
  const moveHistoryRef  = useRef<string[]>([])
  const lastMoveSigRef  = useRef<string>('')

  useEffect(() => {
    if (!lastMove) return
    const sig = `${lastMove.from.row},${lastMove.from.col}-${lastMove.to.row},${lastMove.to.col}`
    if (sig === lastMoveSigRef.current) return
    lastMoveSigRef.current = sig
    moveHistoryRef.current.push(lastMove.notation ?? '?')
  }, [lastMove])

  useEffect(() => {
    if (!gameState?.isCheckmate && !gameState?.isStalemate) return
    if (!user || gameSavedRef.current) return
    gameSavedRef.current = true
    const result: 'white_wins' | 'black_wins' | 'draw' = gameState.isStalemate
      ? 'draw'
      : gameState.currentTurn === 'black' ? 'white_wins' : 'black_wins'
    saveGame({
      user_id:       user.id,
      pgn:           moveHistoryRef.current.join(' '),
      result,
      opponent:      'human',
      ai_difficulty: null,
      moves_count:   moveHistoryRef.current.length,
    }).catch(err => console.error('[MP] Failed to save game:', err))
  }, [gameState?.isCheckmate, gameState?.isStalemate, gameState?.currentTurn, user])

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

      // ── Dice Chess mode ────────────────────────────────────────────────────
      if (diceMode && gameState.dice) {
        const remaining = gameState.dice.remaining

        if (selectedSquare) {
          const isLegal = legalMoves.some(m => m.row === sq.row && m.col === sq.col)
          if (isLegal) {
            const result = movePieceDice(gameState.board, selectedSquare, sq, gameState)
            setSelectedSquare(null)
            setLegalMoves([])
            applyMove(result.gameState, result.move).catch(console.error)
            return
          }
        }

        const piece = gameState.board[sq.row][sq.col]
        if (piece && piece.color === role && (remaining[piece.type] ?? 0) > 0) {
          setSelectedSquare(sq)
          setLegalMoves(getDiceLegalMoves(gameState.board, sq, gameState))
        } else {
          setSelectedSquare(null)
          setLegalMoves([])
        }
        return
      }

      // ── Normal / Royale mode ───────────────────────────────────────────────
      if (selectedSquare) {
        const isLegal = legalMoves.some(m => m.row === sq.row && m.col === sq.col)
        if (isLegal) {
          const result = gameState.royale
            ? movePieceRoyale(gameState.board, selectedSquare, sq, gameState)
            : movePiece(gameState.board, selectedSquare, sq, gameState)
          setSelectedSquare(null)
          setLegalMoves([])
          applyMove(result.gameState, result.move).catch(console.error)
          return
        }
      }

      const piece = gameState.board[sq.row][sq.col]
      if (piece && piece.color === role) {
        setSelectedSquare(sq)
        setLegalMoves(
          gameState.royale
            ? getLegalMovesRoyale(gameState.board, sq, gameState)
            : getLegalMoves(gameState.board, sq, gameState),
        )
      } else {
        setSelectedSquare(null)
        setLegalMoves([])
      }
    },
    [isMyTurn, gameState, selectedSquare, legalMoves, role, diceMode, applyMove],
  )

  const handlePassDice = useCallback(async () => {
    if (!gameState || !diceMode) return
    const result = passDiceTurn(gameState)
    await applyMove(result.gameState, result.move).catch(console.error)
  }, [gameState, diceMode, applyMove])

  const shareUrl =
    typeof window !== 'undefined' ? window.location.href : `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/play/${gameId}`

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const gameOver = !!gameState && (gameState.isCheckmate || gameState.isStalemate)

  const visibleSquares = useMemo(() => {
    if (!fogOfWar || !gameState || !role || gameOver) return undefined
    return getVisibleSquares(gameState.board, role, gameState)
  }, [fogOfWar, gameState, role, gameOver])

  const canPassDice =
    diceMode &&
    isMyTurn &&
    !!gameState?.dice &&
    Object.keys(gameState.dice.remaining).length > 0 &&
    !hasDiceMove(gameState.board, role!, gameState.dice.remaining, gameState.enPassantTarget)

  // ── Error screen ──────────────────────────────────────────────────────────
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

  // ── Loading screen ────────────────────────────────────────────────────────
  if (status === 'connecting' || !gameState || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1a1a2e' }}>
        <p style={{ color: '#a0aec0' }}>Connecting…</p>
      </div>
    )
  }

  // ── Status text ───────────────────────────────────────────────────────────
  let statusText = ''
  let statusColor = '#a0aec0'
  if (gameState.isCheckmate) {
    statusText = gameState.isResigned
      ? `${gameState.resignedBy === 'white' ? 'White' : 'Black'} resigned — ${gameState.winner === 'white' ? 'White' : 'Black'} wins!`
      : `${diceMode ? 'King captured' : 'Checkmate'} — ${gameState.winner === 'white' ? 'White' : 'Black'} wins!`
    statusColor = '#e05252'
  } else if (gameState.isStalemate) {
    statusText = 'Stalemate — Draw!'
    statusColor = '#e05252'
  } else if (!opponentConnected) {
    statusText = 'Waiting for opponent…'
  } else if (gameState.isCheck && !diceMode) {
    statusText = isMyTurn ? '⚠ CHECK — Your move' : "⚠ Check — Opponent's move"
    statusColor = '#f59e0b'
  } else {
    statusText = isMyTurn ? 'Your turn' : "Opponent's turn…"
    statusColor = isMyTurn ? '#769656' : '#a0aec0'
  }

  return (
    <div className="min-h-screen" style={{ background: '#1a1a2e' }}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
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

        {/* ── Share-link banner ─────────────────────────────────────────── */}
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

        {/* ── Status bar ───────────────────────────────────────────────── */}
        <div
          className="rounded-xl px-5 py-2 text-sm font-semibold"
          style={{ background: '#16213e', color: statusColor }}
        >
          {statusText}
        </div>

        {/* ── Royale rule banner ────────────────────────────────────────── */}
        {gameState.royale && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 20px',
              background: 'linear-gradient(135deg, rgba(240,165,0,0.1), rgba(240,165,0,0.04))',
              border: '1px solid rgba(240,165,0,0.3)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f0a500', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Chess Royale
              </span>
              <span style={{ width: 1, height: 14, background: 'rgba(240,165,0,0.3)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                {ROYALE_RULE_LABELS[gameState.royale.rule]}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.7rem', color: 'rgba(240,165,0,0.65)' }}>
                Rule changes in{' '}
                <span style={{ fontWeight: 700, color: '#f0a500' }}>
                  {gameState.royale.movesUntilChange}
                </span>{' '}
                {gameState.royale.movesUntilChange === 1 ? 'move' : 'moves'}
              </span>
              {gameState.royale.rule === 'double_move' && gameState.royale.doubleMoveDone && (
                <>
                  <span style={{ color: 'rgba(240,165,0,0.3)' }}>·</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f0a500' }}>
                    Move 2 of 2
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Fog of War banner ─────────────────────────────────────────── */}
        {fogOfWar && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              background: 'linear-gradient(135deg, rgba(100,149,237,0.1), rgba(100,149,237,0.04))',
              border: '1px solid rgba(100,149,237,0.3)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
            }}
          >
            <span style={{ fontSize: '1rem' }}>🌫️</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6495ed' }}>Fog of War</span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(100,149,237,0.65)' }}>
              — only your reachable squares are visible
            </span>
          </div>
        )}

        {/* ── Dice Chess banner ─────────────────────────────────────────── */}
        {diceMode && gameState.dice && !gameOver && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '10px 16px',
              background: 'linear-gradient(135deg, rgba(232,121,249,0.1), rgba(232,121,249,0.04))',
              border: '1px solid rgba(232,121,249,0.3)',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#e879f9', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              🎲 Dice — {gameState.currentTurn === 'white' ? 'White' : 'Black'}&apos;s turn
            </span>
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
                  <span style={{ fontSize: '0.6rem', marginTop: 3, color: slot.active ? '#e879f9' : '#a0aec0', fontWeight: 600, textTransform: 'capitalize' }}>
                    {slot.type}
                  </span>
                </div>
              ))}
            </div>
            {Object.keys(gameState.dice.remaining).length === 0 && (
              <p style={{ fontSize: '0.7rem', color: '#e879f9', fontWeight: 700, textAlign: 'center' }}>
                All moves used — waiting for next turn
              </p>
            )}
          </div>
        )}

        {/* ── Board ────────────────────────────────────────────────────── */}
        <BoardComponent
          board={gameState.board}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          lastMove={lastMove}
          onSquareClick={handleSquareClick}
          flipped={role === 'black'}
          visibleSquares={visibleSquares}
        />

        {/* ── Role + connection indicator ───────────────────────────────── */}
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

        {/* ── Pass dice turn ────────────────────────────────────────────── */}
        {canPassDice && (
          <button
            onClick={handlePassDice}
            className="px-6 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(232,121,249,0.15), rgba(232,121,249,0.08))',
              border: '1px solid rgba(232,121,249,0.4)',
              color: '#e879f9',
            }}
          >
            Pass Turn (no moves available)
          </button>
        )}

        {/* ── Game-over actions ─────────────────────────────────────────── */}
        {gameOver && (
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-6 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#0f3460' }}
          >
            Back to Home
          </button>
        )}

        {/* ── Resign ───────────────────────────────────────────────────── */}
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
        )}

      </main>
    </div>
  )
}