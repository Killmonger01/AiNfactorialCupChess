import { getLegalMoves } from './chess'
import type { Board, Color, GameState } from './types'

/**
 * Returns the set of squares visible to `color` under Fog of War rules.
 * A square is visible if:
 *  - one of your pieces stands on it, OR
 *  - one of your pieces can legally move to it (line-of-sight).
 */
export function getVisibleSquares(
  board: Board,
  color: Color,
  gameState: GameState,
): Set<string> {
  const visible = new Set<string>()

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece?.color !== color) continue

      visible.add(`${r},${c}`)
      for (const m of getLegalMoves(board, { row: r, col: c }, gameState)) {
        visible.add(`${m.row},${m.col}`)
      }
    }
  }

  return visible
}
