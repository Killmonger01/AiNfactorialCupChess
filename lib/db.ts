import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameRecord {
  user_id: string
  pgn: string
  result: 'white_wins' | 'black_wins' | 'draw'
  opponent: 'human' | 'ai'
  ai_difficulty?: 'easy' | 'medium' | 'hard' | null
  moves_count: number
}

export interface GameRow extends GameRecord {
  id: string
  played_at: string
}

export interface UserStats {
  total: number
  wins: number
  losses: number
  draws: number
  winRate: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map numeric skill level to difficulty label for the DB */
export function skillLevelToDifficulty(
  skillLevel: number,
): 'easy' | 'medium' | 'hard' | null {
  if (skillLevel <= 3)  return 'easy'
  if (skillLevel <= 12) return 'medium'
  return 'hard'
}

// ─── DB functions ─────────────────────────────────────────────────────────────

/** Insert a completed game row. Throws on error. */
export async function saveGame(gameData: GameRecord): Promise<void> {
  const { error } = await supabase.from('games').insert(gameData)
  if (error) throw error
}

/** Fetch all games for a user, newest first. */
export async function getUserGames(userId: string): Promise<GameRow[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as GameRow[]
}

/**
 * Aggregate stats for a user.
 * Wins are counted from white_wins (player always plays white vs AI).
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  const { data, error } = await supabase
    .from('games')
    .select('result')
    .eq('user_id', userId)
  if (error) throw error

  const rows = data ?? []
  const total  = rows.length
  const wins   = rows.filter(r => r.result === 'white_wins').length
  const losses = rows.filter(r => r.result === 'black_wins').length
  const draws  = rows.filter(r => r.result === 'draw').length
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0

  return { total, wins, losses, draws, winRate }
}
