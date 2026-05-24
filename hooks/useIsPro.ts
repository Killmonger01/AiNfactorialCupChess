'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface IsProState {
  isPro: boolean
  loading: boolean
  /** Re-fetch (e.g. after set-pro call) */
  refresh: () => void
}

export function useIsPro(): IsProState {
  const [isPro,    setIsPro]    = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [tick,     setTick]     = useState(0)

  const refresh = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      if (!session?.user) {
        console.log('[useIsPro] no session, isPro = false')
        setIsPro(false)
        setLoading(false)
        return
      }
      console.log('[useIsPro] fetching profiles for user:', session.user.id)
      const { data, error } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', session.user.id)
        .maybeSingle()
      console.log('[useIsPro] result:', { data, error })
      if (!cancelled) {
        setIsPro(data?.is_pro ?? false)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [tick])

  return { isPro, loading, refresh }
}
