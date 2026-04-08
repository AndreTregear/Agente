-- ============================================================================
-- Yaya Health — Row-Level Security Policies
-- Multi-tenant isolation via current_setting('app.tenant_id')
-- ============================================================================

-- tenants — can only see your own tenant row
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
    FOR ALL
    USING (id = current_setting('app.tenant_id')::uuid);

-- patients
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON patients
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- children
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON children
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- growth_measurements
ALTER TABLE growth_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON growth_measurements
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- food_logs
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON food_logs
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- health_readings
ALTER TABLE health_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON health_readings
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- medications
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON medications
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON reminders
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON conversations
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- message_log
ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON message_log
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
