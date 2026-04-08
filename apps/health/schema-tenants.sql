-- ============================================================================
-- Yaya Health — Tenant Management, WhatsApp Sessions & Message Logging
-- ============================================================================

-- Extend tenants table with status & updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'status') THEN
    ALTER TABLE tenants ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'paused', 'inactive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'updated_at') THEN
    ALTER TABLE tenants ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- WhatsApp session tracking per tenant
CREATE TABLE IF NOT EXISTS tenant_sessions (
    tenant_id       uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    phone           text,
    connection_status text NOT NULL DEFAULT 'disconnected'
                    CHECK (connection_status IN ('connected', 'disconnected', 'qr_pending', 'connecting')),
    error_message   text,
    reconnect_attempts int NOT NULL DEFAULT 0,
    last_connected_at timestamptz,
    last_qr_at      timestamptz,
    updated_at      timestamptz DEFAULT now()
);

-- Standalone WhatsApp message log (separate from clinical message_log)
CREATE TABLE IF NOT EXISTS wa_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel         text NOT NULL DEFAULT 'whatsapp',
    jid             text NOT NULL,
    push_name       text,
    direction       text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    body            text,
    timestamp       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant_jid
    ON wa_messages (tenant_id, jid, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant_ts
    ON wa_messages (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_sessions_status
    ON tenant_sessions (connection_status);

-- ============================================================================
-- RLS Policies (match existing pattern)
-- ============================================================================

ALTER TABLE tenant_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_sessions' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON tenant_sessions
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;

ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wa_messages' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON wa_messages
      FOR ALL
      USING (tenant_id = current_setting('app.tenant_id')::uuid);
  END IF;
END $$;
