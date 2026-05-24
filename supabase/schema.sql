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
