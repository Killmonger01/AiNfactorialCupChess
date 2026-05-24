import type { Piece as PieceType, Square } from '@/lib/types'
import PieceComponent from './Piece'

interface SquareProps {
  row: number
  col: number
  piece: PieceType | null
  isLight: boolean
  isSelected: boolean
  isLegalMove: boolean
  isLastMoveFrom: boolean
  isLastMoveTo: boolean
  flipped?: boolean
  isFogged?: boolean
  onClick: (sq: Square) => void
}

export default function SquareComponent({
  row,
  col,
  piece,
  isLight,
  isSelected,
  isLegalMove,
  isLastMoveFrom,
  isLastMoveTo,
  flipped = false,
  isFogged = false,
  onClick,
}: SquareProps) {
  const baseColor = isLight ? '#f0d9b5' : '#b07040'

  let bg = baseColor
  if (isFogged) {
    bg = isLight ? '#1a1f2e' : '#0f1318'
  } else if (isSelected) {
    bg = isLight ? '#a8f0cf' : '#2ea875'
  } else if (isLastMoveFrom || isLastMoveTo) {
    bg = isLight ? '#c8ecd8' : '#4a9e70'
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${String.fromCharCode(97 + col)}${8 - row}`}
      onClick={() => { if (!isFogged) onClick({ row, col }) }}
      onKeyDown={e => { if (!isFogged && (e.key === 'Enter' || e.key === ' ')) onClick({ row, col }) }}
      style={{ backgroundColor: bg, transition: 'background-color 0.2s ease' }}
      className={`relative flex items-center justify-center w-full h-full ${isFogged ? 'cursor-default' : 'cursor-pointer hover:brightness-110'}`}
    >
      {isFogged && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(15,20,30,0.1) 0%, rgba(5,8,14,0.6) 100%)',
          }}
        />
      )}

      {/* Legal move dot — jade */}
      {!isFogged && isLegalMove && !piece && (
        <div
          className="rounded-full pointer-events-none"
          style={{
            width: '30%',
            height: '30%',
            backgroundColor: 'rgba(16,185,129,0.45)',
            boxShadow: '0 0 6px rgba(16,185,129,0.3)',
          }}
        />
      )}
      {/* Legal move capture ring — jade */}
      {!isFogged && isLegalMove && piece && (
        <div
          className="absolute inset-0 rounded-none pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 0 4px rgba(16,185,129,0.55)',
          }}
        />
      )}
      {!isFogged && piece && <PieceComponent piece={piece} />}

      {/* Rank label */}
      {((!flipped && col === 0) || (flipped && col === 7)) && (
        <span
          className="absolute top-0.5 left-0.5 pointer-events-none"
          style={{ color: isLight ? '#b07040' : '#f0d9b5', fontSize: '0.58rem', fontWeight: 700, fontFamily: "'JetBrains Mono', 'DM Mono', monospace", opacity: 0.8 }}
        >
          {8 - row}
        </span>
      )}
      {/* File label */}
      {((!flipped && row === 7) || (flipped && row === 0)) && (
        <span
          className="absolute bottom-0.5 right-0.5 pointer-events-none"
          style={{ color: isLight ? '#b07040' : '#f0d9b5', fontSize: '0.58rem', fontWeight: 700, fontFamily: "'JetBrains Mono', 'DM Mono', monospace", opacity: 0.8 }}
        >
          {String.fromCharCode(97 + col)}
        </span>
      )}
    </div>
  )
}
