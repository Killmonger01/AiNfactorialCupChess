'use client'

import { useState } from 'react'
import type { GameMode } from '@/hooks/useChess'

interface Props {
  onStart: (mode: GameMode, skillLevel: number, playerColor?: 'white' | 'black') => void
  onStartMultiplayer?: () => void
  multiplayerLoading?: boolean
}

const DIFFICULTIES = [
  { label: 'Easy',   skillLevel: 2,  description: 'Makes mistakes, good for beginners' },
  { label: 'Medium', skillLevel: 10, description: 'A fair challenge' },
  { label: 'Hard',   skillLevel: 20, description: 'Near-perfect play' },
] as const

export default function SetupModal({ onStart, onStartMultiplayer, multiplayerLoading }: Props) {
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [selected, setSelected] = useState(10)
  const [colorChoice, setColorChoice] = useState<'white' | 'random' | 'black'>('white')

  function handleStartAi() {
    const resolved: 'white' | 'black' =
      colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice
    onStart('ai', selected, resolved)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div
        style={{ background: 'rgba(9,14,22,0.96)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '20px', backdropFilter: 'blur(24px)', boxShadow: '0 0 80px rgba(0,0,0,0.9), 0 0 40px rgba(16,185,129,0.06)' }}
        className="w-full max-w-sm p-8 shadow-2xl"
      >
        <h1 className="mb-2 text-center" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>
          <span style={{ background: 'linear-gradient(135deg, #10b981, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>♟</span> Chess
        </h1>
        <p className="mb-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Choose how you want to play
        </p>

        {!showAiPanel ? (
          <div className="flex flex-col gap-4">
            <button
              onClick={() => onStart('pvp', 10)}
              className="w-full py-3 text-lg font-bold text-white transition-all duration-200 hover:-translate-y-px"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(16,185,129,0.45)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(16,185,129,0.3)' }}
            >
              Play vs Human
            </button>
            <button
              onClick={() => {
                console.log('[MP] button onClick fired, loading:', multiplayerLoading)
                onStartMultiplayer?.()
              }}
              disabled={multiplayerLoading}
              className="w-full py-3 text-lg font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '12px' }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; if (!b.disabled) b.style.borderColor = 'rgba(16,185,129,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
            >
              {multiplayerLoading ? 'Creating game…' : '🔗 Play with Friend'}
            </button>
            <button
              onClick={() => setShowAiPanel(true)}
              className="w-full py-3 text-lg font-semibold text-white transition-all duration-200"
              style={{ background: 'rgba(16,185,129,0.06)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.12)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.06)' }}
            >
              Play vs AI
            </button>
          </div>
        ) : (
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
                  <span className="text-xs" style={{ color: '#a0aec0' }}>
                    {d.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Color picker */}
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
                onClick={() => setShowAiPanel(false)}
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
