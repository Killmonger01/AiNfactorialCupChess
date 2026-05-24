import React from 'react'

// ─── Base shimmer block ───────────────────────────────────────────────────────

interface SkProps {
  w?: string | number
  h?: string | number
  radius?: number
  className?: string
  style?: React.CSSProperties
}

export function Sk({ w = '100%', h = 16, radius = 6, className = '', style }: SkProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, ...style }}
    />
  )
}

// ─── Circle ──────────────────────────────────────────────────────────────────

export function SkCircle({ size = 36 }: { size?: number }) {
  return <Sk w={size} h={size} radius={size / 2} />
}

// ─── Leaderboard table skeleton ───────────────────────────────────────────────

export function SkLeaderboard({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      {/* fake banner */}
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(16,185,129,0.04)' }}>
        <Sk w={240} h={14} />
      </div>
      {/* fake thead */}
      <div
        className="grid px-5 py-3 gap-4"
        style={{ gridTemplateColumns: '32px 1fr 60px 50px 72px', background: '#1e2738', borderBottom: '1px solid var(--border)' }}
      >
        {['32px','80px','40px','36px','52px'].map((w, i) => <Sk key={i} w={w} h={11} />)}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid items-center px-5 py-3.5 gap-4"
          style={{
            gridTemplateColumns: '32px 1fr 60px 50px 72px',
            background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <Sk w={22} h={22} radius={11} />
          <Sk w={`${55 + (i * 17) % 40}%`} h={14} />
          <Sk w={28} h={14} style={{ marginLeft: 'auto' }} />
          <Sk w={24} h={14} style={{ marginLeft: 'auto' }} />
          <Sk w={40} h={14} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

// ─── Friends list skeleton ────────────────────────────────────────────────────

export function SkFriends({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
            borderTop: i > 0 ? '1px solid var(--border)' : undefined,
          }}
        >
          <div className="flex items-center gap-3">
            <SkCircle size={36} />
            <div className="flex flex-col gap-1.5">
              <Sk w={`${80 + (i * 23) % 60}px`} h={13} />
              <Sk w={`${60 + (i * 17) % 40}px`} h={11} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sk w={60}  h={30} radius={8} />
            <Sk w={90}  h={30} radius={8} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Requests list skeleton ───────────────────────────────────────────────────

export function SkRequests({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
            borderTop: i > 0 ? '1px solid var(--border)' : undefined,
          }}
        >
          <div className="flex items-center gap-3">
            <SkCircle size={36} />
            <div className="flex flex-col gap-1.5">
              <Sk w={`${90 + (i * 19) % 50}px`} h={13} />
              <Sk w={60} h={11} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sk w={64}  h={30} radius={8} />
            <Sk w={60}  h={30} radius={8} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Profile stats cards skeleton ────────────────────────────────────────────

export function SkStatCards({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center px-6 py-5"
          style={{ border: '1px solid var(--border)', borderRadius: 16, gap: 10 }}
        >
          <SkCircle size={32} />
          <Sk w={44} h={28} radius={6} />
          <Sk w={52} h={10} radius={4} />
        </div>
      ))}
    </div>
  )
}

// ─── Profile game history table skeleton ──────────────────────────────────────

export function SkGameTable({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {/* thead */}
      <div
        className="grid px-4 py-2 gap-4"
        style={{ gridTemplateColumns: '1fr 80px 80px 70px 60px', background: '#1e2738', borderBottom: '1px solid var(--border)' }}
      >
        {[80, 56, 60, 50, 36].map((w, i) => <Sk key={i} w={w} h={11} />)}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid items-center px-4 py-3 gap-4"
          style={{
            gridTemplateColumns: '1fr 80px 80px 70px 60px',
            background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <Sk w={`${50 + (i * 13) % 30}%`} h={13} />
          <Sk w={48} h={13} />
          <Sk w={40} h={13} />
          <Sk w={36} h={22} radius={99} />
          <Sk w={28} h={13} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

// ─── Player public profile skeleton ──────────────────────────────────────────

export function SkPlayerProfile() {
  return (
    <>
      {/* Player card */}
      <div
        className="flex flex-col items-center text-center gap-4 p-8 mb-8"
        style={{
          background: 'rgba(9,14,22,0.75)',
          border: '1px solid rgba(16,185,129,0.08)',
          borderRadius: 20,
          backdropFilter: 'blur(24px)',
        }}
      >
        <SkCircle size={80} />
        <div className="flex flex-col items-center gap-2">
          <Sk w={160} h={24} radius={8} />
          <Sk w={90}  h={13} radius={6} />
        </div>
        <div className="flex gap-2 mt-1">
          <Sk w={110} h={36} radius={10} />
          <Sk w={110} h={36} radius={10} />
        </div>
      </div>
      {/* Stat cards */}
      <SkStatCards count={5} />
    </>
  )
}
