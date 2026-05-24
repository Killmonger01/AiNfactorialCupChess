-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ─── Games table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pgn          TEXT,
  result       TEXT        NOT NULL CHECK (result IN ('white_wins', 'black_wins', 'draw')),
  opponent     TEXT        NOT NULL CHECK (opponent IN ('human', 'ai')),
  ai_difficulty TEXT       CHECK (ai_difficulty IN ('easy', 'medium', 'hard')),
  played_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moves_count  INTEGER     NOT NULL DEFAULT 0
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Users may only see their own rows
CREATE POLICY "users_select_own_games"
  ON games FOR SELECT
  USING (auth.uid() = user_id);

-- Users may only insert rows where user_id matches their own id
CREATE POLICY "users_insert_own_games"
  ON games FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Leaderboard function ────────────────────────────────────────────────────
-- SECURITY DEFINER bypasses RLS to aggregate all users' stats safely.
-- Only returns aggregated data (no raw game records exposed).
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  rank        BIGINT,
  user_id     UUID,
  email       TEXT,
  total_games BIGINT,
  wins        BIGINT,
  win_rate    NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN COUNT(*) > 0
          THEN COUNT(*) FILTER (WHERE g.result = 'white_wins')::NUMERIC / COUNT(*)
          ELSE 0
        END DESC,
        COUNT(*) DESC
    ) AS rank,
    g.user_id,
    u.email,
    COUNT(*)                                                          AS total_games,
    COUNT(*) FILTER (WHERE g.result = 'white_wins')                   AS wins,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE g.result = 'white_wins')::NUMERIC / COUNT(*) * 100,
        1
      )
      ELSE 0
    END                                                               AS win_rate
  FROM games g
  JOIN auth.users u ON u.id = g.user_id
  GROUP BY g.user_id, u.email
  ORDER BY win_rate DESC, total_games DESC
$$;

-- Allow both anonymous and authenticated callers to invoke the leaderboard
GRANT EXECUTE ON FUNCTION get_leaderboard() TO anon, authenticated;

-- ─── Friendships table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  addressee_id UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Both parties can see their own friendship rows
CREATE POLICY "users_see_own_friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Only the addressee may update (accept / reject)
CREATE POLICY "addressee_update_friendship"
  ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id);

-- ─── send_friend_request(target_email) ──────────────────────────────────────
-- SECURITY DEFINER so we can look up auth.users by email without exposing it.
CREATE OR REPLACE FUNCTION send_friend_request(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id  UUID;
  caller_id  UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RETURN 'error:not_authenticated';
  END IF;

  SELECT id INTO target_id FROM auth.users WHERE email = lower(trim(target_email));

  IF target_id IS NULL THEN
    RETURN 'error:user_not_found';
  END IF;

  IF target_id = caller_id THEN
    RETURN 'error:cannot_add_self';
  END IF;

  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE (requester_id = caller_id AND addressee_id = target_id)
       OR (requester_id = target_id AND addressee_id = caller_id)
  ) THEN
    RETURN 'error:already_exists';
  END IF;

  INSERT INTO friendships (requester_id, addressee_id)
  VALUES (caller_id, target_id);

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION send_friend_request(TEXT) TO authenticated;

-- ─── get_friend_requests() ───────────────────────────────────────────────────
-- Returns pending incoming requests for the current user with sender email.
CREATE OR REPLACE FUNCTION get_friend_requests()
RETURNS TABLE (
  id           UUID,
  requester_id UUID,
  email        TEXT,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT f.id, f.requester_id, u.email, f.created_at
  FROM friendships f
  JOIN auth.users u ON u.id = f.requester_id
  WHERE f.addressee_id = auth.uid()
    AND f.status = 'pending'
  ORDER BY f.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION get_friend_requests() TO authenticated;

-- ─── get_friends() ───────────────────────────────────────────────────────────
-- Returns all accepted friends for the current user with their email + stats.
CREATE OR REPLACE FUNCTION get_friends()
RETURNS TABLE (
  friendship_id UUID,
  friend_id     UUID,
  email         TEXT,
  total_games   BIGINT,
  wins          BIGINT,
  win_rate      NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH my_friends AS (
    SELECT
      f.id AS friendship_id,
      CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END AS friend_id
    FROM friendships f
    WHERE (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
      AND f.status = 'accepted'
  )
  SELECT
    mf.friendship_id,
    mf.friend_id,
    u.email,
    COUNT(g.id)::BIGINT AS total_games,
    COUNT(g.id) FILTER (WHERE g.result = 'white_wins')::BIGINT AS wins,
    CASE WHEN COUNT(g.id) > 0
      THEN ROUND(COUNT(g.id) FILTER (WHERE g.result = 'white_wins')::NUMERIC / COUNT(g.id) * 100, 1)
      ELSE 0::NUMERIC
    END AS win_rate
  FROM my_friends mf
  JOIN auth.users u ON u.id = mf.friend_id
  LEFT JOIN games g ON g.user_id = mf.friend_id
  GROUP BY mf.friendship_id, mf.friend_id, u.email
  ORDER BY u.email
$$;

GRANT EXECUTE ON FUNCTION get_friends() TO authenticated;

-- ─── Game invites table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      TEXT        NOT NULL,
  from_user_id UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  to_user_id   UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_game_invites"
  ON game_invites FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "users_send_game_invites"
  ON game_invites FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "recipient_update_game_invite"
  ON game_invites FOR UPDATE
  USING (auth.uid() = to_user_id);

-- ─── get_incoming_invites() ───────────────────────────────────────────────────
-- Returns pending game challenge invites for the current user with sender email.
CREATE OR REPLACE FUNCTION get_incoming_invites()
RETURNS TABLE (
  id           UUID,
  game_id      TEXT,
  from_user_id UUID,
  email        TEXT,
  royale       BOOLEAN,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT gi.id, gi.game_id, gi.from_user_id, u.email, gi.royale, gi.created_at
  FROM game_invites gi
  JOIN auth.users u ON u.id = gi.from_user_id
  WHERE gi.to_user_id = auth.uid()
    AND gi.status = 'pending'
  ORDER BY gi.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION get_incoming_invites() TO authenticated;

-- ─── get_user_public_stats(p_user_id) ────────────────────────────────────────
-- Returns public stats + email for any user by their UUID.
CREATE OR REPLACE FUNCTION get_user_public_stats(p_user_id UUID)
RETURNS TABLE (
  email       TEXT,
  total_games BIGINT,
  wins        BIGINT,
  losses      BIGINT,
  draws       BIGINT,
  win_rate    NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    u.email,
    COUNT(g.id)::BIGINT AS total_games,
    COUNT(g.id) FILTER (WHERE g.result = 'white_wins')::BIGINT AS wins,
    COUNT(g.id) FILTER (WHERE g.result = 'black_wins')::BIGINT AS losses,
    COUNT(g.id) FILTER (WHERE g.result = 'draw')::BIGINT AS draws,
    CASE WHEN COUNT(g.id) > 0
      THEN ROUND(COUNT(g.id) FILTER (WHERE g.result = 'white_wins')::NUMERIC / COUNT(g.id) * 100, 1)
      ELSE 0::NUMERIC
    END AS win_rate
  FROM auth.users u
  LEFT JOIN games g ON g.user_id = u.id
  WHERE u.id = p_user_id
  GROUP BY u.email
$$;

GRANT EXECUTE ON FUNCTION get_user_public_stats(UUID) TO anon, authenticated;

-- ─── Chess Royale columns ────────────────────────────────────────────────────
-- Add royale flag to multiplayer_games so the game knows which ruleset to apply.
ALTER TABLE multiplayer_games ADD COLUMN IF NOT EXISTS royale BOOLEAN DEFAULT FALSE;

-- Add royale flag to game_invites so the notification can show the mode.
ALTER TABLE game_invites ADD COLUMN IF NOT EXISTS royale BOOLEAN DEFAULT FALSE;

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Push game_invites changes over WebSocket so challenge notifications are instant.
ALTER PUBLICATION supabase_realtime ADD TABLE game_invites;

-- ─── Performance indexes ─────────────────────────────────────────────────────

-- games: covering index (user_id, result) serves every aggregate query
-- (leaderboard, user stats, friend stats) without a heap lookup per row.
-- The played_at index covers the getUserGames ORDER BY.
CREATE INDEX IF NOT EXISTS idx_games_user_result
  ON games (user_id, result);

CREATE INDEX IF NOT EXISTS idx_games_user_played_at
  ON games (user_id, played_at DESC);

-- friendships: composite indexes match the two common WHERE patterns:
--   get_friend_requests  → addressee_id + status = 'pending'
--   get_friends          → each side (requester / addressee) + status = 'accepted'
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_status
  ON friendships (addressee_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_requester_status
  ON friendships (requester_id, status);

-- game_invites: covers get_incoming_invites (to_user_id + status = 'pending')
CREATE INDEX IF NOT EXISTS idx_game_invites_to_status
  ON game_invites (to_user_id, status);
