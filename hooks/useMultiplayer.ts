'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getOrCreatePlayerId,
  joinMultiplayerGame,
  sendMove,
  subscribeToGame,
  type MultiplayerGameRow,
} from '@/lib/multiplayer'
import type { GameState, Move } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MultiplayerStatus = 'connecting' | 'waiting' | 'active' | 'finished' | 'error'

export interface UseMultiplayerReturn {
  playerId: string
  role: 'white' | 'black' | null
  opponentConnected: boolean
  gameState: GameState | null
  lastMove: Move | null
  status: MultiplayerStatus
  error: string | null
  applyMove: (newGameState: GameState, move: Move) => Promise<void>
  resign: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMultiplayer(gameId: string): UseMultiplayerReturn {
  // Stable player identity across re-renders and refreshes
  const playerId = useRef(getOrCreatePlayerId()).current

  const [role, setRole]                   = useState<'white' | 'black' | null>(null)
  const [opponentConnected, setOpponent]  = useState(false)
  const [gameState, setGameState]         = useState<GameState | null>(null)
  const [lastMove, setLastMove]           = useState<Move | null>(null)
  const [status, setStatus]               = useState<MultiplayerStatus>('connecting')
  const [error, setError]                 = useState<string | null>(null)

  // Keep role in a ref so the Realtime closure always has the current value
  const roleRef = useRef<'white' | 'black' | null>(null)

  // Apply a game row update to local state
  function applyRow(g: MultiplayerGameRow, myRole: 'white' | 'black') {
    try {
      setGameState(JSON.parse(g.fen) as GameState)
    } catch {
      /* invalid JSON — keep previous state */
    }
    setStatus(g.status as MultiplayerStatus)
    setOpponent(myRole === 'white' ? !!g.black_player_id : !!g.white_player_id)
    if (g.last_move) setLastMove(g.last_move as Move)
  }

  useEffect(() => {
    let mounted = true
    let channel: ReturnType<typeof subscribeToGame> | null = null

    joinMultiplayerGame(supabase, gameId, playerId)
      .then(({ role: r, game }) => {
        if (!mounted) return

        setRole(r)
        roleRef.current = r
        applyRow(game, r)

        channel = subscribeToGame(supabase, gameId, (updated) => {
          if (!mounted) return
          applyRow(updated, roleRef.current!)
        })

        // Handle race: component unmounted while join was in flight
        if (!mounted) {
          channel.unsubscribe()
          channel = null
        }
      })
      .catch((err: Error) => {
        if (!mounted) return
        setError(err.message)
        setStatus('error')
      })

    return () => {
      mounted = false
      channel?.unsubscribe()
    }
  }, [gameId, playerId])

  const applyMove = useCallback(
    async (newGameState: GameState, move: Move) => {
      // Optimistic local update
      setGameState(newGameState)
      setLastMove(move)
      // Persist to Supabase → triggers Realtime for opponent
      await sendMove(supabase, gameId, newGameState, move)
    },
    [gameId],
  )

  const resign = useCallback(async () => {
    if (!role || !gameState) return
    const opponent: 'white' | 'black' = role === 'white' ? 'black' : 'white'
    const resignedState: GameState = {
      ...gameState,
      isCheckmate: true,
      winner: opponent,
      isResigned: true,
      resignedBy: role,
    }
    setGameState(resignedState)
    await supabase
      .from('multiplayer_games')
      .update({
        fen: JSON.stringify(resignedState),
        current_turn: resignedState.currentTurn,
        status: 'finished',
      })
      .eq('id', gameId)
  }, [role, gameState, gameId])

  return { playerId, role, opponentConnected, gameState, lastMove, status, error, applyMove, resign }
}
