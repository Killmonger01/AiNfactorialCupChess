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

export interface LeaderboardEntry {
  rank: number
  user_id: string
  email: string
  total_games: number
  wins: number
  win_rate: number
}

export interface FriendRequest {
  id: string
  requester_id: string
  email: string
  created_at: string
}

export type SendFriendRequestResult =
  | 'ok'
  | 'error:not_authenticated'
  | 'error:user_not_found'
  | 'error:cannot_add_self'
  | 'error:already_exists'

export interface Friend {
  friendship_id: string
  friend_id: string
  email: string
  total_games: number
  wins: number
  win_rate: number
}

export interface GameInvite {
  id: string
  game_id: string
  from_user_id: string
  email: string
  royale: boolean
  created_at: string
}

export interface UserPublicProfile {
  email: string
  total_games: number
  wins: number
  losses: number
  draws: number
  win_rate: number
}

export type FriendshipStatus = 'none' | 'sent_pending' | 'received_pending' | 'accepted'

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

/** Fetch the global leaderboard, ranked by win rate then total games. */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard')
  if (error) throw error
  return (data ?? []) as LeaderboardEntry[]
}

/** Send a friend request to a user by their email address. */
export async function sendFriendRequest(email: string): Promise<SendFriendRequestResult> {
  const { data, error } = await supabase.rpc('send_friend_request', { target_email: email })
  if (error) throw error
  return data as SendFriendRequestResult
}

/** Get all pending incoming friend requests for the current user. */
export async function getFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('get_friend_requests')
  if (error) throw error
  return (data ?? []) as FriendRequest[]
}

/** Accept or reject a friend request by its id. */
export async function respondToFriendRequest(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', id)
  if (error) throw error
}

/** Get all accepted friends for the current user with their stats. */
export async function getFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('get_friends')
  if (error) throw error
  return (data ?? []) as Friend[]
}

/** Send a game challenge invite to a friend. */
export async function sendGameInvite(toUserId: string, gameId: string, royale = false): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('game_invites').insert({
    game_id: gameId,
    from_user_id: user.id,
    to_user_id: toUserId,
    royale,
  })
  if (error) throw error
}

/** Get all pending incoming game challenge invites for the current user. */
export async function getIncomingInvites(): Promise<GameInvite[]> {
  const { data, error } = await supabase.rpc('get_incoming_invites')
  if (error) throw error
  return (data ?? []) as GameInvite[]
}

/** Accept or decline a game invite (updates status; navigating to the game is separate). */
export async function respondToGameInvite(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('game_invites')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', id)
  if (error) throw error
}

/** Fetch public stats + email for any user by UUID. Returns null if not found. */
export async function getUserPublicProfile(userId: string): Promise<UserPublicProfile | null> {
  const { data, error } = await supabase.rpc('get_user_public_stats', { p_user_id: userId })
  if (error) throw error
  return (data?.[0] ?? null) as UserPublicProfile | null
}

/** Check friendship status between the current user and a target user. */
export async function getFriendshipStatus(myId: string, theirId: string): Promise<FriendshipStatus> {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, status')
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${theirId}),and(requester_id.eq.${theirId},addressee_id.eq.${myId})`)
    .maybeSingle()
  if (!data) return 'none'
  if (data.status === 'accepted') return 'accepted'
  return data.requester_id === myId ? 'sent_pending' : 'received_pending'
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
