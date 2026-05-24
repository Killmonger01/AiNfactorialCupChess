import type { Piece } from '@/lib/types'

// \uFE0E = Variation Selector-15: forces TEXT rendering (not emoji)
// so CSS `color` is respected on iOS/Android browsers.
// White pieces use the outline/hollow glyphs; black use the filled glyphs.
const UNICODE: Record<string, Record<string, string>> = {
  white: {
    king:   '\u265A\uFE0E',  // ♚ filled — colored white via CSS
    queen:  '\u265B\uFE0E',  // ♛
    rook:   '\u265C\uFE0E',  // ♜
    bishop: '\u265D\uFE0E',  // ♝
    knight: '\u265E\uFE0E',  // ♞
    pawn:   '\u265F\uFE0E',  // ♟
  },
  black: {
    king:   '\u265A\uFE0E',  // ♚ black king
    queen:  '\u265B\uFE0E',  // ♛ black queen
    rook:   '\u265C\uFE0E',  // ♜ black rook
    bishop: '\u265D\uFE0E',  // ♝ black bishop
    knight: '\u265E\uFE0E',  // ♞ black knight
    pawn:   '\u265F\uFE0E',  // ♟ black pawn
  },
}

interface PieceProps {
  piece: Piece
}

export default function PieceComponent({ piece }: PieceProps) {
  const symbol = UNICODE[piece.color][piece.type]

  return (
    <span
      className="select-none leading-none"
      style={{
        display: 'block',
        fontSize: '2.6rem',
        lineHeight: 1,
        color:
          piece.color === 'white' ? '#ffffff' : '#1a1a1a',
        WebkitTextStroke:
          piece.color === 'white' ? '1px rgba(0,0,0,0.55)' : '0.5px rgba(255,255,255,0.08)',
        textShadow:
          piece.color === 'white'
            ? '0 2px 6px rgba(0,0,0,1), 0 1px 3px rgba(0,0,0,0.9)'
            : '0 1px 3px rgba(0,0,0,0.5)',
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))',
        transition: 'transform 0.15s ease',
        userSelect: 'none',
      }}
      aria-label={`${piece.color} ${piece.type}`}
    >
      {symbol}
    </span>
  )
}
