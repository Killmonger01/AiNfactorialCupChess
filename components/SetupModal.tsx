'use client'

import { useState } from 'react'
import type { GameMode } from '@/hooks/useChess'

interface Props {
  onStart: (mode: GameMode, skillLevel: number, playerColor?: 'white' | 'black', royale?: boolean) => void
  onStartMultiplayer?: (royale: boolean, fogOfWar: boolean) => void
  multiplayerLoading?: boolean
  onClose?: () => void
}

const DIFFICULTIES = [
  { label: 'Easy',   skillLevel: 2,  description: 'Makes mistakes, good for beginners' },
  { label: 'Medium', skillLevel: 10, description: 'A fair challenge' },
  { label: 'Hard',   skillLevel: 20, description: 'Near-perfect play' },
] as const

type Panel = 'main' | 'ai' | 'pvp' | 'mp'

// ─── Shared mode-picker panel (Normal vs Chess Royale) ───────────────────────

function ModePicker({
  onNormal,
  onRoyale,
  onFog,
  onBack,
  loading,
}: {
  onNormal: () => void
  onRoyale: () => void
  onFog?: () => void
  onBack: () => void
  loading?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
        Choose game mode
      </p>

      {/* Normal Chess */}
      <button
        disabled={loading}
        onClick={onNormal}
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
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Classic rules — no surprises.</p>
        </div>
      </button>

      {/* Chess Royale */}
      <button
        disabled={loading}
        onClick={onRoyale}
        className="flex items-center gap-4 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
        style={{
          background:   'linear-gradient(135deg, rgba(240,165,0,0.08), rgba(240,165,0,0.03))',
          border:       '1px solid rgba(240,165,0,0.3)',
          borderRadius: '14px',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(240,165,0,0.55)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(240,165,0,0.3)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(240,165,0,0.5), transparent)' }} />
        <div
          className="w-12 h-12 flex items-center justify-center rounded-xl text-2xl flex-shrink-0"
          style={{ background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.3)' }}
        >
          🃏
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-sm" style={{ color: '#f0a500' }}>Chess Royale</p>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(240,165,0,0.15)', color: '#f0a500', border: '1px solid rgba(240,165,0,0.3)' }}>
              NEW
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Every 8 moves a random rule changes.</p>
        </div>
      </button>

      {/* Fog of War — only shown when handler provided (multiplayer only) */}
      {onFog && (
        <button
          disabled={loading}
          onClick={onFog}
          className="flex items-center gap-4 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
          style={{
            background:   'linear-gradient(135deg, rgba(100,149,237,0.08), rgba(100,149,237,0.03))',
            border:       '1px solid rgba(100,149,237,0.3)',
            borderRadius: '14px',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(100,149,237,0.55)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(100,149,237,0.3)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(100,149,237,0.4), transparent)' }} />
          <div
            className="w-12 h-12 flex items-center justify-center rounded-xl text-2xl flex-shrink-0"
            style={{ background: 'rgba(100,149,237,0.12)', border: '1px solid rgba(100,149,237,0.3)' }}
          >
            🌫️
          </div>
          <div>
            <p className="font-bold text-sm mb-0.5" style={{ color: '#6495ed' }}>Fog of War</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Only see squares your pieces can reach. Enemy hidden in the fog.
            </p>
          </div>
        </button>
      )}

      {loading && (
        <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>Creating game…</p>
      )}

      <button
        onClick={onBack}
        disabled={loading}
        className="w-full py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-40"
        style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'transparent', color: 'var(--text-muted)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,185,129,0.4)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
      >
        ← Back
      </button>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function SetupModal({ onStart, onStartMultiplayer, multiplayerLoading, onClose }: Props) {
  const [panel, setPanel]           = useState<Panel>('main')
  const [selected, setSelected]     = useState(10)
  const [colorChoice, setColorChoice] = useState<'white' | 'random' | 'black'>('white')

  function handleStartAi() {
    const resolved: 'white' | 'black' =
      colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice
    onStart('ai', selected, resolved)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        style={{ background: 'rgba(9,14,22,0.96)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '20px', backdropFilter: 'blur(24px)', boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 40px rgba(16,185,129,0.06)', position: 'relative' }}
        className="w-full max-w-sm p-8 shadow-2xl"
      >
        {onClose && (
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
          >
            ✕
          </button>
        )}
        <h1 className="mb-2 text-center" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
          <span style={{ background: 'linear-gradient(135deg, #10b981, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>♟</span> Chess
        </h1>
        <p className="mb-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {panel === 'main' ? 'Choose how you want to play'
            : panel === 'pvp' ? 'Play vs Human'
            : panel === 'mp'  ? 'Play with Friend'
            : 'Play vs AI'}
        </p>

        {/* ── Main menu ──────────────────────────────────────────────────── */}
        {panel === 'main' && (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setPanel('pvp')}
              className="w-full py-3 text-lg font-bold text-white transition-all duration-200 hover:-translate-y-px"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '12px', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(16,185,129,0.45)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(16,185,129,0.3)' }}
            >
              Play vs Human
            </button>
            <button
              onClick={() => setPanel('mp')}
              disabled={multiplayerLoading}
              className="w-full py-3 text-lg font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '12px' }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; if (!b.disabled) b.style.borderColor = 'rgba(16,185,129,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
            >
              {multiplayerLoading ? 'Creating game…' : '🔗 Play with Friend'}
            </button>
            <button
              onClick={() => setPanel('ai')}
              className="w-full py-3 text-lg font-semibold text-white transition-all duration-200"
              style={{ background: 'rgba(16,185,129,0.06)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.06)' }}
            >
              Play vs AI
            </button>
          </div>
        )}

        {/* ── PvP mode picker ─────────────────────────────────────────────── */}
        {panel === 'pvp' && (
          <ModePicker
            onNormal={() => onStart('pvp', 10, 'white', false)}
            onRoyale={() => onStart('pvp', 10, 'white', true)}
            onBack={() => setPanel('main')}
          />
        )}

        {/* ── Multiplayer mode picker ──────────────────────────────────────── */}
        {panel === 'mp' && (
          <ModePicker
            loading={multiplayerLoading}
            onNormal={() => onStartMultiplayer?.(false, false)}
            onRoyale={() => onStartMultiplayer?.(true, false)}
            onFog={() => onStartMultiplayer?.(false, true)}
            onBack={() => setPanel('main')}
          />
        )}

        {/* ── AI difficulty + color picker ─────────────────────────────────── */}
        {panel === 'ai' && (
          <div>
            <p className="mb-4 text-center font-semibold text-white">Select Difficulty</p>
            <div className="flex flex-col gap-3 mb-6">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.skillLevel}
                  onClick={() => setSelected(d.skillLevel)}
                  className="flex flex-col items-start rounded-xl px-4 py-3 text-left transition-all"
                  style={{
                    border: `1px solid ${selected === d.skillLevel ? 'rgba(16,185,129,0.5)' : 'var(--border)'}`,
                    borderLeft: selected === d.skillLevel ? '3px solid #10b981' : undefined,
                    background: selected === d.skillLevel ? 'rgba(16,185,129,0.08)' : 'transparent',
                  }}
                >
                  <span className="font-semibold text-white">{d.label}</span>
                  <span className="text-xs" style={{ color: '#a0aec0' }}>{d.description}</span>
                </button>
              ))}
            </div>

            <p className="mb-3 text-center font-semibold text-white text-sm">Choose Your Color</p>
            <div className="flex gap-2 mb-6">
              {([
                { value: 'white',  label: '♙', name: 'White'  },
                { value: 'random', label: '⚄', name: 'Random' },
                { value: 'black',  label: '♟', name: 'Black'  },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setColorChoice(opt.value)}
                  className="flex-1 flex flex-col items-center py-3 rounded-xl transition-all duration-150"
                  style={{
                    border: `1px solid ${colorChoice === opt.value ? 'rgba(16,185,129,0.55)' : 'var(--border)'}`,
                    background: colorChoice === opt.value ? 'rgba(16,185,129,0.1)' : 'transparent',
                    boxShadow: colorChoice === opt.value ? '0 0 12px rgba(16,185,129,0.15)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '1.4rem', lineHeight: 1, color: opt.value === 'white' ? '#f0d9b5' : opt.value === 'black' ? '#ccc' : '#a0aec0' }}>
                    {opt.label}
                  </span>
                  <span className="text-xs mt-1 font-medium" style={{ color: colorChoice === opt.value ? '#10b981' : '#a0aec0' }}>
                    {opt.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPanel('main')}
                className="flex-1 py-3 text-sm font-semibold text-white transition-all duration-200"
                style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16,185,129,0.4)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
              >
                Back
              </button>
              <button
                onClick={handleStartAi}
                className="flex-1 py-3 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '12px', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}
              >
                Start Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
