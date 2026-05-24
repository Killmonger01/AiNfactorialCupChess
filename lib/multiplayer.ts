/**
 * Supabase Realtime multiplayer helpers.
 *
 * Required Supabase setup (run in SQL editor):
 *   alter publication supabase_realtime add table multiplayer_games;
 *
 * The `fen` column stores JSON.stringify(GameState) — full board state.
 * The `last_move` column stores the full Move object as JSONB.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { GameState, Move } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MultiplayerGameRow {
  id: string
  fen: string                               // JSON.stringify(GameState)
  current_turn: string
  status: 'waiting' | 'active' | 'finished'
  white_player_id: string | null
  black_player_id: string | null
  last_move: Move | null
  created_at: string
}

// ─── Player identity ──────────────────────────────────────────────────────────

/** Generates or retrieves a stable anonymous player ID stored in localStorage. */
export function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    const stored = localStorage.getItem('mp_player_id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('mp_player_id', id)
    return id
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2)
  }
}

// ─── Game CRUD ────────────────────────────────────────────────────────────────

/** Creates a new waiting game row; caller becomes white. Returns the game UUID. */
export async function createMultiplayerGame(
  supabase: SupabaseClient,
  initialState: GameState,
  playerId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('multiplayer_games')
    .insert({
      fen: JSON.stringify(initialState),
      current_turn: 'white',
      status: 'waiting',
      white_player_id: playerId,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

/**
 * Joins an existing game or reconnects if the player is already in it.
 * First visitor after the creator takes the black slot and activates the game.
 */
export async function joinMultiplayerGame(
  supabase: SupabaseClient,
  gameId: string,
  playerId: string,
): Promise<{ role: 'white' | 'black'; game: MultiplayerGameRow }> {
  const { data, error } = await supabase
    .from('multiplayer_games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error) throw new Error(error.message)
  const g = data as MultiplayerGameRow

  // Reconnect to existing role
  if (g.white_player_id === playerId) return { role: 'white', game: g }
  if (g.black_player_id === playerId) return { role: 'black', game: g }

  // Claim white slot if empty (edge case: white left before anyone joined)
  if (!g.white_player_id) {
    const { error: e } = await supabase
      .from('multiplayer_games')
      .update({ white_player_id: playerId })
      .eq('id', gameId)
    if (e) throw new Error(e.message)
    return { role: 'white', game: { ...g, white_player_id: playerId } }
  }

  // Claim black slot — activates the game
  if (!g.black_player_id) {
    const { error: e } = await supabase
      .from('multiplayer_games')
      .update({ black_player_id: playerId, status: 'active' })
      .eq('id', gameId)
    if (e) throw new Error(e.message)
    return {
      role: 'black',
      game: { ...g, black_player_id: playerId, status: 'active' },
    }
  }

  throw new Error('This game already has two players.')
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

/** Subscribes to UPDATE events on a game row. Returns the channel for cleanup. */
export function subscribeToGame(
  supabase: SupabaseClient,
  gameId: string,
  onUpdate: (game: MultiplayerGameRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`mp-game-${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'multiplayer_games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => onUpdate(payload.new as MultiplayerGameRow),
    )
    .subscribe()
}

// ─── Move sync ────────────────────────────────────────────────────────────────

/** Persists the result of a move to Supabase, triggering Realtime for the opponent. */
export async function sendMove(
  supabase: SupabaseClient,
  gameId: string,
  newGameState: GameState,
  lastMove: Move,
): Promise<void> {
  const { error } = await supabase
    .from('multiplayer_games')
    .update({
      fen: JSON.stringify(newGameState),
      current_turn: newGameState.currentTurn,
      last_move: lastMove,
      status:
        newGameState.isCheckmate || newGameState.isStalemate ? 'finished' : 'active',
    })
    .eq('id', gameId)

  if (error) throw new Error(error.message)
}
