'use client'

export type GameModeChoice = 'normal' | 'royale'

interface Props {
  onSelect: (mode: GameModeChoice) => void
  onClose:  () => void
  loading?:  boolean
}

export function ModePickerModal({ onSelect, onClose, loading }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm flex flex-col gap-5 p-6"
        style={{
          background:   'rgba(9,14,22,0.98)',
          border:       '1px solid rgba(16,185,129,0.18)',
          borderRadius: '20px',
          boxShadow:    '0 32px 64px rgba(0,0,0,0.7)',
          animation:    'modal-slide-up 0.25s cubic-bezier(0.34,1.4,0.64,1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-bold"
            style={{ color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}
          >
            Choose Game Mode
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Normal Chess */}
        <button
          disabled={loading}
          onClick={() => onSelect('normal')}
          className="flex items-center gap-4 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background:   'rgba(255,255,255,0.03)',
            border:       '1px solid var(--border)',
            borderRadius: '14px',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,185,129,0.35)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
        >
          <div
            className="w-12 h-12 flex items-center justify-center rounded-xl text-2xl flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            ♟
          </div>
          <div>
            <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>Normal Chess</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Classic rules — no surprises.
            </p>
          </div>
        </button>

        {/* Chess Royale */}
        <button
          disabled={loading}
          onClick={() => onSelect('royale')}
          className="flex items-center gap-4 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
          style={{
            background:   'linear-gradient(135deg, rgba(240,165,0,0.08), rgba(240,165,0,0.03))',
            border:       '1px solid rgba(240,165,0,0.3)',
            borderRadius: '14px',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(240,165,0,0.55)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(240,165,0,0.3)' }}
        >
          {/* shimmer strip */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(240,165,0,0.5), transparent)' }}
          />
          <div
            className="w-12 h-12 flex items-center justify-center rounded-xl text-2xl flex-shrink-0"
            style={{ background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.3)' }}
          >
            🃏
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-sm" style={{ color: '#f0a500' }}>Chess Royale</p>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(240,165,0,0.15)', color: '#f0a500', border: '1px solid rgba(240,165,0,0.3)' }}
              >
                NEW
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Every 8 moves a random rule changes. Pure chaos.
            </p>
          </div>
        </button>

        {loading && (
          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>Creating game…</p>
        )}
      </div>
    </div>
  )
}
