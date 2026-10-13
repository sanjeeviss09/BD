-- Step 7: Task Management Module (Idempotent, Re-runnable & Production-Safe Migration)

-- 0. Ensure UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Helper function for Organization-level RLS isolation
CREATE OR REPLACE FUNCTION get_auth_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id 
  FROM public.user_profiles 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Concurrency-safe sequence for task codes
CREATE SEQUENCE IF NOT EXISTS task_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_task_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('task_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'TASK-' || year_str || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Tasks Table: Create if not exists, and safely alter existing table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_code VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    task_category VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    source_type VARCHAR(50),
    source_entity_type VARCHAR(50),
    source_entity_id UUID,
    product_id UUID,
    opportunity_id UUID,
    assigned_user_id UUID REFERENCES user_profiles(id),
    assigned_department_id UUID,
    assigned_team_id UUID,
    created_by UUID REFERENCES user_profiles(id),
    original_due_date DATE,
    current_due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES user_profiles(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    hold_reason TEXT,
    hold_at TIMESTAMP WITH TIME ZONE,
    resumed_at TIMESTAMP WITH TIME ZONE,
    total_hold_duration_days INT DEFAULT 0,
    sla_config_id UUID,
    version INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safely add missing columns to tasks if table pre-existed
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_code VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_category VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_entity_type VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_entity_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS opportunity_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES user_profiles(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_department_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_team_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS original_due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES user_profiles(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hold_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS total_hold_duration_days INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_config_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Safe column backfills for tasks if pre-existing columns existed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_to') THEN
        UPDATE tasks SET assigned_user_id = assigned_to WHERE assigned_user_id IS NULL AND assigned_to IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date') THEN
        UPDATE tasks SET original_due_date = due_date::DATE WHERE original_due_date IS NULL AND due_date IS NOT NULL;
        UPDATE tasks SET current_due_date = due_date::DATE WHERE current_due_date IS NULL AND due_date IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'completed_date') THEN
        UPDATE tasks SET completed_at = completed_date WHERE completed_at IS NULL AND completed_date IS NOT NULL;
    END IF;

    UPDATE tasks SET task_code = generate_next_task_code() WHERE task_code IS NULL;
END $$;

ALTER TABLE tasks ALTER COLUMN task_code SET DEFAULT generate_next_task_code();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'tasks'::regclass AND conname IN ('tasks_organization_id_task_code_key', 'tasks_org_code_unique')
    ) THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_org_code_unique UNIQUE (organization_id, task_code);
    END IF;
END $$;

-- 4. Task Followups Table
CREATE TABLE IF NOT EXISTS task_followups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    followup_number INT NOT NULL,
    followup_date DATE NOT NULL,
    expected_response_date DATE,
    response_status VARCHAR(50) NOT NULL DEFAULT 'NO_UPDATE',
    response_received BOOLEAN DEFAULT FALSE,
    response_received_date DATE,
    response_summary TEXT,
    next_followup_date DATE,
    followup_method VARCHAR(50),
    contacted_person VARCHAR(255),
    contacted_user_id UUID REFERENCES user_profiles(id),
    remarks TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS expected_response_date DATE;
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS response_status VARCHAR(50);
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS response_received BOOLEAN DEFAULT FALSE;
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS response_received_date DATE;
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS response_summary TEXT;
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS next_followup_date DATE;
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS followup_method VARCHAR(50);
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS contacted_person VARCHAR(255);
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS contacted_user_id UUID REFERENCES user_profiles(id);
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DO $$
BEGIN
    UPDATE task_followups tf
    SET organization_id = t.organization_id
    FROM tasks t
    WHERE tf.task_id = t.id AND tf.organization_id IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_followups' AND column_name = 'status') THEN
        UPDATE task_followups SET response_status = status WHERE response_status IS NULL AND status IS NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_followups' AND column_name = 'response_date') THEN
        UPDATE task_followups SET response_received_date = response_date::DATE WHERE response_received_date IS NULL AND response_date IS NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'task_followups'::regclass AND conname IN ('task_followups_task_id_followup_number_key', 'task_followups_task_num_unique')
    ) THEN
        ALTER TABLE task_followups ADD CONSTRAINT task_followups_task_num_unique UNIQUE (task_id, followup_number);
    END IF;
END $$;

-- 5. Task Reschedules Table (Historical expected date adjustments)
CREATE TABLE IF NOT EXISTS task_reschedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    previous_due_date DATE NOT NULL,
    requested_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'APPROVED',
    requested_by UUID REFERENCES user_profiles(id),
    approved_by UUID REFERENCES user_profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE task_reschedules ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES user_profiles(id);
ALTER TABLE task_reschedules ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 6. Task Comments Table
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    parent_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Task Watchers / Observers Extension
CREATE TABLE IF NOT EXISTS task_watchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, user_id)
);

-- 8. Task Timeline / Immutable History Table
CREATE TABLE IF NOT EXISTS task_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    actor_id UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Safe Idempotent Indexes (CREATE INDEX IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_original_due_date ON tasks(original_due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_current_due_date ON tasks(current_due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_opportunity ON tasks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source_entity ON tasks(source_entity_type, source_entity_id);

CREATE INDEX IF NOT EXISTS idx_task_followups_task ON task_followups(task_id);
CREATE INDEX IF NOT EXISTS idx_task_followups_org ON task_followups(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_followups_next_date ON task_followups(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_task_followups_response_status ON task_followups(response_status);

CREATE INDEX IF NOT EXISTS idx_task_reschedules_task ON task_reschedules(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_task ON task_watchers(task_id);
CREATE INDEX IF NOT EXISTS idx_task_watchers_user ON task_watchers(user_id);

CREATE INDEX IF NOT EXISTS idx_task_timeline_task ON task_timeline(task_id);
CREATE INDEX IF NOT EXISTS idx_task_timeline_org ON task_timeline(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_timeline_created_at ON task_timeline(created_at);
CREATE INDEX IF NOT EXISTS idx_task_timeline_event_type ON task_timeline(event_type);

-- 10. Seed Task Permissions
INSERT INTO permissions (resource, action, code, name, category, description) VALUES 
('tasks', 'read', 'tasks.read', 'View Tasks', 'Tasks', 'Can view tasks'),
('tasks', 'create', 'tasks.create', 'Create Tasks', 'Tasks', 'Can create tasks'),
('tasks', 'update', 'tasks.update', 'Update Tasks', 'Tasks', 'Can update task details'),
('tasks', 'assign', 'tasks.assign', 'Assign Tasks', 'Tasks', 'Can reassign tasks to other users'),
('tasks', 'followup', 'tasks.followup', 'Record Followups', 'Tasks', 'Can record no-update and followups'),
('tasks', 'complete', 'tasks.complete', 'Complete Tasks', 'Tasks', 'Can complete tasks'),
('tasks', 'cancel', 'tasks.cancel', 'Cancel Tasks', 'Tasks', 'Can cancel tasks'),
('tasks', 'reschedule', 'tasks.reschedule', 'Reschedule Tasks', 'Tasks', 'Can reschedule task due dates'),
('tasks', 'export', 'tasks.export', 'Export Tasks', 'Tasks', 'Can export tasks'),
('tasks', 'analytics', 'tasks.analytics', 'Task Analytics', 'Tasks', 'Can view task management analytics'),
('tasks', 'admin', 'tasks.admin', 'Manage All Tasks', 'Tasks', 'Full admin rights over tasks')
ON CONFLICT (resource, action) DO UPDATE SET 
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;

DO $$
BEGIN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.code = 'SUPER_ADMIN' AND p.resource = 'tasks'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;

-- 11. Configuration Engine Seed for Tasks (Configurable types, statuses, priorities)
DO $$
DECLARE
    task_group_id UUID;
    type_def_id UUID;
    status_def_id UUID;
    priority_def_id UUID;
    resp_def_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'configuration_groups') THEN
        INSERT INTO configuration_groups (id, name, key, description, category, scope)
        VALUES ('d0000000-0000-0000-0000-000000000001', 'Task Management Config', 'TASK_CONFIG', 'Configurable options for enterprise tasks', 'Workflow', 'ORGANIZATION')
        ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO task_group_id;

        IF task_group_id IS NULL THEN
            SELECT id INTO task_group_id FROM configuration_groups WHERE key = 'TASK_CONFIG' LIMIT 1;
        END IF;

        -- Task Types Definition
        INSERT INTO configuration_definitions (id, group_id, key, label, description, data_type, is_system, sort_order)
        VALUES ('d0000000-0000-0000-0000-000000000002', task_group_id, 'TASK_TYPES', 'Task Types', 'Operational types of tasks', 'select', TRUE, 1)
        ON CONFLICT (group_id, key) DO UPDATE SET label = EXCLUDED.label
        RETURNING id INTO type_def_id;

        IF type_def_id IS NULL THEN
            SELECT id INTO type_def_id FROM configuration_definitions WHERE group_id = task_group_id AND key = 'TASK_TYPES' LIMIT 1;
        END IF;

        -- Default System Task Types
        INSERT INTO configuration_options (definition_id, key, label, sort_order, is_system) VALUES
        (type_def_id, 'INFORMATION_REQUEST', 'Information Request', 1, TRUE),
        (type_def_id, 'TECHNICAL_FEASIBILITY', 'Technical Feasibility', 2, TRUE),
        (type_def_id, 'REGULATORY_ASSESSMENT', 'Regulatory Assessment', 3, TRUE),
        (type_def_id, 'MARKET_RESEARCH', 'Market Research', 4, TRUE),
        (type_def_id, 'COMMERCIAL_REQUEST', 'Commercial Request', 5, TRUE),
        (type_def_id, 'CUSTOMER_FOLLOWUP', 'Customer Follow-up', 6, TRUE),
        (type_def_id, 'RFQ_FOLLOWUP', 'RFQ Follow-up', 7, TRUE),
        (type_def_id, 'DOCUMENT_REQUEST', 'Document Request', 8, TRUE),
        (type_def_id, 'MANAGEMENT_ACTION', 'Management Action', 9, TRUE),
        (type_def_id, 'INTERNAL_REVIEW', 'Internal Review', 10, TRUE),
        (type_def_id, 'APPROVAL', 'Approval', 11, TRUE),
        (type_def_id, 'GENERAL', 'General Task', 12, TRUE)
        ON CONFLICT (definition_id, organization_id, key) DO NOTHING;
    END IF;
END $$;

-- 12. Row Level Security (RLS) Policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reschedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_timeline ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- tasks policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_org_select') THEN
        CREATE POLICY tasks_org_select ON tasks FOR SELECT USING (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_org_insert') THEN
        CREATE POLICY tasks_org_insert ON tasks FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_org_update') THEN
        CREATE POLICY tasks_org_update ON tasks FOR UPDATE USING (organization_id = get_auth_user_organization_id()) WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_org_delete') THEN
        CREATE POLICY tasks_org_delete ON tasks FOR DELETE USING (organization_id = get_auth_user_organization_id());
    END IF;

    -- task_followups policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_followups' AND policyname = 'task_followups_org_select') THEN
        CREATE POLICY task_followups_org_select ON task_followups FOR SELECT USING (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_followups' AND policyname = 'task_followups_org_insert') THEN
        CREATE POLICY task_followups_org_insert ON task_followups FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_followups' AND policyname = 'task_followups_org_update') THEN
        CREATE POLICY task_followups_org_update ON task_followups FOR UPDATE USING (organization_id = get_auth_user_organization_id()) WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- task_reschedules policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_reschedules' AND policyname = 'task_reschedules_org_select') THEN
        CREATE POLICY task_reschedules_org_select ON task_reschedules FOR SELECT USING (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_reschedules' AND policyname = 'task_reschedules_org_insert') THEN
        CREATE POLICY task_reschedules_org_insert ON task_reschedules FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- task_comments policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_comments' AND policyname = 'task_comments_org_select') THEN
        CREATE POLICY task_comments_org_select ON task_comments FOR SELECT USING (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_comments' AND policyname = 'task_comments_org_insert') THEN
        CREATE POLICY task_comments_org_insert ON task_comments FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- task_watchers policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_watchers' AND policyname = 'task_watchers_org_select') THEN
        CREATE POLICY task_watchers_org_select ON task_watchers FOR SELECT USING (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_watchers' AND policyname = 'task_watchers_org_insert') THEN
        CREATE POLICY task_watchers_org_insert ON task_watchers FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- task_timeline (IMMUTABLE history: SELECT and INSERT only)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_timeline' AND policyname = 'task_timeline_org_select') THEN
        CREATE POLICY task_timeline_org_select ON task_timeline FOR SELECT USING (organization_id = get_auth_user_organization_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_timeline' AND policyname = 'task_timeline_org_insert') THEN
        CREATE POLICY task_timeline_org_insert ON task_timeline FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;
END $$;
