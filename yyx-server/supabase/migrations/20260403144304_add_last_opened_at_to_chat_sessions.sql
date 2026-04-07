-- Migration: Add last_opened_at to ai_chat_sessions for recency-based ordering
-- Author: database-agent
-- Date: 2026-04-03

-- ============================================================
-- Add last_opened_at column
-- ============================================================

-- Add last_opened_at for ordering chat sessions by recency of use
ALTER TABLE ai_chat_sessions ADD COLUMN last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill existing rows with their creation date
UPDATE ai_chat_sessions SET last_opened_at = created_at;

-- Index for efficient ordering by last opened
CREATE INDEX idx_chat_sessions_last_opened ON ai_chat_sessions (user_id, last_opened_at DESC, created_at DESC);
