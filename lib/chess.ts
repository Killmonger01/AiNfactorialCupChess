import type { Board, Color, GameState, Move, Piece, PieceType, Square } from './types'

// ─────────────────────────────────────────────
// Board initialisation
// ─────────────────────────────────────────────

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null))

  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRank[col], color: 'black', hasMoved: false }
    board[1][col] = { type: 'pawn', color: 'black', hasMoved: false }
    board[6][col] = { type: 'pawn', color: 'white', hasMoved: false }
    board[7][col] = { type: backRank[col], color: 'white', hasMoved: false }
  }

  return board
}

export function createInitialGameState(): GameState {
  return {
    board: createInitialBoard(),
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
  }
}

// ─────────────────────────────────────────────
// Board utilities
// ─────────────────────────────────────────────

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

function opponent(color: Color): Color {
  return color === 'white' ? 'black' : 'white'
}

// ─────────────────────────────────────────────
// Raw move generation (ignores check)
// ─────────────────────────────────────────────

function getPawnMoves(board: Board, sq: Square, gameState: GameState): Square[] {
  const { row, col } = sq
  const piece = board[row][col]!
  const dir = piece.color === 'white' ? -1 : 1
  const startRow = piece.color === 'white' ? 6 : 1
  const moves: Square[] = []

  // Forward one
  if (inBounds(row + dir, col) && !board[row + dir][col]) {
    moves.push({ row: row + dir, col })
    // Forward two from starting position
    if (row === startRow && !board[row + 2 * dir][col]) {
      moves.push({ row: row + 2 * dir, col })
    }
  }

  // Diagonal captures
  for (const dc of [-1, 1]) {
    const nr = row + dir
    const nc = col + dc
    if (inBounds(nr, nc)) {
      const target = board[nr][nc]
      if (target && target.color !== piece.color) {
        moves.push({ row: nr, col: nc })
      }
      // En passant
      const ep = gameState.enPassantTarget
      if (ep && ep.row === nr && ep.col === nc) {
        moves.push({ row: nr, col: nc })
      }
    }
  }

  return moves
}

function getKnightMoves(board: Board, sq: Square): Square[] {
  const { row, col } = sq
  const piece = board[row][col]!
  const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
  const moves: Square[] = []

  for (const [dr, dc] of deltas) {
    const nr = row + dr
    const nc = col + dc
    if (inBounds(nr, nc)) {
      const target = board[nr][nc]
      if (!target || target.color !== piece.color) {
        moves.push({ row: nr, col: nc })
      }
    }
  }
  return moves
}

function getSlidingMoves(board: Board, sq: Square, directions: [number, number][]): Square[] {
  const { row, col } = sq
  const piece = board[row][col]!
  const moves: Square[] = []

  for (const [dr, dc] of directions) {
    let nr = row + dr
    let nc = col + dc
    while (inBounds(nr, nc)) {
      const target = board[nr][nc]
      if (!target) {
        moves.push({ row: nr, col: nc })
      } else {
        if (target.color !== piece.color) moves.push({ row: nr, col: nc })
        break
      }
      nr += dr
      nc += dc
    }
  }
  return moves
}

function getBishopMoves(board: Board, sq: Square): Square[] {
  return getSlidingMoves(board, sq, [[-1,-1],[-1,1],[1,-1],[1,1]])
}

function getRookMoves(board: Board, sq: Square): Square[] {
  return getSlidingMoves(board, sq, [[-1,0],[1,0],[0,-1],[0,1]])
}

function getQueenMoves(board: Board, sq: Square): Square[] {
  return getSlidingMoves(board, sq, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]])
}

function getKingMoves(board: Board, sq: Square): Square[] {
  const { row, col } = sq
  const piece = board[row][col]!
  const moves: Square[] = []
  const deltas = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]

  for (const [dr, dc] of deltas) {
    const nr = row + dr
    const nc = col + dc
    if (inBounds(nr, nc)) {
      const target = board[nr][nc]
      if (!target || target.color !== piece.color) {
        moves.push({ row: nr, col: nc })
      }
    }
  }
  return moves
}

function getRawMoves(board: Board, sq: Square, gameState: GameState): Square[] {
  const piece = board[sq.row][sq.col]
  if (!piece) return []
  switch (piece.type) {
    case 'pawn':   return getPawnMoves(board, sq, gameState)
    case 'knight': return getKnightMoves(board, sq)
    case 'bishop': return getBishopMoves(board, sq)
    case 'rook':   return getRookMoves(board, sq)
    case 'queen':  return getQueenMoves(board, sq)
    case 'king':   return getKingMoves(board, sq)
  }
}

// ─────────────────────────────────────────────
// Check detection
// ─────────────────────────────────────────────

export function findKing(board: Board, color: Color): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'king' && p.color === color) return { row: r, col: c }
    }
  }
  return null
}

export function isInCheck(board: Board, color: Color): boolean {
  const kingPos = findKing(board, color)
  if (!kingPos) return false

  const opp = opponent(color)
  const dummyState: GameState = createInitialGameState()
  // Use a dummy state without en passant for attack detection to avoid recursion
  dummyState.enPassantTarget = null

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === opp) {
        const attacks = getRawMoves(board, { row: r, col: c }, dummyState)
        if (attacks.some(a => a.row === kingPos.row && a.col === kingPos.col)) {
          return true
        }
      }
    }
  }
  return false
}

// ─────────────────────────────────────────────
// Castling moves
// ─────────────────────────────────────────────

function getCastlingMoves(board: Board, sq: Square, gameState: GameState): Square[] {
  const piece = board[sq.row][sq.col]
  if (!piece || piece.type !== 'king') return []

  const moves: Square[] = []
  const color = piece.color
  const row = color === 'white' ? 7 : 0

  if (sq.row !== row || sq.col !== 4) return []
  if (isInCheck(board, color)) return []

  const kingMoved = color === 'white' ? gameState.whiteKingMoved : gameState.blackKingMoved

  if (!kingMoved) {
    // Kingside
    const ksRookMoved = color === 'white' ? gameState.whiteKingsideRookMoved : gameState.blackKingsideRookMoved
    if (!ksRookMoved && board[row][7]?.type === 'rook' && board[row][7]?.color === color) {
      if (!board[row][5] && !board[row][6]) {
        // Check that king doesn't pass through or land in check
        const pass5 = cloneBoard(board)
        pass5[row][5] = piece
        pass5[row][4] = null
        const pass6 = cloneBoard(board)
        pass6[row][6] = piece
        pass6[row][4] = null
        if (!isInCheck(pass5, color) && !isInCheck(pass6, color)) {
          moves.push({ row, col: 6 })
        }
      }
    }

    // Queenside
    const qsRookMoved = color === 'white' ? gameState.whiteQueensideRookMoved : gameState.blackQueensideRookMoved
    if (!qsRookMoved && board[row][0]?.type === 'rook' && board[row][0]?.color === color) {
      if (!board[row][1] && !board[row][2] && !board[row][3]) {
        const pass3 = cloneBoard(board)
        pass3[row][3] = piece
        pass3[row][4] = null
        const pass2 = cloneBoard(board)
        pass2[row][2] = piece
        pass2[row][4] = null
        if (!isInCheck(pass3, color) && !isInCheck(pass2, color)) {
          moves.push({ row, col: 2 })
        }
      }
    }
  }

  return moves
}

// ─────────────────────────────────────────────
// Legal moves (raw moves filtered for own-check)
// ─────────────────────────────────────────────

export function getLegalMoves(board: Board, sq: Square, gameState: GameState): Square[] {
  const piece = board[sq.row][sq.col]
  if (!piece) return []

  let candidates = getRawMoves(board, sq, gameState)

  // Add castling
  if (piece.type === 'king') {
    candidates = candidates.concat(getCastlingMoves(board, sq, gameState))
  }

  // Filter moves that leave own king in check
  return candidates.filter(to => {
    const next = applyMoveToBoard(board, sq, to, gameState)
    return !isInCheck(next, piece.color)
  })
}

// ─────────────────────────────────────────────
// Apply move to board (internal, no state update)
// ─────────────────────────────────────────────

function applyMoveToBoard(board: Board, from: Square, to: Square, gameState: GameState): Board {
  const next = cloneBoard(board)
  const piece = next[from.row][from.col]!

  // En passant capture
  if (piece.type === 'pawn' && gameState.enPassantTarget &&
      to.row === gameState.enPassantTarget.row && to.col === gameState.enPassantTarget.col) {
    const capturedPawnRow = from.row
    next[capturedPawnRow][to.col] = null
  }

  // Castling rook move
  if (piece.type === 'king') {
    const row = piece.color === 'white' ? 7 : 0
    if (to.col === 6 && from.col === 4) {
      // Kingside
      next[row][5] = { ...next[row][7]!, hasMoved: true }
      next[row][7] = null
    } else if (to.col === 2 && from.col === 4) {
      // Queenside
      next[row][3] = { ...next[row][0]!, hasMoved: true }
      next[row][0] = null
    }
  }

  next[to.row][to.col] = { ...piece, hasMoved: true }
  next[from.row][from.col] = null

  // Pawn promotion (auto-queen for board simulation)
  if (piece.type === 'pawn' && (to.row === 0 || to.row === 7)) {
    next[to.row][to.col] = { type: 'queen', color: piece.color, hasMoved: true }
  }

  return next
}

// ─────────────────────────────────────────────
// Full move execution returning new GameState
// ─────────────────────────────────────────────

export function movePiece(
  board: Board,
  from: Square,
  to: Square,
  gameState: GameState,
  promotionPiece: PieceType = 'queen'
): { board: Board; gameState: GameState; move: Move } {
  const next = cloneBoard(board)
  const piece = next[from.row][from.col]!
  const captured = next[to.row][to.col] ?? undefined

  let isEnPassant = false
  let castle: 'kingside' | 'queenside' | undefined

  // En passant capture
  if (piece.type === 'pawn' && gameState.enPassantTarget &&
      to.row === gameState.enPassantTarget.row && to.col === gameState.enPassantTarget.col) {
    isEnPassant = true
    const capturedPawnRow = from.row
    next[capturedPawnRow][to.col] = null
  }

  // Castling
  if (piece.type === 'king' && from.col === 4) {
    const row = piece.color === 'white' ? 7 : 0
    if (to.col === 6) {
      castle = 'kingside'
      next[row][5] = { ...next[row][7]!, hasMoved: true }
      next[row][7] = null
    } else if (to.col === 2) {
      castle = 'queenside'
      next[row][3] = { ...next[row][0]!, hasMoved: true }
      next[row][0] = null
    }
  }

  // Move piece
  next[to.row][to.col] = { ...piece, hasMoved: true }
  next[from.row][from.col] = null

  // Promotion
  if (piece.type === 'pawn' && (to.row === 0 || to.row === 7)) {
    next[to.row][to.col] = { type: promotionPiece, color: piece.color, hasMoved: true }
  }

  // Compute new en passant target
  let enPassantTarget: { row: number; col: number } | null = null
  if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
    enPassantTarget = { row: (from.row + to.row) / 2, col: from.col }
  }

  // Update moved flags
  const newState: GameState = {
    ...gameState,
    board: next,
    currentTurn: opponent(gameState.currentTurn),
    enPassantTarget,
    whiteKingMoved: gameState.whiteKingMoved || (piece.color === 'white' && piece.type === 'king'),
    blackKingMoved: gameState.blackKingMoved || (piece.color === 'black' && piece.type === 'king'),
    whiteKingsideRookMoved: gameState.whiteKingsideRookMoved ||
      (piece.color === 'white' && piece.type === 'rook' && from.row === 7 && from.col === 7),
    whiteQueensideRookMoved: gameState.whiteQueensideRookMoved ||
      (piece.color === 'white' && piece.type === 'rook' && from.row === 7 && from.col === 0),
    blackKingsideRookMoved: gameState.blackKingsideRookMoved ||
      (piece.color === 'black' && piece.type === 'rook' && from.row === 0 && from.col === 7),
    blackQueensideRookMoved: gameState.blackQueensideRookMoved ||
      (piece.color === 'black' && piece.type === 'rook' && from.row === 0 && from.col === 0),
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    winner: null,
  }

  const nextColor = newState.currentTurn
  newState.isCheck = isInCheck(next, nextColor)
  newState.isCheckmate = isCheckmate(next, nextColor, newState)
  newState.isStalemate = !newState.isCheckmate && isStalemate(next, nextColor, newState)
  if (newState.isCheckmate) {
    newState.winner = gameState.currentTurn
  }

  const move: Move = {
    from,
    to,
    piece,
    captured,
    castle,
    enPassant: isEnPassant,
    notation: buildNotation(board, from, to, piece, captured, castle, isEnPassant, next, newState),
  }

  return { board: next, gameState: newState, move }
}

// ─────────────────────────────────────────────
// End-game detection
// ─────────────────────────────────────────────

function hasAnyLegalMove(board: Board, color: Color, gameState: GameState): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.color === color) {
        if (getLegalMoves(board, { row: r, col: c }, gameState).length > 0) return true
      }
    }
  }
  return false
}

export function isCheckmate(board: Board, color: Color, gameState: GameState): boolean {
  return isInCheck(board, color) && !hasAnyLegalMove(board, color, gameState)
}

export function isStalemate(board: Board, color: Color, gameState: GameState): boolean {
  return !isInCheck(board, color) && !hasAnyLegalMove(board, color, gameState)
}

// ─────────────────────────────────────────────
// Algebraic notation
// ─────────────────────────────────────────────

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

const PIECE_LETTER: Record<string, string> = {
  king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '',
}

function squareToAlgebraic(sq: Square): string {
  return FILES[sq.col] + RANKS[sq.row]
}

function buildNotation(
  board: Board,
  from: Square,
  to: Square,
  piece: Piece,
  captured: Piece | undefined,
  castle: 'kingside' | 'queenside' | undefined,
  enPassant: boolean,
  newBoard: Board,
  newState: GameState,
): string {
  if (castle === 'kingside') return newState.isCheck ? 'O-O+' : 'O-O'
  if (castle === 'queenside') return newState.isCheck ? 'O-O-O+' : 'O-O-O'

  const letter = PIECE_LETTER[piece.type]
  const dest = squareToAlgebraic(to)
  const isCapture = !!captured || enPassant

  // Disambiguation
  let disambiguation = ''
  if (piece.type !== 'pawn') {
    const ambiguous = []
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === from.row && c === from.col) continue
        const p = board[r][c]
        if (p && p.type === piece.type && p.color === piece.color) {
          const legal = getLegalMoves(board, { row: r, col: c }, newState)
          if (legal.some(m => m.row === to.row && m.col === to.col)) {
            ambiguous.push({ row: r, col: c })
          }
        }
      }
    }
    if (ambiguous.length > 0) {
      const sameFile = ambiguous.some(a => a.col === from.col)
      const sameRank = ambiguous.some(a => a.row === from.row)
      if (!sameFile) disambiguation = FILES[from.col]
      else if (!sameRank) disambiguation = RANKS[from.row]
      else disambiguation = FILES[from.col] + RANKS[from.row]
    }
  }

  const captureFile = piece.type === 'pawn' && isCapture ? FILES[from.col] : ''
  const captureSign = isCapture ? 'x' : ''
  const promotion = piece.type === 'pawn' && (to.row === 0 || to.row === 7) ? '=Q' : ''
  const check = newState.isCheckmate ? '#' : newState.isCheck ? '+' : ''

  return `${letter}${disambiguation}${captureFile}${captureSign}${dest}${promotion}${check}`
}

export function toAlgebraicNotation(move: Move): string {
  return move.notation ?? squareToAlgebraic(move.from) + squareToAlgebraic(move.to)
}

// ─────────────────────────────────────────────
// FEN serialisation
// ─────────────────────────────────────────────

const FEN_PIECE: Record<Color, Record<PieceType, string>> = {
  white: { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' },
  black: { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' },
}

const FEN_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const FEN_RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

export function boardToFEN(
  board: Board,
  gameState: GameState,
  halfmoveClock = 0,
  fullmoveNumber = 1,
): string {
  // Piece placement
  const rows: string[] = []
  for (let row = 0; row < 8; row++) {
    let empty = 0
    let rowStr = ''
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (!piece) {
        empty++
      } else {
        if (empty > 0) { rowStr += empty; empty = 0 }
        rowStr += FEN_PIECE[piece.color][piece.type]
      }
    }
    if (empty > 0) rowStr += empty
    rows.push(rowStr)
  }

  // Active color
  const active = gameState.currentTurn === 'white' ? 'w' : 'b'

  // Castling availability
  let castling = ''
  if (!gameState.whiteKingMoved) {
    if (!gameState.whiteKingsideRookMoved &&
        board[7][7]?.type === 'rook' && board[7][7]?.color === 'white') castling += 'K'
    if (!gameState.whiteQueensideRookMoved &&
        board[7][0]?.type === 'rook' && board[7][0]?.color === 'white') castling += 'Q'
  }
  if (!gameState.blackKingMoved) {
    if (!gameState.blackKingsideRookMoved &&
        board[0][7]?.type === 'rook' && board[0][7]?.color === 'black') castling += 'k'
    if (!gameState.blackQueensideRookMoved &&
        board[0][0]?.type === 'rook' && board[0][0]?.color === 'black') castling += 'q'
  }
  if (!castling) castling = '-'

  // En passant target
  let enPassant = '-'
  if (gameState.enPassantTarget) {
    const { row, col } = gameState.enPassantTarget
    enPassant = FEN_FILES[col] + FEN_RANKS[row]
  }

  return `${rows.join('/')} ${active} ${castling} ${enPassant} ${halfmoveClock} ${fullmoveNumber}`
}
