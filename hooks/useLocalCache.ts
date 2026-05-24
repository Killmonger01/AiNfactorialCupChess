'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota exceeded or private browsing */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Stale-while-revalidate cache backed by localStorage.
 *
 * - If cached data exists: renders it immediately (no skeleton), then fetches
 *   fresh data in the background and silently updates the UI.
 * - If no cache: shows loading=true until the first fetch completes.
 * - `key=null` means "not ready yet" (e.g. waiting for auth) — nothing happens.
 */
export function useLocalCache<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: any[] = [],
): { data: T | null; loading: boolean; refresh: () => void } {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef            = useRef(fetcher)
  fetcherRef.current          = fetcher

  const run = useCallback(
    (cacheKey: string) => {
      // Show cached value instantly
      const cached = readCache<T>(cacheKey)
      if (cached !== null) {
        setData(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }

      // Fetch fresh in background
      fetcherRef.current()
        .then(fresh => {
          setData(fresh)
          setLoading(false)
          writeCache(cacheKey, fresh)
        })
        .catch(() => setLoading(false))
    },
    // deps intentionally omitted — callers control re-runs via the outer effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    if (!key) return
    run(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps])

  const refresh = useCallback(() => { if (key) run(key) }, [key, run])

  return { data, loading, refresh }
}
