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
}

export interface HistoryEntry {
  move: Move
  stateBefore: GameState
}
