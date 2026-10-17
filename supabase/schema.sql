-- Yoetz HaRechev (Strauss Car Advisor) - Supabase schema
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS / IF EXISTS everywhere).
--
-- Access model (3-tier): only the server talks to the database, with SUPABASE_SERVICE_ROLE_KEY.
-- RLS is enabled on every table with NO policies, and anon/authenticated have no grants:
-- the public anon key can read or write nothing. The service role bypasses RLS.

-- 1. Sessions (one employee conversation)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_scenario JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_comparison JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS pending_fields JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 2. Messages
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'rep')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_messages_session_id_created ON messages(session_id, created_at ASC);

-- 3. Tickets (questions to a payroll rep)
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
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_comparison JSONB;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transcript JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_session ON tickets(session_id);

-- 4. Admin settings (rules override)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Tax Authority benefit values (uploaded by the admin)
CREATE TABLE IF NOT EXISTS tax_records (
    key TEXT PRIMARY KEY, -- regYear|vehicleType|productCode|modelCode
    reg_year TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    product_code TEXT NOT NULL,
    model_code TEXT NOT NULL,
    commercial_name TEXT,
    benefit_value NUMERIC NOT NULL,
    drive_code INTEGER,
    list_price NUMERIC,
    source_row INTEGER
);

-- 6. Lock everything down: server (service role) only
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON sessions, messages, tickets, app_settings, tax_records FROM anon, authenticated;

-- The browser no longer subscribes to realtime changes (the server polls): remove the tables from
-- the realtime publication if an older version of this script added them.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tickets', 'messages', 'sessions'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I', t);
    END IF;
  END LOOP;
END $$;
