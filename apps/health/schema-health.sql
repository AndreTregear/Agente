-- ============================================================================
-- Yaya Health — Core PostgreSQL Schema
-- WhatsApp-based health assistant for Peru
-- ============================================================================

-- 1. tenants
CREATE TABLE tenants (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    phone       text,
    created_at  timestamptz DEFAULT now(),
    active      boolean DEFAULT true
);

-- 2. patients
-- ENCRYPTED columns: full_name, phone, dni, address, emergency_contact
CREATE TABLE patients (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name         text NOT NULL,          -- ENCRYPTED
    phone             text NOT NULL,          -- ENCRYPTED
    dni               text,                   -- ENCRYPTED
    date_of_birth     date,
    sex               text CHECK (sex IN ('M', 'F')),
    address           text,                   -- ENCRYPTED
    emergency_contact text,                   -- ENCRYPTED
    created_at        timestamptz DEFAULT now()
);

-- 3. children
-- ENCRYPTED columns: full_name
CREATE TABLE children (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name       text NOT NULL,            -- ENCRYPTED
    date_of_birth   date NOT NULL,
    sex             text NOT NULL CHECK (sex IN ('M', 'F')),
    birth_weight_kg numeric(4,2),
    birth_height_cm numeric(5,1),
    blood_type      text,
    allergies       text,
    notes           text,
    created_at      timestamptz DEFAULT now()
);

-- 4. growth_measurements
CREATE TABLE growth_measurements (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id            uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    measured_at         timestamptz DEFAULT now(),
    weight_kg           numeric(5,2),
    height_cm           numeric(5,1),
    head_circ_cm        numeric(5,1),
    muac_cm             numeric(4,1),         -- mid-upper arm circumference
    weight_for_age_z    numeric(4,2),
    height_for_age_z    numeric(4,2),
    weight_for_height_z numeric(4,2),
    bmi_for_age_z       numeric(4,2),
    flags               text[],               -- e.g. {'stunting','wasting','underweight'}
    notes               text,
    recorded_by         text
);

-- 5. food_logs
CREATE TABLE food_logs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    child_id            uuid REFERENCES children(id) ON DELETE CASCADE,
    tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    logged_at           timestamptz DEFAULT now(),
    raw_description     text NOT NULL,        -- what the user typed in Spanish
    parsed_foods        jsonb,                -- [{food_name, amount_g, source}, ...]
    total_calories      numeric(7,1),
    total_protein_g     numeric(5,1),
    total_carbs_g       numeric(5,1),
    total_fat_g         numeric(5,1),
    total_iron_mg       numeric(5,2),
    total_zinc_mg       numeric(5,2),
    total_vitamin_a_mcg numeric(7,1),
    meal_type           text CHECK (meal_type IN ('desayuno','almuerzo','cena','merienda','otro'))
);

-- 6. health_readings
CREATE TABLE health_readings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    measured_at     timestamptz DEFAULT now(),
    reading_type    text NOT NULL CHECK (reading_type IN (
                        'blood_pressure','glucose','weight',
                        'temperature','heart_rate','oxygen_sat'
                    )),
    value_primary   numeric(6,1),             -- systolic BP, glucose mg/dL, weight kg, etc.
    value_secondary numeric(6,1),             -- diastolic BP; NULL for others
    unit            text NOT NULL,
    classification  text,                     -- e.g. 'normal','elevated','stage1_hypertension','hypoglycemia'
    fasting         boolean DEFAULT false,    -- relevant for glucose readings
    notes           text
);

-- 7. medications
CREATE TABLE medications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    medication_name text NOT NULL,
    dosage          text NOT NULL,
    frequency       text NOT NULL,            -- e.g. 'cada 8 horas', 'diario'
    route           text DEFAULT 'oral',
    start_date      date NOT NULL,
    end_date        date,
    active          boolean DEFAULT true,
    prescribed_by   text,
    notes           text,
    created_at      timestamptz DEFAULT now()
);

-- 8. reminders
CREATE TABLE reminders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    medication_id   uuid REFERENCES medications(id) ON DELETE CASCADE,
    reminder_type   text CHECK (reminder_type IN (
                        'medication','appointment','measurement','vaccination'
                    )),
    title           text NOT NULL,
    scheduled_at    timestamptz NOT NULL,
    recurrence_rule text,                     -- iCal RRULE or simple: 'daily','weekly'
    last_sent_at    timestamptz,
    active          boolean DEFAULT true,
    created_at      timestamptz DEFAULT now()
);

-- 9. conversations
CREATE TABLE conversations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    jid             text NOT NULL,            -- WhatsApp JID
    started_at      timestamptz DEFAULT now(),
    last_message_at timestamptz,
    context         jsonb DEFAULT '{}'
);

-- 10. message_log
CREATE TABLE message_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    direction       text CHECK (direction IN ('inbound','outbound')),
    content         text,
    media_type      text,
    media_url       text,
    tool_calls      jsonb,
    created_at      timestamptz DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- growth_measurements
CREATE INDEX idx_growth_child_date
    ON growth_measurements (child_id, measured_at DESC);

-- food_logs
CREATE INDEX idx_food_patient_date
    ON food_logs (patient_id, logged_at DESC);

CREATE INDEX idx_food_child_date
    ON food_logs (child_id, logged_at DESC);

-- health_readings
CREATE INDEX idx_readings_patient_type_date
    ON health_readings (patient_id, reading_type, measured_at DESC);

-- reminders (partial — only active)
CREATE INDEX idx_reminders_patient_scheduled
    ON reminders (patient_id, scheduled_at)
    WHERE active = true;

-- medications (partial — only active)
CREATE INDEX idx_medications_patient_active
    ON medications (patient_id)
    WHERE active = true;

-- conversations
CREATE INDEX idx_conversations_tenant_jid
    ON conversations (tenant_id, jid);

-- message_log
CREATE INDEX idx_messages_conversation_date
    ON message_log (conversation_id, created_at DESC);
