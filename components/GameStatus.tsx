import type { GameState } from '@/lib/types'

interface GameStatusProps {
  gameState: GameState
  onNewGame: () => void
}

export default function GameStatus({ gameState, onNewGame }: GameStatusProps) {
  const { currentTurn, isCheck, isCheckmate, isStalemate, winner, isResigned, resignedBy } = gameState

  return (
    <div className="flex flex-col gap-3">
      {/* Turn indicator */}
      {!isCheckmate && !isStalemate && !isResigned && (
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor: currentTurn === 'white' ? '#f0d9b5' : '#1a1a1a',
              border: currentTurn === 'white' ? '2px solid rgba(240,217,181,0.4)' : '2px solid #333',
              boxShadow: currentTurn === 'white'
                ? '0 0 12px rgba(16,185,129,0.5), 0 0 4px rgba(16,185,129,0.3)'
                : '0 0 6px rgba(0,0,0,0.8), 0 0 0 1px #444',
            }}
          />
          <span className="font-semibold capitalize" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
            {currentTurn}&apos;s turn
          </span>
          {isCheck && (
            <span
              className="ml-1 px-2 py-0.5 rounded text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', letterSpacing: '0.05em', animation: 'jade-pulse 1.2s ease-in-out infinite', boxShadow: '0 0 10px rgba(220,38,38,0.5)' }}
            >
              CHECK!
            </span>
          )}
        </div>
      )}

      {/* End-game modal overlay */}
      {(isCheckmate || isStalemate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" style={{ backdropFilter: 'blur(6px)' }}>
          <div
            className="shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4"
            style={{ background: 'rgba(9,14,22,0.95)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px', backdropFilter: 'blur(24px)', boxShadow: '0 0 60px rgba(0,0,0,0.9), 0 0 30px rgba(16,185,129,0.08)' }}
          >
            <div className="text-6xl">{isResigned ? '🏳️' : isCheckmate ? '♛' : '🤝'}</div>
            <h2 className="text-2xl font-bold text-white text-center">
              {isResigned
                ? `${resignedBy === 'white' ? 'White' : 'Black'} resigned — ${winner === 'white' ? 'White' : 'Black'} wins!`
                : isCheckmate
                ? `Checkmate — ${winner === 'white' ? 'White' : 'Black'} wins!`
                : 'Stalemate — Draw!'}
            </h2>
            <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              {isResigned
                ? `${resignedBy === 'white' ? 'White' : 'Black'} chose to resign the game.`
                : isCheckmate
                ? `${winner === 'white' ? 'Black' : 'White'} has no legal moves and is in check.`
                : 'No legal moves available. The game is a draw.'}
            </p>
            <button
              onClick={onNewGame}
              className="mt-2 px-6 py-2.5 rounded-xl text-white font-bold transition-all duration-200 hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
            >
              Rematch
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
