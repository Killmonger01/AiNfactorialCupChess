'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface IsProState {
  isPro: boolean
  loading: boolean
  refresh: () => void
}

const CACHE_KEY = 'user:isPro'

export function useIsPro(): IsProState {
  const [isPro,   setIsPro]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [tick,    setTick]    = useState(0)

  const refresh = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // Show cached value immediately (stale-while-revalidate)
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached !== null) { setIsPro(JSON.parse(cached)); setLoading(false) }
    } catch { /* ignore */ }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      if (!session?.user) {
        setIsPro(false)
        setLoading(false)
        try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!cancelled) {
        const val = data?.is_pro ?? false
        setIsPro(val)
        setLoading(false)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(val)) } catch { /* ignore */ }
      }
    })

    return () => { cancelled = true }
  }, [tick])

  return { isPro, loading, refresh }
}
