import type { HistoryEntry } from '@/lib/types'
import { toAlgebraicNotation } from '@/lib/chess'

interface MoveHistoryProps {
  history: HistoryEntry[]
}

export default function MoveHistory({ history }: MoveHistoryProps) {
  const pairs: string[][] = []
  for (let i = 0; i < history.length; i += 2) {
    const white = toAlgebraicNotation(history[i].move)
    const black = history[i + 1] ? toAlgebraicNotation(history[i + 1].move) : ''
    pairs.push([white, black])
  }

  return (
    <div className="flex flex-col h-full">
      <h2
        className="text-xs uppercase tracking-widest mb-2"
        style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.12em' }}
      >
        Move History
      </h2>
      <div className="flex-1 overflow-y-auto pr-1 space-y-0.5">
        {pairs.length === 0 && (
          <p className="text-gray-500 text-sm">No moves yet.</p>
        )}
        {pairs.map(([white, black], idx) => (
          <div
            key={idx}
            className="flex text-sm gap-2"
            style={{ background: idx % 2 === 0 ? 'rgba(16,185,129,0.04)' : 'transparent', padding: '2px 4px', borderRadius: '3px' }}
          >
            <span className="w-6 shrink-0" style={{ color: 'var(--gold)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', fontWeight: 700 }}>{idx + 1}.</span>
            <span className="w-16" style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem' }}>{white}</span>
            <span className="w-16" style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem' }}>{black}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
