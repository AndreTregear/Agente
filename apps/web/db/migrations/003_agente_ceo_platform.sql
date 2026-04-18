-- Full business platform tables: email, calendar, meetings, documents

-- ── Email integration ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agente_ceo_email_accounts (
    id              TEXT PRIMARY KEY DEFAULT 'ea_' || substr(md5(random()::text), 1, 16),
    user_id         TEXT NOT NULL,
    provider        TEXT NOT NULL DEFAULT 'imap',  -- imap, gmail, outlook
    email_address   TEXT NOT NULL,
    display_name    TEXT,
    imap_host       TEXT,
    imap_port       INTEGER DEFAULT 993,
    smtp_host       TEXT,
    smtp_port       INTEGER DEFAULT 587,
    -- Credentials stored encrypted (app-level encryption, not plaintext)
    credentials     JSONB NOT NULL DEFAULT '{}',
    last_sync_at    TIMESTAMPTZ,
    sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','syncing','synced','error')),
    sync_error      TEXT,
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON agente_ceo_email_accounts(user_id);

CREATE TABLE IF NOT EXISTS agente_ceo_emails (
    id              TEXT PRIMARY KEY DEFAULT 'em_' || substr(md5(random()::text), 1, 16),
    account_id      TEXT NOT NULL REFERENCES agente_ceo_email_accounts(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    message_id      TEXT NOT NULL,        -- RFC 822 Message-ID
    thread_id       TEXT,                 -- Conversation threading
    folder          TEXT NOT NULL DEFAULT 'INBOX',
    from_address    TEXT NOT NULL,
    from_name       TEXT,
    to_addresses    JSONB NOT NULL DEFAULT '[]',
    cc_addresses    JSONB DEFAULT '[]',
    subject         TEXT,
    body_text       TEXT,                 -- Plain text version
    body_html       TEXT,                 -- HTML version
    snippet         TEXT,                 -- First ~200 chars for preview
    has_attachments BOOLEAN DEFAULT false,
    attachments     JSONB DEFAULT '[]',   -- [{name, size, contentType}]
    labels          TEXT[] DEFAULT '{}',
    is_read         BOOLEAN DEFAULT false,
    is_starred      BOOLEAN DEFAULT false,
    is_draft        BOOLEAN DEFAULT false,
    sent_at         TIMESTAMPTZ,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- AI-generated fields
    ai_summary      TEXT,                 -- One-line AI summary
    ai_category     TEXT,                 -- client, vendor, internal, newsletter, etc.
    ai_sentiment    TEXT,                 -- positive, neutral, negative, urgent
    ai_action_items JSONB DEFAULT '[]',   -- Extracted action items
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_emails_user_folder ON agente_ceo_emails(user_id, folder, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON agente_ceo_emails(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_search ON agente_ceo_emails USING gin(to_tsvector('spanish', coalesce(subject,'') || ' ' || coalesce(body_text,'')));

-- ── Calendar / Meetings ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agente_ceo_calendar_events (
    id              TEXT PRIMARY KEY DEFAULT 'evt_' || substr(md5(random()::text), 1, 16),
    user_id         TEXT NOT NULL,
    external_id     TEXT,                 -- Cal.com booking ID or Google Calendar event ID
    source          TEXT DEFAULT 'manual' CHECK (source IN ('manual','calcom','google','outlook')),
    title           TEXT NOT NULL,
    description     TEXT,
    location        TEXT,                 -- Physical address or meeting URL
    meeting_url     TEXT,                 -- Jitsi/Zoom/Meet URL
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    all_day         BOOLEAN DEFAULT false,
    status          TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','tentative','cancelled')),
    attendees       JSONB DEFAULT '[]',   -- [{email, name, status}]
    reminders       JSONB DEFAULT '[]',   -- [{minutes_before, method}]
    recurrence      TEXT,                 -- RRULE string
    color           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_user_time ON agente_ceo_calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_external ON agente_ceo_calendar_events(external_id) WHERE external_id IS NOT NULL;

-- ── Meeting recordings & transcriptions ─────────────────────────────────

CREATE TABLE IF NOT EXISTS agente_ceo_meetings (
    id              TEXT PRIMARY KEY DEFAULT 'mtg_' || substr(md5(random()::text), 1, 16),
    user_id         TEXT NOT NULL,
    calendar_event_id TEXT REFERENCES agente_ceo_calendar_events(id),
    title           TEXT NOT NULL,
    platform        TEXT DEFAULT 'jitsi' CHECK (platform IN ('jitsi','zoom','meet','teams','phone')),
    room_id         TEXT,                 -- Jitsi room name or meeting ID
    meeting_url     TEXT,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_seconds INTEGER,
    participants    JSONB DEFAULT '[]',   -- [{name, email, joined_at, left_at}]
    -- Recording
    recording_url   TEXT,
    recording_size  BIGINT,
    -- Transcription
    transcript      TEXT,                 -- Full transcript
    transcript_segments JSONB DEFAULT '[]', -- [{speaker, text, start_s, end_s}]
    -- AI analysis
    ai_summary      TEXT,                 -- Meeting summary
    ai_action_items JSONB DEFAULT '[]',   -- [{task, assignee, deadline}]
    ai_decisions    JSONB DEFAULT '[]',   -- Key decisions made
    ai_topics       TEXT[] DEFAULT '{}',  -- Main topics discussed
    ai_sentiment    TEXT,
    status          TEXT DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','active','ended','transcribing','analyzed','failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_meetings_user ON agente_ceo_meetings(user_id, started_at DESC);

-- ── Documents / Files ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agente_ceo_documents (
    id              TEXT PRIMARY KEY DEFAULT 'doc_' || substr(md5(random()::text), 1, 16),
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    content_type    TEXT NOT NULL,         -- text/plain, application/pdf, etc.
    file_path       TEXT,                  -- Local filesystem path
    file_url        TEXT,                  -- URL if remote
    file_size       BIGINT,
    source          TEXT DEFAULT 'upload'  -- upload, email, meeting, scan
                    CHECK (source IN ('upload','email','meeting','scan','generated')),
    source_ref      TEXT,                  -- Reference to source (email_id, meeting_id, etc.)
    -- AI processing
    ai_summary      TEXT,
    ai_tags         TEXT[] DEFAULT '{}',
    extracted_text  TEXT,                  -- OCR or PDF text extraction
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON agente_ceo_documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_search ON agente_ceo_documents USING gin(to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(extracted_text,'')));

-- ── Contact book (unified across email, WhatsApp, calendar) ─────────────

CREATE TABLE IF NOT EXISTS agente_ceo_contacts (
    id              TEXT PRIMARY KEY DEFAULT 'ct_' || substr(md5(random()::text), 1, 16),
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    email           TEXT,
    phone           TEXT,
    whatsapp_jid    TEXT,
    company         TEXT,
    role            TEXT,
    notes           TEXT,
    tags            TEXT[] DEFAULT '{}',
    -- Linked records
    customer_id     TEXT,                  -- Link to business CRM customer
    -- Interaction stats
    last_email_at   TIMESTAMPTZ,
    last_meeting_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON agente_ceo_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON agente_ceo_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_search ON agente_ceo_contacts USING gin(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(company,'') || ' ' || coalesce(email,'')));
