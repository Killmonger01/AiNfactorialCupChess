export type Color = 'white' | 'black'

export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'

export interface Piece {
  type: PieceType
  color: Color
  hasMoved?: boolean
}

export type Board = (Piece | null)[][]

export interface Square {
  row: number
  col: number
}

export interface Move {
  from: Square
  to: Square
  piece: Piece
  captured?: Piece
  promotion?: PieceType
  castle?: 'kingside' | 'queenside'
  enPassant?: boolean
  notation?: string
}

export type RoyaleRule =
  | 'normal'
  | 'pawns_backwards'
  | 'king_two_squares'
  | 'no_capture'
  | 'double_move'
  | 'no_pawns'
  | 'swap_knights_bishops'

export interface RoyaleState {
  rule: RoyaleRule
  moveCount: number         // total half-moves in the game
  movesUntilChange: number  // counts down; rule changes when it hits 0
  doubleMoveDone: boolean   // for double_move: has current player already moved once
}

export interface DiceState {
  drawnPieces: PieceType[]                       // 3 drawn piece types for current turn
  remaining: Partial<Record<PieceType, number>>  // remaining moves per type this turn
}

export interface GameState {
  board: Board
  currentTurn: Color
  enPassantTarget: Square | null  // square where en passant capture is possible
  whiteKingMoved: boolean
  blackKingMoved: boolean
  whiteKingsideRookMoved: boolean
  whiteQueensideRookMoved: boolean
  blackKingsideRookMoved: boolean
  blackQueensideRookMoved: boolean
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  winner: Color | null
  isResigned?: boolean
  resignedBy?: Color
  royale?: RoyaleState
  dice?: DiceState
}

export interface HistoryEntry {
  move: Move
  stateBefore: GameState
}
