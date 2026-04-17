-- Persistent task storage for the Mastra agent task engine.
-- Replaces the in-memory Map so tasks survive process restarts.

CREATE TABLE IF NOT EXISTS agente_ceo_tasks (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    description     TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('urgent','high','normal','low')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','running','completed','failed','cancelled')),
    agent           TEXT NOT NULL DEFAULT 'ceo-direct',
    template        TEXT,
    progress        TEXT,
    progress_history TEXT[] NOT NULL DEFAULT '{}',
    result          TEXT,
    error           TEXT,
    blocked_by      TEXT REFERENCES agente_ceo_tasks(id),
    child_of        TEXT REFERENCES agente_ceo_tasks(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    notified        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON agente_ceo_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON agente_ceo_tasks(status) WHERE status IN ('pending','running');
CREATE INDEX IF NOT EXISTS idx_tasks_created ON agente_ceo_tasks(user_id, created_at DESC);
