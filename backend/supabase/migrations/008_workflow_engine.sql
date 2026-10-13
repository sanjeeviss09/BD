-- Step 10: Operational Workflow Engine Migration (Idempotent, Re-runnable & Production-Safe)
-- BDIQ Pharmaceutical Business Development Intelligence & Qualification Platform
-- NOTE: Strictly Operational Workflow Engine (No Management Approval Engine)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Workflow Definitions (Reusable process template)
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    entity_type VARCHAR(50) NOT NULL DEFAULT 'OPPORTUNITY',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

-- 2. Workflow Versions (Immutable once in active use)
CREATE TABLE IF NOT EXISTS workflow_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, ACTIVE, RETIRED
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_immutable BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from TIMESTAMP WITH TIME ZONE,
    effective_to TIMESTAMP WITH TIME ZONE,
    validation_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, VALID, INVALID
    validation_errors JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_definition_id, version_number)
);

-- Add default_version_id to definitions if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workflow_definitions' AND column_name = 'default_version_id'
    ) THEN
        ALTER TABLE workflow_definitions ADD COLUMN default_version_id UUID REFERENCES workflow_versions(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Workflow Stages (Operational Stage Gate Definitions)
CREATE TABLE IF NOT EXISTS workflow_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
    stage_code VARCHAR(100) NOT NULL,
    stage_name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 1,
    stage_type VARCHAR(50) NOT NULL DEFAULT 'PROCESS', -- START, PROCESS, DECISION, TERMINAL
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    responsible_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    responsible_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    default_owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    default_probability INT DEFAULT 10 CHECK (default_probability >= 0 AND default_probability <= 100),
    sla_days INT DEFAULT 7,
    warning_days INT DEFAULT 2,
    color VARCHAR(50) DEFAULT '#06b6d4',
    icon VARCHAR(50) DEFAULT 'activity',
    entry_conditions JSONB DEFAULT '[]'::jsonb,
    completion_conditions JSONB DEFAULT '[]'::jsonb,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_version_id, stage_code)
);

-- 4. Workflow Transitions (Governed movement between operational stages)
CREATE TABLE IF NOT EXISTS workflow_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE CASCADE,
    transition_code VARCHAR(100) NOT NULL,
    transition_name VARCHAR(255) NOT NULL,
    from_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    to_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    required_permission VARCHAR(100) DEFAULT 'workflow.execute',
    requires_comment BOOLEAN NOT NULL DEFAULT FALSE,
    comment_prompt TEXT,
    conditions_json JSONB DEFAULT '[]'::jsonb,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_version_id, transition_code)
);

-- 5. Workflow Stage Required Tasks (Step 7 Task Integration)
CREATE TABLE IF NOT EXISTS workflow_stage_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    task_title VARCHAR(255) NOT NULL,
    task_category VARCHAR(100) NOT NULL DEFAULT 'EVALUATION',
    description TEXT,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    priority VARCHAR(50) DEFAULT 'HIGH',
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Workflow Instances (Active lifecycle attached to Opportunity)
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
    workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id) ON DELETE RESTRICT,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    current_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, PAUSED, TERMINATED
    stage_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    stage_due_at TIMESTAMP WITH TIME ZONE,
    sla_status VARCHAR(50) NOT NULL DEFAULT 'ON_TRACK', -- ON_TRACK, DUE_SOON, OVERDUE, COMPLETED
    assigned_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    version INT NOT NULL DEFAULT 1, -- Optimistic concurrency lock
    paused_at TIMESTAMP WITH TIME ZONE,
    pause_reason TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(opportunity_id)
);

-- 7. Workflow Stage History (Append-only immutable operational history)
CREATE TABLE IF NOT EXISTS workflow_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    from_stage_id UUID REFERENCES workflow_stages(id) ON DELETE SET NULL,
    to_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE RESTRICT,
    transition_id UUID REFERENCES workflow_transitions(id) ON DELETE SET NULL,
    transitioned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    transitioned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    stage_duration_seconds BIGINT DEFAULT 0,
    sla_status_at_transition VARCHAR(50) DEFAULT 'ON_TRACK',
    reason VARCHAR(255),
    comment TEXT,
    metadata_json JSONB DEFAULT '{}'::jsonb
);

-- 8. Add workflow_instance_id and workflow_stage_id to tasks table (Task Integration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'workflow_instance_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'workflow_stage_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN workflow_stage_id UUID REFERENCES workflow_stages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 9. Add workflow_instance_id to opportunities table (Dual reference safety)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opportunities' AND column_name = 'workflow_instance_id'
    ) THEN
        ALTER TABLE opportunities ADD COLUMN workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_def_org ON workflow_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_def_code ON workflow_definitions(code);
CREATE INDEX IF NOT EXISTS idx_workflow_vers_def ON workflow_versions(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_workflow_vers_org ON workflow_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_vers_status ON workflow_versions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_vers ON workflow_stages(workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_code ON workflow_stages(stage_code);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_order ON workflow_stages(sort_order);
CREATE INDEX IF NOT EXISTS idx_workflow_trans_vers ON workflow_transitions(workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_trans_from ON workflow_transitions(from_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_trans_to ON workflow_transitions(to_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_inst_opp ON workflow_instances(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_inst_stage ON workflow_instances(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_workflow_inst_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_inst_due ON workflow_instances(stage_due_at);
CREATE INDEX IF NOT EXISTS idx_workflow_inst_sla ON workflow_instances(sla_status);
CREATE INDEX IF NOT EXISTS idx_workflow_hist_inst ON workflow_stage_history(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_hist_opp ON workflow_stage_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_hist_time ON workflow_stage_history(transitioned_at);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_inst ON tasks(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_stage ON tasks(workflow_stage_id);

-- 11. Row-Level Security (RLS)
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stage_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_defs_tenant_policy ON workflow_definitions;
CREATE POLICY workflow_defs_tenant_policy ON workflow_definitions
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS workflow_vers_tenant_policy ON workflow_versions;
CREATE POLICY workflow_vers_tenant_policy ON workflow_versions
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS workflow_stages_tenant_policy ON workflow_stages;
CREATE POLICY workflow_stages_tenant_policy ON workflow_stages
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS workflow_transitions_tenant_policy ON workflow_transitions;
CREATE POLICY workflow_transitions_tenant_policy ON workflow_transitions
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS workflow_stage_tasks_tenant_policy ON workflow_stage_tasks;
CREATE POLICY workflow_stage_tasks_tenant_policy ON workflow_stage_tasks
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS workflow_instances_tenant_policy ON workflow_instances;
CREATE POLICY workflow_instances_tenant_policy ON workflow_instances
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS workflow_history_tenant_policy ON workflow_stage_history;
CREATE POLICY workflow_history_tenant_policy ON workflow_stage_history
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

-- 12. RBAC Permissions for Step 10 Workflow Engine
INSERT INTO permissions (resource, action, code, name, category, description) VALUES
('workflow', 'read', 'workflow.read', 'View Workflows', 'Workflow', 'Can view workflow definitions, stages, and active instances'),
('workflow', 'execute', 'workflow.execute', 'Execute Transitions', 'Workflow', 'Can advance or transition opportunities between operational stages'),
('workflow', 'assign', 'workflow.assign', 'Assign Stage Owners', 'Workflow', 'Can assign or reassign responsible users for workflow stages'),
('workflow', 'history', 'workflow.history', 'View Stage History', 'Workflow', 'Can view immutable workflow transition history and timelines'),
('workflow', 'analytics', 'workflow.analytics', 'Workflow Analytics', 'Workflow', 'Can view workflow SLA, cycle time, and bottleneck analytics'),
('workflow', 'manage', 'workflow.manage', 'Manage Workflows', 'Workflow', 'Can create and configure workflow stages, transitions, and SLAs'),
('workflow', 'admin', 'workflow.admin', 'Administer Workflow Engine', 'Workflow', 'Full administrative authority over workflow definitions and versions')
ON CONFLICT (resource, action) DO UPDATE SET
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;

-- Grant workflow permissions to Super Administrator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN' AND p.resource = 'workflow'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 13. Seed Standard Operational BD Workflow for BDIQ-HQ
DO $$
DECLARE
    org_rec RECORD;
    def_id UUID;
    ver_id UUID;
    st_created UUID;
    st_qual UUID;
    st_mkt UUID;
    st_tech UUID;
    st_reg UUID;
    st_prod UUID;
    st_comm UUID;
    st_rfq UUID;
    st_dec UUID;
    st_won UUID;
    st_lost UUID;
    st_hold UUID;
BEGIN
    FOR org_rec IN SELECT id FROM organizations LOOP
        -- 13.1 Create or get definition
        INSERT INTO workflow_definitions (id, organization_id, code, name, description, entity_type, is_active)
        VALUES (
            uuid_generate_v4(),
            org_rec.id,
            'PHARMA_BD_CORE',
            'Pharmaceutical BD Operational Stage Gate',
            'Standard 10-stage operational commercial and technical progression workflow for pharma product evaluations.',
            'OPPORTUNITY',
            TRUE
        )
        ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO def_id;

        IF def_id IS NULL THEN
            SELECT id INTO def_id FROM workflow_definitions WHERE organization_id = org_rec.id AND code = 'PHARMA_BD_CORE';
        END IF;

        -- 13.2 Create or get Version 1
        INSERT INTO workflow_versions (id, organization_id, workflow_definition_id, version_number, name, description, status, is_default, is_immutable, validation_status)
        VALUES (
            uuid_generate_v4(),
            org_rec.id,
            def_id,
            1,
            'Standard Commercial & Technical Progression v1.0',
            'Production standard pharmaceutical BD pipeline gate architecture.',
            'ACTIVE',
            TRUE,
            TRUE,
            'VALID'
        )
        ON CONFLICT (workflow_definition_id, version_number) DO UPDATE SET status = 'ACTIVE', is_default = TRUE
        RETURNING id INTO ver_id;

        IF ver_id IS NULL THEN
            SELECT id INTO ver_id FROM workflow_versions WHERE workflow_definition_id = def_id AND version_number = 1;
        END IF;

        UPDATE workflow_definitions SET default_version_id = ver_id WHERE id = def_id;

        -- 13.3 Seed Stages (10 operational stages + 3 terminal/decision outcomes)
        -- Stage 1: OPPORTUNITY_CREATED
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'OPPORTUNITY_CREATED', 'Opportunity Created', 'Opportunity intake, preliminary thesis, and commercial scope identified', 1, 'START', 10, 3, 1, '#38bdf8', 'sparkles')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_created;
        IF st_created IS NULL THEN SELECT id INTO st_created FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'OPPORTUNITY_CREATED'; END IF;

        -- Stage 2: QUALIFICATION
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'QUALIFICATION', 'Qualification', 'Multi-parameter strategic, commercial, and capability qualification scoring', 2, 'PROCESS', 25, 7, 2, '#06b6d4', 'check-square')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_qual;
        IF st_qual IS NULL THEN SELECT id INTO st_qual FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'QUALIFICATION'; END IF;

        -- Stage 3: MARKET_INTELLIGENCE
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'MARKET_INTELLIGENCE', 'Market Intelligence', 'Addressable market size, volume trends, competitive landscape, and pricing benchmark', 3, 'PROCESS', 35, 10, 2, '#0284c7', 'globe')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_mkt;
        IF st_mkt IS NULL THEN SELECT id INTO st_mkt FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'MARKET_INTELLIGENCE'; END IF;

        -- Stage 4: TECHNICAL_EVALUATION
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'TECHNICAL_EVALUATION', 'Technical Evaluation', 'API source, formulation feasibility, batch size, and analytical specifications', 4, 'PROCESS', 50, 14, 3, '#6366f1', 'flask-conical')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_tech;
        IF st_tech IS NULL THEN SELECT id INTO st_tech FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'TECHNICAL_EVALUATION'; END IF;

        -- Stage 5: REGULATORY_EVALUATION
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'REGULATORY_EVALUATION', 'Regulatory Evaluation', 'Filing pathway (ANDA/NDA/505b2/Dossier), patent exclusivity, bioequivalence', 5, 'PROCESS', 60, 14, 3, '#8b5cf6', 'file-badge')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_reg;
        IF st_reg IS NULL THEN SELECT id INTO st_reg FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'REGULATORY_EVALUATION'; END IF;

        -- Stage 6: PRODUCTION_FEASIBILITY
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'PRODUCTION_FEASIBILITY', 'Production Feasibility', 'Manufacturing site selection, GMP capacity, tooling, and lead time assessment', 6, 'PROCESS', 65, 14, 3, '#ec4899', 'factory')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_prod;
        IF st_prod IS NULL THEN SELECT id INTO st_prod FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'PRODUCTION_FEASIBILITY'; END IF;

        -- Stage 7: COMMERCIAL_EVALUATION
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'COMMERCIAL_EVALUATION', 'Commercial Evaluation', 'Cost of goods sold (COGS), margin modeling, gross profit, and multi-year DCF', 7, 'PROCESS', 75, 10, 2, '#10b981', 'dollar-sign')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_comm;
        IF st_comm IS NULL THEN SELECT id INTO st_comm FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'COMMERCIAL_EVALUATION'; END IF;

        -- Stage 8: RFQ_CUSTOMER_ENGAGEMENT
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'RFQ_CUSTOMER_ENGAGEMENT', 'RFQ / Customer Engagement', 'Issuing commercial quotation, binding offer terms, supply schedule proposal', 8, 'PROCESS', 85, 14, 3, '#f59e0b', 'file-text')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_rfq;
        IF st_rfq IS NULL THEN SELECT id INTO st_rfq FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'RFQ_CUSTOMER_ENGAGEMENT'; END IF;

        -- Stage 9: OPPORTUNITY_DECISION
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'OPPORTUNITY_DECISION', 'Opportunity Decision', 'Final commercial and partner decision checkpoint for deal execution', 9, 'DECISION', 90, 7, 2, '#f97316', 'git-commit')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_dec;
        IF st_dec IS NULL THEN SELECT id INTO st_dec FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'OPPORTUNITY_DECISION'; END IF;

        -- Stage 10: WON
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'WON', 'Won / Contracted', 'Commercial supply agreement executed, development greenlit', 10, 'TERMINAL', 100, 0, 0, '#22c55e', 'award')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_won;
        IF st_won IS NULL THEN SELECT id INTO st_won FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'WON'; END IF;

        -- Stage 11: LOST
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'LOST', 'Lost / Closed', 'Opportunity disqualified, terms unviable, or customer selected alternative', 11, 'TERMINAL', 0, 0, 0, '#ef4444', 'x-circle')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_lost;
        IF st_lost IS NULL THEN SELECT id INTO st_lost FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'LOST'; END IF;

        -- Stage 12: ON_HOLD
        INSERT INTO workflow_stages (id, organization_id, workflow_version_id, stage_code, stage_name, description, sort_order, stage_type, default_probability, sla_days, warning_days, color, icon)
        VALUES (uuid_generate_v4(), org_rec.id, ver_id, 'ON_HOLD', 'On Hold', 'Temporarily paused due to patent litigation, customer postponement, or supply constraint', 12, 'TERMINAL', 10, 30, 5, '#eab308', 'pause-circle')
        ON CONFLICT (workflow_version_id, stage_code) DO NOTHING RETURNING id INTO st_hold;
        IF st_hold IS NULL THEN SELECT id INTO st_hold FROM workflow_stages WHERE workflow_version_id = ver_id AND stage_code = 'ON_HOLD'; END IF;

        -- 13.4 Seed Transitions
        -- Sequential forward progression
        INSERT INTO workflow_transitions (organization_id, workflow_version_id, transition_code, transition_name, from_stage_id, to_stage_id, requires_comment, sort_order)
        VALUES
        (org_rec.id, ver_id, 'T_START_QUAL', 'Advance to Qualification', st_created, st_qual, FALSE, 1),
        (org_rec.id, ver_id, 'T_QUAL_MKT', 'Advance to Market Intelligence', st_qual, st_mkt, FALSE, 2),
        (org_rec.id, ver_id, 'T_MKT_TECH', 'Advance to Technical Evaluation', st_mkt, st_tech, FALSE, 3),
        (org_rec.id, ver_id, 'T_TECH_REG', 'Advance to Regulatory Evaluation', st_tech, st_reg, FALSE, 4),
        (org_rec.id, ver_id, 'T_REG_PROD', 'Advance to Production Feasibility', st_reg, st_prod, FALSE, 5),
        (org_rec.id, ver_id, 'T_PROD_COMM', 'Advance to Commercial Evaluation', st_prod, st_comm, FALSE, 6),
        (org_rec.id, ver_id, 'T_COMM_RFQ', 'Advance to RFQ / Customer Engagement', st_comm, st_rfq, FALSE, 7),
        (org_rec.id, ver_id, 'T_RFQ_DEC', 'Submit to Opportunity Decision', st_rfq, st_dec, FALSE, 8),
        (org_rec.id, ver_id, 'T_DEC_WON', 'Mark as Won / Execute Agreement', st_dec, st_won, TRUE, 9),
        (org_rec.id, ver_id, 'T_DEC_LOST', 'Mark as Lost', st_dec, st_lost, TRUE, 10),
        (org_rec.id, ver_id, 'T_DEC_HOLD', 'Place On Hold', st_dec, st_hold, TRUE, 11),
        -- Exits to LOST from operational stages (with mandatory comment)
        (org_rec.id, ver_id, 'T_QUAL_LOST', 'Disqualify Opportunity (Lost)', st_qual, st_lost, TRUE, 12),
        (org_rec.id, ver_id, 'T_TECH_LOST', 'Technical Infeasibility (Lost)', st_tech, st_lost, TRUE, 13),
        (org_rec.id, ver_id, 'T_REG_LOST', 'Regulatory Barrier (Lost)', st_reg, st_lost, TRUE, 14),
        (org_rec.id, ver_id, 'T_COMM_LOST', 'Commercial Infeasibility (Lost)', st_comm, st_lost, TRUE, 15),
        (org_rec.id, ver_id, 'T_RFQ_LOST', 'Customer Declined RFQ (Lost)', st_rfq, st_lost, TRUE, 16),
        -- Exits to ON_HOLD from active stages
        (org_rec.id, ver_id, 'T_COMM_HOLD', 'Pause Commercial Evaluation (On Hold)', st_comm, st_hold, TRUE, 17),
        (org_rec.id, ver_id, 'T_TECH_HOLD', 'Pause Technical Evaluation (On Hold)', st_tech, st_hold, TRUE, 18),
        -- Reopen from ON_HOLD back to Decision or Qualification
        (org_rec.id, ver_id, 'T_HOLD_RESUME', 'Resume from On Hold to Qualification', st_hold, st_qual, TRUE, 19),
        (org_rec.id, ver_id, 'T_HOLD_DEC', 'Resume from On Hold to Decision', st_hold, st_dec, TRUE, 20)
        ON CONFLICT (workflow_version_id, transition_code) DO NOTHING;

    END LOOP;
END $$;
