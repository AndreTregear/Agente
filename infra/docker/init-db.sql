-- Yaya Platform — Multi-database initialization
-- This script runs once when the postgres container is first created.
-- It creates separate databases and users for each service.
--
-- Passwords are read from environment variables passed by docker-compose.
-- The POSTGRES_PASSWORD env var is available via the postgres entrypoint.
-- Service-specific passwords come from env vars: LAGO_DB_PASSWORD,
-- CRM_DB_PASSWORD, METABASE_DB_PASSWORD, CALCOM_DB_PASSWORD.
--
-- Usage: These \set commands read from psql environment variables.
-- docker-compose passes them via the postgres container's environment.

\set lago_pass `echo "${LAGO_DB_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo GENERATED_CHANGE_ME)}"`
\set crm_pass `echo "${CRM_DB_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo GENERATED_CHANGE_ME)}"`
\set metabase_pass `echo "${METABASE_DB_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo GENERATED_CHANGE_ME)}"`
\set calcom_pass `echo "${CALCOM_DB_PASSWORD:-$(openssl rand -hex 16 2>/dev/null || echo GENERATED_CHANGE_ME)}"`

-- ── Lago Billing Database ────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lago') THEN
        CREATE ROLE lago WITH LOGIN PASSWORD :'lago_pass';
    END IF;
END
$$;

CREATE DATABASE lago_db OWNER lago;

-- Grant minimal required privileges instead of ALL
GRANT CONNECT ON DATABASE lago_db TO lago;
\c lago_db;
GRANT USAGE ON SCHEMA public TO lago;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lago;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lago;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lago;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lago;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reconnect to default database
\c :DBNAME;

-- ── Atomic CRM Database ─────────────────────────────
-- Note: CRM uses its own Supabase postgres instance (supabase-db).
-- This entry is for any shared CRM data that needs to live in the main PG.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'crm') THEN
        CREATE ROLE crm WITH LOGIN PASSWORD :'crm_pass';
    END IF;
END
$$;

CREATE DATABASE crm_db OWNER crm;

GRANT CONNECT ON DATABASE crm_db TO crm;
\c crm_db;
GRANT USAGE ON SCHEMA public TO crm;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO crm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c :DBNAME;

-- ── Metabase Database ─────────────────────────────────
-- Internal metadata store for Metabase BI dashboards.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'metabase') THEN
        CREATE ROLE metabase WITH LOGIN PASSWORD :'metabase_pass';
    END IF;
END
$$;

CREATE DATABASE metabase_db OWNER metabase;

GRANT CONNECT ON DATABASE metabase_db TO metabase;
\c metabase_db;
GRANT USAGE ON SCHEMA public TO metabase;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO metabase;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO metabase;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO metabase;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO metabase;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c :DBNAME;

-- ── Cal.com Database ──────────────────────────────────
-- Scheduling data for Cal.com (appointments, availability, bookings).
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'calcom') THEN
        CREATE ROLE calcom WITH LOGIN PASSWORD :'calcom_pass';
    END IF;
END
$$;

CREATE DATABASE calcom_db OWNER calcom;

GRANT CONNECT ON DATABASE calcom_db TO calcom;
\c calcom_db;
GRANT USAGE ON SCHEMA public TO calcom;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO calcom;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO calcom;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO calcom;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO calcom;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c :DBNAME;

-- ── Extensions for main yaya database ────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Schema for agent workspace ───────────────────────
CREATE SCHEMA IF NOT EXISTS agent;

CREATE TABLE IF NOT EXISTS agent.conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel TEXT NOT NULL,               -- whatsapp, telegram
    remote_id TEXT NOT NULL,             -- phone number or chat id
    business_id TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS agent.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES agent.conversations(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tool_calls JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent.payment_validations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,                -- yape, plin, nequi, bank_transfer
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PEN',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    proof_url TEXT,                      -- minio path to screenshot
    validated_by TEXT,                   -- owner phone or 'auto'
    created_at TIMESTAMPTZ DEFAULT now(),
    validated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_remote ON agent.conversations(remote_id, business_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON agent.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order ON agent.payment_validations(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON agent.payment_validations(status);
