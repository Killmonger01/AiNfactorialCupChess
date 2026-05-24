'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  boardToFEN,
  createInitialGameState,
  getLegalMoves,
  movePiece,
} from '@/lib/chess'
import type { Board, GameState } from '@/lib/types'
import type { GameRow } from '@/lib/db'
import { useIsPro } from '@/hooks/useIsPro'
import Link from 'next/link'

// ─── Constants ───────────────────────────────────────────────────────────────

const RESULT_LABEL: Record<string, { label: string; color: string }> = {
  white_wins: { label: 'White wins', color: '#769656' },
  black_wins: { label: 'Black wins', color: '#e05252' },
  draw:       { label: 'Draw',       color: '#a0aec0' },
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy', medium: 'Medium', hard: 'Hard',
}

const PIECE_UNICODE: Record<string, Record<string, string>> = {
  white: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
}

// ─── Replay engine ───────────────────────────────────────────────────────────

/**
 * Walk through every algebraic-notation token in the stored PGN and replay
 * each move by brute-forcing all legal (piece, destination) pairs until the
 * resulting move.notation matches the token.
 *
 * Returns an array where index 0 = initial position, index k = after k moves.
 */
function buildPositions(pgn: string): GameState[] {
  const tokens = pgn.trim().split(/\s+/).filter(Boolean)
  const positions: GameState[] = []
  let state = createInitialGameState()
  positions.push(state)

  outer: for (const token of tokens) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = state.board[r][c]
        if (!piece || piece.color !== state.currentTurn) continue
        const from = { row: r, col: c }
        const dests = getLegalMoves(state.board, from, state)
        for (const to of dests) {
          const result = movePiece(state.board, from, to, state)
          if (result.move.notation === token) {
            state = result.gameState
            positions.push(state)
            continue outer
          }
        }
      }
    }
    console.warn('[ReplayModal] could not match notation token:', token)
    break
  }

  return positions
}

/** Group flat tokens into White/Black pairs for the move list. */
function buildPairs(tokens: string[]) {
  const pairs: Array<{ n: number; white: string; black: string | null }> = []
  for (let i = 0; i < tokens.length; i += 2) {
    pairs.push({ n: Math.floor(i / 2) + 1, white: tokens[i], black: tokens[i + 1] ?? null })
  }
  return pairs
}

// ─── Eval bar ────────────────────────────────────────────────────────────────

function EvalBar({ score, mate }: { score: number | null; mate: number | null }) {
  let whitePercent = 50
  let label = score === null && mate === null ? '…' : '0.0'

  if (mate !== null) {
    whitePercent = mate > 0 ? 95 : 5
    label = `M${Math.abs(mate)}`
  } else if (score !== null) {
    const clamped = Math.max(-1000, Math.min(1000, score))
    whitePercent = Math.max(5, Math.min(95, 50 + clamped / 20))
    const pawns = score / 100
    label = (pawns >= 0 ? '+' : '') + pawns.toFixed(1)
  }

  const blackPct = 100 - whitePercent

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
      <div
        style={{
          width: '14px',
          height: '400px',
          borderRadius: '3px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ height: `${blackPct}%`, background: '#1a1a1a', transition: 'height 0.35s ease' }} />
        <div style={{ height: `${whitePercent}%`, background: '#f0d9b5', transition: 'height 0.35s ease' }} />
      </div>
      <span
        style={{
          fontSize: '9px',
          fontWeight: 700,
          color: '#a0aec0',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Mini board ──────────────────────────────────────────────────────────────

function MiniBoard({ board }: { board: Board }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
        width: '400px',
        height: '400px',
        borderRadius: '4px',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {board.flatMap((row, r) =>
        row.map((piece, c) => {
          const isLight = (r + c) % 2 === 0
          return (
            <div
              key={`${r}-${c}`}
              style={{
                background: isLight ? '#f0d9b5' : '#b58863',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.8rem',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              {piece && (
                <span
                  style={{
                    color: piece.color === 'white' ? '#ffffff' : '#1a1a1a',
                    textShadow:
                      piece.color === 'white'
                        ? '0 1px 3px #000, 0 0 1px #000'
                        : 'none',
                  }}
                >
                  {PIECE_UNICODE[piece.color][piece.type]}
                </span>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

interface Props {
  game: GameRow
  onClose: () => void
}

export default function ReplayModal({ game, onClose }: Props) {
  const { isPro } = useIsPro()
  // Precompute all positions once
  const positions = useMemo(() => buildPositions(game.pgn ?? ''), [game.pgn])
  const tokens    = useMemo(() => (game.pgn ?? '').trim().split(/\s+/).filter(Boolean), [game.pgn])
  const pairs     = useMemo(() => buildPairs(tokens), [tokens])

  // positions.length - 1 = how many moves were successfully parsed
  const maxIdx = positions.length - 1

  const [idx, setIdx] = useState(0)

  // ─ Stockfish eval bar state
  const [evalScore, setEvalScore] = useState<number | null>(null)
  const [evalMate,  setEvalMate]  = useState<number | null>(null)
  // ─ AI Coach state
  const [coachText,    setCoachText]    = useState('')
  const [coachLoading, setCoachLoading] = useState(false)

  const engineRef     = useRef<Worker | null>(null)
  const searchIdxRef  = useRef(-1)
  const coachCacheRef = useRef(new Map<number, string>())

  const board = positions[Math.min(idx, maxIdx)].board
  const res   = RESULT_LABEL[game.result] ?? { label: game.result, color: '#a0aec0' }

  const moveListRef = useRef<HTMLDivElement>(null)

  // Scroll active move into view
  useEffect(() => {
    if (!moveListRef.current) return
    const el = moveListRef.current.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [idx])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(maxIdx, i + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, maxIdx])

  // ── Stockfish worker: one instance per modal open ────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const worker = new Worker('/stockfish.js')
    worker.postMessage('uci')
    worker.postMessage('isready')
    engineRef.current = worker
    return () => {
      worker.postMessage('stop')
      worker.terminate()
      engineRef.current = null
    }
  }, [])

  // ── Eval bar: analyse the current position every time idx changes ────────────
  useEffect(() => {
    const worker = engineRef.current
    if (!worker) return
    const pos = positions[Math.min(idx, maxIdx)]
    const fen = boardToFEN(pos.board, pos)
    const thisIdx = idx
    searchIdxRef.current = thisIdx
    let tempScore = 0
    let tempMate: number | null = null
    worker.onmessage = (e: MessageEvent) => {
      if (searchIdxRef.current !== thisIdx) return
      const line = String(e.data)
      const cpM = line.match(/score cp (-?\d+)/)
      if (cpM) { tempScore = parseInt(cpM[1], 10); tempMate = null }
      const mateM = line.match(/score mate (-?\d+)/)
      if (mateM) { tempMate = parseInt(mateM[1], 10) }
      if (line.startsWith('bestmove')) {
        setEvalScore(tempScore)
        setEvalMate(tempMate)
      }
    }
    worker.postMessage('stop')
    worker.postMessage(`position fen ${fen}`)
    worker.postMessage('go depth 12')
  }, [idx, positions, maxIdx])

  // ── AI Coach: fetch Claude explanation for the current move ─────────────────
  useEffect(() => {
    if (idx === 0) {
      setCoachText('')
      setCoachLoading(false)
      return
    }
    if (coachCacheRef.current.has(idx)) {
      setCoachText(coachCacheRef.current.get(idx)!)
      setCoachLoading(false)
      return
    }
    const controller = new AbortController()
    setCoachLoading(true)
    setCoachText('')
    const notation  = tokens[idx - 1] ?? '?'
    const before    = positions[idx - 1]
    const after     = positions[idx]
    const fenBefore = boardToFEN(before.board, before)
    const fenAfter  = boardToFEN(after.board, after)
    const color     = before.currentTurn
    const prompt =
      `You are a chess coach. ${color.charAt(0).toUpperCase() + color.slice(1)} just played ${notation}.\n` +
      `Position before the move (FEN): ${fenBefore}\n` +
      `Position after the move (FEN):  ${fenAfter}\n\n` +
      `In 2-3 sentences explain: what this move accomplishes, whether it was a good move, ` +
      `and if there was a better alternative. Be concise and instructive.`
    fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        const text = data.error
          ? `(API error: ${data.error})`
          : (data.text ?? 'No response.')
        coachCacheRef.current.set(idx, text)
        setCoachText(text)
      })
      .catch(err => { if (err.name !== 'AbortError') setCoachText('Could not load analysis.') })
      .finally(() => setCoachLoading(false))
    return () => controller.abort()
  }, [idx, positions, tokens])

  const counterText =
    idx === 0      ? 'Starting position'
    : idx === maxIdx ? `Final position (move ${maxIdx})`
    : `Move ${idx} of ${maxIdx}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full rounded-2xl border-2 flex flex-col shadow-2xl"
        style={{
          background: '#16213e',
          borderColor: '#0f3460',
          maxHeight: '92vh',
          maxWidth: '860px',
        }}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: '#0f3460' }}
        >
          <div>
            <p className="text-white font-semibold text-sm">
              {new Date(game.played_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
              &nbsp;·&nbsp;
              <span className="capitalize">{game.opponent}</span>
              {game.ai_difficulty && (
                <span style={{ color: '#a0aec0' }}>
                  &nbsp;({DIFFICULTY_LABEL[game.ai_difficulty] ?? game.ai_difficulty})
                </span>
              )}
            </p>
            <p className="text-xs mt-0.5 font-semibold" style={{ color: res.color }}>
              {res.label}&nbsp;·&nbsp;{game.moves_count} moves
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 rounded-lg w-8 h-8 flex items-center justify-center text-lg font-bold hover:bg-white/10 transition-colors"
            style={{ color: '#a0aec0' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* Board + move list row */}
          <div className="flex flex-row gap-4 px-5 pt-4 pb-3 flex-1 min-h-0 overflow-hidden">

          {/* Left column: board + controls */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            {/* Eval bar alongside the board */}
            <div className="flex gap-1.5">
              <EvalBar score={evalScore} mate={evalMate} />
              <MiniBoard board={board} />
            </div>

            {/* Move counter */}
            <p className="text-xs text-center" style={{ color: '#a0aec0' }}>
              {counterText}
            </p>

            {/* Navigation buttons */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setIdx(0)}
                disabled={idx === 0}
                className="px-2.5 py-1.5 rounded-lg text-sm font-bold text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
                style={{ background: '#0f3460' }}
                title="Start"
              >
                ⏮
              </button>
              <button
                onClick={() => setIdx(i => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
                style={{ background: '#0f3460' }}
                title="Previous (←)"
              >
                ‹ Prev
              </button>
              <button
                onClick={() => setIdx(i => Math.min(maxIdx, i + 1))}
                disabled={idx >= maxIdx}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
                style={{ background: '#769656' }}
                title="Next (→)"
              >
                Next ›
              </button>
              <button
                onClick={() => setIdx(maxIdx)}
                disabled={idx >= maxIdx}
                className="px-2.5 py-1.5 rounded-lg text-sm font-bold text-white disabled:opacity-30 hover:opacity-80 transition-opacity"
                style={{ background: '#769656' }}
                title="End"
              >
                ⏭
              </button>
            </div>
          </div>

          {/* Right column: scrollable move list */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1" ref={moveListRef}>
            {pairs.length === 0 ? (
              <p className="text-sm text-center mt-6" style={{ color: '#a0aec0' }}>
                No moves recorded.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.75rem 1fr 1fr',
                  columnGap: '2px',
                  rowGap: '0px',
                }}
              >
                {/* Column headers */}
                <div style={{ color: '#a0aec0' }} className="text-xs font-semibold pb-2" />
                <div style={{ color: '#a0aec0' }} className="text-xs font-semibold pb-2 uppercase tracking-wide">White</div>
                <div style={{ color: '#a0aec0' }} className="text-xs font-semibold pb-2 uppercase tracking-wide">Black</div>

                {pairs.flatMap(({ n, white, black }) => {
                  const wIdx = (n - 1) * 2 + 1
                  const bIdx = (n - 1) * 2 + 2
                  const wActive = idx === wIdx
                  const bActive = idx === bIdx

                  return [
                    // Move number
                    <div
                      key={`n-${n}`}
                      className="py-1 pr-1 text-xs tabular-nums select-none"
                      style={{ color: '#718096' }}
                    >
                      {n}.
                    </div>,

                    // White move
                    <div
                      key={`w-${n}`}
                      data-active={String(wActive)}
                      onClick={() => setIdx(wIdx)}
                      className="py-1 px-1.5 text-sm font-medium rounded cursor-pointer transition-colors"
                      style={{
                        color:      wActive ? '#fff' : '#e2e8f0',
                        background: wActive ? '#0f3460' : 'transparent',
                      }}
                    >
                      {white}
                    </div>,

                    // Black move
                    <div
                      key={`b-${n}`}
                      data-active={String(bActive)}
                      onClick={() => black !== null ? setIdx(bIdx) : undefined}
                      className={`py-1 px-1.5 text-sm font-medium rounded transition-colors ${black ? 'cursor-pointer' : 'cursor-default'}`}
                      style={{
                        color:      bActive ? '#fff' : (black ? '#cbd5e0' : '#4a5568'),
                        background: bActive ? '#0f3460' : 'transparent',
                      }}
                    >
                      {black ?? ''}
                    </div>,
                  ]
                })}
              </div>
            )}
          </div> {/* end right column */}

          </div> {/* end board row */}

          {/* ── AI Coach panel ───────────────────────────────────── */}
          <div
            className="px-5 pt-3 pb-4 flex-shrink-0"
            style={{ borderTop: '1px solid #1a2d5a' }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: '#718096' }}
            >
              🤖 AI Coach
            </p>

            {!isPro ? (
              /* ── Locked state ── */
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(118,150,86,0.07)',
                  border: '1px solid rgba(118,150,86,0.2)',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>🔒</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#e8eaf0' }}>
                    AI Coach is a Pro feature
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#718096' }}>
                    Get move-by-move Gemini analysis with a Pro subscription.
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #769656, #22c55e)',
                    color: '#fff',
                    textDecoration: 'none',
                  }}
                >
                  Upgrade ✨
                </Link>
              </div>
            ) : idx === 0 ? (
              <p className="text-xs italic" style={{ color: '#4a5568' }}>
                Navigate to any move to get AI coaching.
              </p>
            ) : coachLoading ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full border-2 animate-spin flex-shrink-0"
                  style={{ borderColor: '#0f3460', borderTopColor: '#769656' }}
                />
                <span className="text-xs" style={{ color: '#718096' }}>Analysing…</span>
              </div>
            ) : coachText ? (
              <p className="text-xs leading-relaxed" style={{ color: '#cbd5e0' }}>
                <strong className="text-white">{tokens[idx - 1]}&nbsp;</strong>
                {coachText}
              </p>
            ) : null}
          </div>

        </div> {/* end body */}

        {/* ── Footer ───────────────────────────────────────── */}
        <div
          className="px-5 py-3 border-t flex-shrink-0"
          style={{ borderColor: '#0f3460' }}
        >
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: '#0f3460' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

