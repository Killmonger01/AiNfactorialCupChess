import type { Board, Color, GameState, Move, PieceType, Square } from './types'
import type { RoyaleRule, RoyaleState } from './types'
import { cloneBoard, getLegalMoves, isInCheck, isCheckmate, isStalemate, movePiece } from './chess'

// ─── Constants ────────────────────────────────────────────────────────────────

export const ROYALE_RULE_LABELS: Record<RoyaleRule, string> = {
  normal:                '♟ Normal Rules',
  pawns_backwards:       '⬇ Pawns Move Backwards',
  king_two_squares:      '👑 King Moves 2 Squares',
  no_capture:            '🚫 No Captures Allowed',
  double_move:           '⚡ Double Move',
  no_pawns:              '🚷 No Pawn Moves',
  swap_knights_bishops:  '🔄 Knights & Bishops Swapped',
}

const ALL_RULES: RoyaleRule[] = [
  'pawns_backwards',
  'king_two_squares',
  'no_capture',
  'double_move',
  'no_pawns',
  'swap_knights_bishops',
]

// Moves until rule change — double_move is shorter because it's chaotic
function movesForRule(rule: RoyaleRule): number {
  return rule === 'double_move' ? 4 : 8
}

// ─── State helpers ────────────────────────────────────────────────────────────

export function createRoyaleState(): RoyaleState {
  return { rule: 'normal', moveCount: 0, movesUntilChange: 8, doubleMoveDone: false }
}

export function createInitialGameStateRoyale(): import('./types').GameState {
  const { createInitialGameState } = require('./chess') as typeof import('./chess')
  const state = createInitialGameState()
  state.royale = createRoyaleState()
  return state
}

function pickNextRule(current: RoyaleRule): RoyaleRule {
  const pool = ALL_RULES.filter(r => r !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

// ─── Board transforms ─────────────────────────────────────────────────────────

function swapKnightsBishops(board: Board): Board {
  const next = cloneBoard(board)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = next[r][c]
      if (p?.type === 'knight') next[r][c] = { ...p, type: 'bishop' }
      else if (p?.type === 'bishop') next[r][c] = { ...p, type: 'knight' }
    }
  }
  return next
}

function applyBoardTransform(rule: RoyaleRule, board: Board): Board {
  if (rule === 'swap_knights_bishops') return swapKnightsBishops(board)
  return board
}

// Simple move application for check detection (no castling/en-passant side-effects)
function applySimpleMove(board: Board, from: Square, to: Square): Board {
  const next = cloneBoard(board)
  next[to.row][to.col] = next[from.row][from.col]
  next[from.row][from.col] = null
  return next
}

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8 }

// ─── Royale-aware legal moves ─────────────────────────────────────────────────

function getReversePawnMoves(board: Board, sq: Square, piece: { color: Color }): Square[] {
  const { row, col } = sq
  const dir   = piece.color === 'white' ? 1 : -1   // reversed
  const moves: Square[] = []

  if (inBounds(row + dir, col) && !board[row + dir][col]) {
    moves.push({ row: row + dir, col })
  }
  for (const dc of [-1, 1]) {
    const nr = row + dir, nc = col + dc
    if (inBounds(nr, nc)) {
      const target = board[nr][nc]
      if (target && target.color !== piece.color) moves.push({ row: nr, col: nc })
    }
  }
  return moves.filter(to => !isInCheck(applySimpleMove(board, sq, to), piece.color as Color))
}

function getTwoSquareKingMoves(board: Board, sq: Square, piece: { color: Color }): Square[] {
  const { row, col } = sq
  const moves: Square[] = []
  // Only the squares that are exactly 2 steps away (not reachable by normal 1-step king)
  const candidates: [number, number][] = [
    [-2,-2],[-2,-1],[-2,0],[-2,1],[-2,2],
    [-1,-2],[             -1,2],
    [ 0,-2],[             0, 2],
    [ 1,-2],[             1, 2],
    [ 2,-2],[ 2,-1],[ 2,0],[ 2,1],[ 2,2],
  ]
  for (const [dr, dc] of candidates) {
    const nr = row + dr, nc = col + dc
    if (!inBounds(nr, nc)) continue
    const target = board[nr][nc]
    if (target?.color === piece.color) continue
    if (!isInCheck(applySimpleMove(board, sq, { row: nr, col: nc }), piece.color as Color)) {
      moves.push({ row: nr, col: nc })
    }
  }
  return moves
}

export function getLegalMovesRoyale(board: Board, sq: Square, gameState: GameState): Square[] {
  const royale = gameState.royale
  if (!royale) return getLegalMoves(board, sq, gameState)

  const piece = board[sq.row][sq.col]
  if (!piece) return []

  const rule = royale.rule

  // No pawn moves
  if (rule === 'no_pawns' && piece.type === 'pawn') return []

  // Reversed pawn direction — skip standard getLegalMoves for pawns
  if (rule === 'pawns_backwards' && piece.type === 'pawn') {
    return getReversePawnMoves(board, sq, piece)
  }

  let moves = getLegalMoves(board, sq, gameState)

  // No captures: filter out moves to squares occupied by opponent (and en-passant)
  if (rule === 'no_capture') {
    moves = moves.filter(to => {
      if (board[to.row][to.col]) return false  // regular capture
      // en passant: pawn moves diagonally to empty square
      if (piece.type === 'pawn' && to.col !== sq.col) return false
      return true
    })
  }

  // King 2-square extension
  if (rule === 'king_two_squares' && piece.type === 'king') {
    const extras = getTwoSquareKingMoves(board, sq, piece)
    const seen   = new Set(moves.map(m => `${m.row},${m.col}`))
    for (const m of extras) if (!seen.has(`${m.row},${m.col}`)) moves.push(m)
  }

  return moves
}

// ─── Royale-aware movePiece ───────────────────────────────────────────────────

export function movePieceRoyale(
  board: Board,
  from: Square,
  to: Square,
  gameState: GameState,
  promotionPiece: PieceType = 'queen',
): { board: Board; gameState: GameState; move: Move } {
  if (!gameState.royale) return movePiece(board, from, to, gameState, promotionPiece)

  const royale   = gameState.royale
  const rule     = royale.rule
  const mover    = gameState.currentTurn

  // Run standard move execution
  const result   = movePiece(board, from, to, gameState, promotionPiece)
  let newBoard   = result.board
  let newState   = result.gameState

  // ── Double-move turn handling ────────────────────────────────────────────
  let doubleMoveDone = royale.doubleMoveDone
  if (rule === 'double_move') {
    if (!royale.doubleMoveDone) {
      // First move: keep the same player's turn
      doubleMoveDone = true
      newState = {
        ...newState,
        currentTurn:  mover,
        isCheck:      isInCheck(newBoard, mover),
        isCheckmate:  false,
        isStalemate:  false,
        winner:       null,
      }
    } else {
      // Second move: turn switches normally (already done by movePiece)
      doubleMoveDone = false
    }
  }

  // ── Move counter + rule rotation ─────────────────────────────────────────
  const newMoveCount      = royale.moveCount + 1
  const newMovesUntil     = royale.movesUntilChange - 1

  let nextRule            = rule
  let nextMovesUntil      = newMovesUntil
  let ruleChangedThisTurn = false

  if (newMovesUntil <= 0) {
    nextRule            = pickNextRule(rule)
    nextMovesUntil      = movesForRule(nextRule)
    ruleChangedThisTurn = true
    doubleMoveDone      = false   // reset on rule change

    // Apply board transform for the incoming rule
    newBoard            = applyBoardTransform(nextRule, newBoard)

    // Recompute game status with the transformed board
    const nextColor      = newState.currentTurn
    const check          = isInCheck(newBoard, nextColor)
    const mate           = check && isCheckmate(newBoard, nextColor, newState)
    const stale          = !check && isStalemate(newBoard, nextColor, newState)
    newState = {
      ...newState,
      board:       newBoard,
      isCheck:     check,
      isCheckmate: mate,
      isStalemate: stale,
      winner:      mate ? (nextColor === 'white' ? 'black' : 'white') : null,
    }
  }

  newState.royale = {
    rule:             nextRule,
    moveCount:        newMoveCount,
    movesUntilChange: nextMovesUntil,
    doubleMoveDone,
  }

  // Attach flag so the UI can animate the rule change
  if (ruleChangedThisTurn) {
    (newState as GameState & { _ruleChanged?: boolean })._ruleChanged = true
  }

  return { board: newBoard, gameState: newState, move: result.move }
}
