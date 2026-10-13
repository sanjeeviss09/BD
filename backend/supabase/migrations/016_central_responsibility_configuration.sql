-- Step 16: Central Responsibility Configuration and Settings System

-- 1. Ensure UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Sequence for responsibility rule codes
CREATE SEQUENCE IF NOT EXISTS responsibility_rule_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_resp_rule_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('responsibility_rule_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'RULE-' || year_str || '-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Responsibility Rules Table
CREATE TABLE IF NOT EXISTS responsibility_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_code VARCHAR(50) DEFAULT generate_next_resp_rule_code(),
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_id UUID REFERENCES business_units(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    task_type VARCHAR(100),
    business_area VARCHAR(100),
    product_type VARCHAR(100),
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    molecule_id UUID REFERENCES molecules(id) ON DELETE SET NULL,
    opportunity_type VARCHAR(100),
    responsible_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    primary_member_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    backup_member_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    escalation_manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    escalation_level2_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    escalation_level3_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    response_sla_days INT DEFAULT 2,
    completion_sla_days INT DEFAULT 7,
    followup_interval_days INT DEFAULT 2,
    escalation_delay_days INT DEFAULT 2,
    sla_calendar_type VARCHAR(50) DEFAULT 'BUSINESS_DAYS',
    assignment_mode VARCHAR(50) DEFAULT 'SUGGEST',
    priority_score INT DEFAULT 100,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    version INT DEFAULT 1,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraint for uniqueness of rule_code per organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'responsibility_rules'::regclass AND conname = 'responsibility_rules_org_code_unique'
    ) THEN
        ALTER TABLE responsibility_rules ADD CONSTRAINT responsibility_rules_org_code_unique UNIQUE (organization_id, rule_code);
    END IF;
END $$;

-- 4. Responsibility Rule History / Audit
CREATE TABLE IF NOT EXISTS responsibility_rule_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES responsibility_rules(id) ON DELETE CASCADE,
    version INT NOT NULL,
    changed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL,
    change_reason TEXT,
    previous_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Task Responsibility Overrides Audit Table
CREATE TABLE IF NOT EXISTS task_responsibility_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES responsibility_rules(id) ON DELETE SET NULL,
    suggested_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    suggested_member_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    assigned_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    assigned_member_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    override_reason TEXT NOT NULL,
    overridden_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Add responsibility fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS responsibility_rule_id UUID REFERENCES responsibility_rules(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_responsibility_overridden BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS suggested_department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS suggested_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_mode VARCHAR(50) DEFAULT 'SUGGEST';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS responsibility_explanation TEXT;

-- 7. Add permissions for Central Responsibility
INSERT INTO permissions (resource, action, code, name, category, description)
VALUES 
('responsibility', 'read', 'responsibility.read', 'View Responsibility Rules', 'Configuration', 'Can view task and update responsibility rules'),
('responsibility', 'manage', 'responsibility.manage', 'Manage Responsibility Rules', 'Configuration', 'Can create, edit, deactivate responsibility rules'),
('responsibility', 'override', 'responsibility.override', 'Override Responsibility', 'Tasks', 'Can override suggested responsibility for tasks'),
('responsibility', 'export', 'responsibility.export', 'Export Responsibility Rules', 'Configuration', 'Can export responsibility rules to Excel'),
('responsibility', 'import', 'responsibility.import', 'Import Responsibility Rules', 'Configuration', 'Can import responsibility rules from Excel')
ON CONFLICT (resource, action) DO UPDATE SET 
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;

-- 8. Indexes for performance and high-frequency rule matching
CREATE INDEX IF NOT EXISTS idx_resp_rules_org ON responsibility_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_resp_rules_lookup ON responsibility_rules(organization_id, status, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_resp_rules_scope ON responsibility_rules(organization_id, task_type, department_id, product_id);
CREATE INDEX IF NOT EXISTS idx_resp_history_rule ON responsibility_rule_history(organization_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_resp_overrides_task ON task_responsibility_overrides(organization_id, task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_resp_rule ON tasks(responsibility_rule_id);

-- 9. Row Level Security Policies
ALTER TABLE responsibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsibility_rule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_responsibility_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "responsibility_rules_org_isolation" ON responsibility_rules
    FOR ALL USING (organization_id = get_auth_user_organization_id());

CREATE POLICY "responsibility_rule_history_org_isolation" ON responsibility_rule_history
    FOR ALL USING (organization_id = get_auth_user_organization_id());

CREATE POLICY "task_responsibility_overrides_org_isolation" ON task_responsibility_overrides
    FOR ALL USING (organization_id = get_auth_user_organization_id());
