-- Yoetz HaRechev (Strauss Car Advisor) - Supabase Schema
-- Run this in your Supabase SQL editor to enable multi-device persistence and realtime sync.

-- 1. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_scenario JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'rep')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for speedy transcript loading
CREATE INDEX IF NOT EXISTS idx_messages_session_id_created ON messages(session_id, created_at ASC);

-- 3. Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'answered', 'closed')) DEFAULT 'open',
    answer JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    answered_at TIMESTAMPTZ DEFAULT NULL
);

-- Index for rep ticket queue
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status, created_at DESC);

-- Enable Supabase Realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
