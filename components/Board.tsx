import type { Board, Move, Square } from '@/lib/types'
import SquareComponent from './Square'

interface BoardProps {
  board: Board
  selectedSquare: Square | null
  legalMoves: Square[]
  lastMove: Move | null
  onSquareClick: (sq: Square) => void
  flipped?: boolean
}

export default function BoardComponent({
  board,
  selectedSquare,
  legalMoves,
  lastMove,
  onSquareClick,
  flipped = false,
}: BoardProps) {
  const legalSet = new Set(legalMoves.map(m => `${m.row},${m.col}`))

  return (
    <div
      style={{
        /* Rich walnut wood frame */
        background: 'linear-gradient(160deg, #2a1400 0%, #3d1e08 30%, #261200 60%, #3d1e08 80%, #2a1400 100%)',
        borderRadius: '14px',
        padding: '12px',
        boxShadow:
          '0 0 0 1px rgba(255,200,100,0.06),' +
          '0 4px 0 1px #1a0900,' +
          '0 40px 80px rgba(0,0,0,0.9),' +
          '0 16px 40px rgba(0,0,0,0.6),' +
          'inset 0 1px 0 rgba(255,200,100,0.12),' +
          'inset 0 -1px 0 rgba(0,0,0,0.5)',
      }}
    >
      {/* Subtle wood grain ring */}
      <div
        style={{
          borderRadius: '4px',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gridTemplateRows: 'repeat(8, 1fr)',
            width: 'min(90vw, 90vh, 560px)',
            height: 'min(90vw, 90vh, 560px)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
      {Array.from({ length: 8 }, (_, i) => flipped ? 7 - i : i).flatMap(row =>
        Array.from({ length: 8 }, (_, j) => flipped ? 7 - j : j).map(col => {
          const piece = board[row][col]
          const isLight = (row + col) % 2 === 0
          const isSelected = !!selectedSquare && selectedSquare.row === row && selectedSquare.col === col
          const isLegal = legalSet.has(`${row},${col}`)
          const isLastFrom = !!lastMove && lastMove.from.row === row && lastMove.from.col === col
          const isLastTo = !!lastMove && lastMove.to.row === row && lastMove.to.col === col

          return (
            <SquareComponent
              key={`${row}-${col}`}
              row={row}
              col={col}
              piece={piece}
              isLight={isLight}
              isSelected={isSelected}
              isLegalMove={isLegal}
              isLastMoveFrom={isLastFrom}
              isLastMoveTo={isLastTo}
              flipped={flipped}
              onClick={() => onSquareClick({ row, col })}
            />
          )
        })
      )}
        </div>
      </div>
    </div>
  )
}
