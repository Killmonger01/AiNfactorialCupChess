import type { Board, Color, DiceState, GameState, Move, Piece, PieceType, Square } from './types'
import { cloneBoard, createInitialBoard } from './chess'

// ─── Pseudo-legal move generation (no check filtering, king can be captured) ──

function inB(r: number, c: number): boolean { return r >= 0 && r < 8 && c >= 0 && c < 8 }

function sliding(board: Board, piece: Piece, row: number, col: number, dirs: [number, number][]): Square[] {
  const moves: Square[] = []
  for (const [dr, dc] of dirs) {
    let nr = row + dr, nc = col + dc
    while (inB(nr, nc)) {
      const t = board[nr][nc]
      if (!t) { moves.push({ row: nr, col: nc }) }
      else { if (t.color !== piece.color) moves.push({ row: nr, col: nc }); break }
      nr += dr; nc += dc
    }
  }
  return moves
}

export function getDiceLegalMoves(board: Board, sq: Square, gameState: GameState): Square[] {
  const piece = board[sq.row][sq.col]
  if (!piece) return []
  const { row, col } = sq

  switch (piece.type) {
    case 'pawn': {
      const moves: Square[] = []
      const dir = piece.color === 'white' ? -1 : 1
      const startRow = piece.color === 'white' ? 6 : 1
      // EP capture is only valid from 5th rank (row 3 for white, row 4 for black)
      const epRank = piece.color === 'white' ? 3 : 4
      if (inB(row + dir, col) && !board[row + dir][col]) {
        moves.push({ row: row + dir, col })
        if (row === startRow && !board[row + 2 * dir][col])
          moves.push({ row: row + 2 * dir, col })
      }
      for (const dc of [-1, 1]) {
        if (inB(row + dir, col + dc)) {
          const t = board[row + dir][col + dc]
          const ep = gameState.enPassantTarget
          // Regular diagonal capture — only if enemy piece is actually there
          if (t && t.color !== piece.color) {
            moves.push({ row: row + dir, col: col + dc })
          } else if (
            !t && ep &&
            ep.row === row + dir && ep.col === col + dc &&
            row === epRank  // pawn must be on 5th rank to capture en passant
          ) {
            moves.push({ row: row + dir, col: col + dc })
          }
        }
      }
      return moves
    }
    case 'knight': {
      const moves: Square[] = []
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as [number,number][]) {
        const nr = row + dr, nc = col + dc
        if (inB(nr, nc)) {
          const t = board[nr][nc]
          if (!t || t.color !== piece.color) moves.push({ row: nr, col: nc })
        }
      }
      return moves
    }
    case 'bishop': return sliding(board, piece, row, col, [[-1,-1],[-1,1],[1,-1],[1,1]])
    case 'rook':   return sliding(board, piece, row, col, [[-1,0],[1,0],[0,-1],[0,1]])
    case 'queen':  return sliding(board, piece, row, col, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]])
    case 'king': {
      const moves: Square[] = []
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as [number,number][]) {
        const nr = row + dr, nc = col + dc
        if (inB(nr, nc)) {
          const t = board[nr][nc]
          if (!t || t.color !== piece.color) moves.push({ row: nr, col: nc })
        }
      }
      return moves
    }
    default: return []
  }
}

// ─── Dice drawing ─────────────────────────────────────────────────────────────

export function drawDicePieces(board: Board, color: Color): PieceType[] {
  const pool: PieceType[] = []
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === color) pool.push(p.type)
    }
  if (pool.length === 0) return []
  return Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)])
}

export function buildRemaining(drawn: PieceType[]): Partial<Record<PieceType, number>> {
  const rem: Partial<Record<PieceType, number>> = {}
  for (const t of drawn) rem[t] = (rem[t] ?? 0) + 1
  return rem
}

export function hasDiceMove(
  board: Board,
  color: Color,
  remaining: Partial<Record<PieceType, number>>,
  enPassantTarget: Square | null,
): boolean {
  const fakeGs = { enPassantTarget } as GameState
  for (const [type, count] of Object.entries(remaining) as [PieceType, number][]) {
    if (!count) continue
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c]
        if (p && p.color === color && p.type === type)
          if (getDiceLegalMoves(board, { row: r, col: c }, fakeGs).length > 0) return true
      }
  }
  return false
}

// ─── Dice slot display helper ─────────────────────────────────────────────────

export function getDiceSlots(
  drawn: PieceType[],
  remaining: Partial<Record<PieceType, number>>,
): { type: PieceType; active: boolean }[] {
  const rem = { ...remaining }
  return drawn.map(type => {
    if (rem[type] && rem[type]! > 0) { rem[type]!--; return { type, active: true } }
    return { type, active: false }
  })
}

// ─── Move execution ───────────────────────────────────────────────────────────

export function movePieceDice(
  board: Board,
  from: Square,
  to: Square,
  gameState: GameState,
): { gameState: GameState; move: Move } {
  const newBoard = cloneBoard(board)
  const piece = newBoard[from.row][from.col]!
  const captured = newBoard[to.row][to.col] ?? undefined

  newBoard[to.row][to.col] = { ...piece, hasMoved: true }
  newBoard[from.row][from.col] = null

  // En passant capture
  let epCaptured: Piece | undefined
  const ep = gameState.enPassantTarget
  if (piece.type === 'pawn' && ep && to.row === ep.row && to.col === ep.col && !captured) {
    const capRow = piece.color === 'white' ? to.row + 1 : to.row - 1
    epCaptured = newBoard[capRow][to.col] ?? undefined
    newBoard[capRow][to.col] = null
  }

  // Pawn promotion → auto queen
  if (piece.type === 'pawn' && (to.row === 0 || to.row === 7))
    newBoard[to.row][to.col] = { type: 'queen', color: piece.color, hasMoved: true }

  const newEP: Square | null = piece.type === 'pawn' && Math.abs(from.row - to.row) === 2
    ? { row: (from.row + to.row) / 2, col: from.col }
    : null

  const capturedPiece = captured ?? epCaptured
  const kingCaptured = capturedPiece?.type === 'king'
  const winner: Color | null = kingCaptured ? piece.color : null

  const move: Move = {
    from, to, piece,
    captured: capturedPiece,
    enPassant: !!(piece.type === 'pawn' && ep && to.row === ep.row && to.col === ep.col && !captured),
  }

  if (winner !== null) {
    return {
      gameState: {
        ...gameState,
        board: newBoard,
        currentTurn: piece.color,
        enPassantTarget: null,
        isCheckmate: true,
        isStalemate: false,
        isCheck: false,
        winner,
        dice: { drawnPieces: [], remaining: {} },
      },
      move,
    }
  }

  // Consume one slot for the moved piece type
  const dice = gameState.dice!
  const newRemaining = { ...dice.remaining }
  if ((newRemaining[piece.type] ?? 0) > 0) {
    newRemaining[piece.type] = newRemaining[piece.type]! - 1
    if (newRemaining[piece.type] === 0) delete newRemaining[piece.type]
  }

  // Turn is done when all slots used or no more valid moves
  const allUsed = Object.keys(newRemaining).length === 0
  const noMoves = !allUsed && !hasDiceMove(newBoard, piece.color, newRemaining, newEP)
  const turnDone = allUsed || noMoves

  if (!turnDone) {
    return {
      gameState: {
        ...gameState,
        board: newBoard,
        currentTurn: piece.color,
        enPassantTarget: newEP,
        isCheck: false,
        dice: { drawnPieces: dice.drawnPieces, remaining: newRemaining },
      },
      move,
    }
  }

  // Switch turn — draw new pieces for opponent
  const nextColor: Color = piece.color === 'white' ? 'black' : 'white'
  const nextDrawn = drawDicePieces(newBoard, nextColor)
  const nextRemaining = buildRemaining(nextDrawn)

  return {
    gameState: {
      ...gameState,
      board: newBoard,
      currentTurn: nextColor,
      enPassantTarget: newEP,
      isCheck: false,
      dice: { drawnPieces: nextDrawn, remaining: nextRemaining },
    },
    move,
  }
}

// ─── Pass turn (when no drawn pieces can move) ────────────────────────────────

export function passDiceTurn(gameState: GameState): { gameState: GameState; move: Move } {
  const nextColor: Color = gameState.currentTurn === 'white' ? 'black' : 'white'
  const nextDrawn = drawDicePieces(gameState.board, nextColor)
  const nextRemaining = buildRemaining(nextDrawn)

  const move: Move = {
    from: { row: -1, col: -1 },
    to:   { row: -1, col: -1 },
    piece: { type: 'king', color: gameState.currentTurn },
    notation: '(pass)',
  }

  return {
    gameState: {
      ...gameState,
      currentTurn: nextColor,
      dice: { drawnPieces: nextDrawn, remaining: nextRemaining },
    },
    move,
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialGameStateDice(): GameState {
  const board = createInitialBoard()
  const drawn = drawDicePieces(board, 'white')
  return {
    board,
    currentTurn: 'white',
    enPassantTarget: null,
    whiteKingMoved: false,
    blackKingMoved: false,
    whiteKingsideRookMoved: false,
    whiteQueensideRookMoved: false,
    blackKingsideRookMoved: false,
    blackQueensideRookMoved: false,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    winner: null,
    dice: { drawnPieces: drawn, remaining: buildRemaining(drawn) },
  }
}

// ─── Piece display symbols ────────────────────────────────────────────────────

export const DICE_PIECE_ICONS: Record<PieceType, { white: string; black: string }> = {
  king:   { white: '♔', black: '♚' },
  queen:  { white: '♕', black: '♛' },
  rook:   { white: '♖', black: '♜' },
  bishop: { white: '♗', black: '♝' },
  knight: { white: '♘', black: '♞' },
  pawn:   { white: '♙', black: '♟' },
}