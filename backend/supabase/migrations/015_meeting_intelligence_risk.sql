-- Step 15: Meeting Intelligence, Risk Management & Task Follow-up System

-- Ensure UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Meetings Table
CREATE SEQUENCE IF NOT EXISTS meeting_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_meeting_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('meeting_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'MEET-' || year_str || '-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meeting_code VARCHAR(50) DEFAULT generate_next_meeting_code(),
    title VARCHAR(255) NOT NULL,
    meeting_date DATE,
    meeting_time TIME,
    timezone VARCHAR(50),
    meeting_type VARCHAR(50) DEFAULT 'INTERNAL',
    organizer_id UUID REFERENCES user_profiles(id),
    department_id UUID REFERENCES departments(id),
    status VARCHAR(50) DEFAULT 'SCHEDULED',
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    molecule_id UUID REFERENCES molecules(id) ON DELETE SET NULL,
    agenda TEXT,
    notes TEXT,
    decisions TEXT,
    analysis_status VARCHAR(50) DEFAULT 'NOT_STARTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safely add constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'meetings'::regclass AND conname = 'meetings_org_code_unique'
    ) THEN
        ALTER TABLE meetings ADD CONSTRAINT meetings_org_code_unique UNIQUE (organization_id, meeting_code);
    END IF;
END $$;

-- 2. Meeting Participants
CREATE TABLE IF NOT EXISTS meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'ATTENDEE',
    attendance_status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Meeting Action Candidates
CREATE TABLE IF NOT EXISTS meeting_action_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    source_note_text TEXT,
    source_position INT,
    candidate_type VARCHAR(50) DEFAULT 'ACTION',
    action_text TEXT NOT NULL,
    detected_date DATE,
    date_precision VARCHAR(50),
    detected_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    suggested_owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    confirmed_owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    confidence_score DECIMAL,
    confidence_level VARCHAR(20),
    status VARCHAR(50) DEFAULT 'ACTION_CANDIDATE',
    linked_task_id UUID,
    processing_version VARCHAR(50),
    model_provider VARCHAR(50),
    reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Risk Records
CREATE SEQUENCE IF NOT EXISTS risk_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_risk_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('risk_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'RISK-' || year_str || '-' || LPAD(next_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS risk_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    risk_code VARCHAR(50) DEFAULT generate_next_risk_code(),
    risk_title VARCHAR(255) NOT NULL,
    risk_category VARCHAR(50) DEFAULT 'GENERAL',
    risk_level VARCHAR(50) DEFAULT 'LOW',
    risk_score DECIMAL,
    calculation_method VARCHAR(50),
    source_type VARCHAR(50) DEFAULT 'MANUAL',
    source_evidence TEXT,
    meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
    task_id UUID,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'UNCONFIRMED',
    owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Risk Mitigations
CREATE TABLE IF NOT EXISTS risk_mitigations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risk_id UUID NOT NULL REFERENCES risk_records(id) ON DELETE CASCADE,
    mitigation_plan TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PLANNED',
    target_date DATE,
    completed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Task Dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_id UUID NOT NULL,
    depends_on_task_id UUID NOT NULL,
    dependency_type VARCHAR(50) DEFAULT 'BLOCKS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Modify Tasks Table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'LOW';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependency_risk VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS converted_from_candidate_id UUID REFERENCES meeting_action_candidates(id) ON DELETE SET NULL;

-- Link meeting_action_candidates and risk_records to tasks explicitly now
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'meeting_action_candidates'::regclass AND conname = 'fk_meeting_action_candidate_task'
    ) THEN
        ALTER TABLE meeting_action_candidates ADD CONSTRAINT fk_meeting_action_candidate_task FOREIGN KEY (linked_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'risk_records'::regclass AND conname = 'fk_risk_record_task'
    ) THEN
        ALTER TABLE risk_records ADD CONSTRAINT fk_risk_record_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'task_dependencies'::regclass AND conname = 'fk_task_dependency_task'
    ) THEN
        ALTER TABLE task_dependencies ADD CONSTRAINT fk_task_dependency_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'task_dependencies'::regclass AND conname = 'fk_task_dependency_depends_on'
    ) THEN
        ALTER TABLE task_dependencies ADD CONSTRAINT fk_task_dependency_depends_on FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 8. Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meeting_candidates_org_meet ON meeting_action_candidates(organization_id, meeting_id);
CREATE INDEX IF NOT EXISTS idx_risk_records_org_task ON risk_records(organization_id, task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_risk_level ON tasks(risk_level);

-- 9. Setup RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_mitigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- Meetings RLS
CREATE POLICY "meetings_org_isolation" ON meetings
    FOR ALL USING (organization_id = get_auth_user_organization_id());

CREATE POLICY "meeting_participants_org_isolation" ON meeting_participants
    FOR ALL USING (meeting_id IN (SELECT id FROM meetings WHERE organization_id = get_auth_user_organization_id()));

-- Meeting Action Candidates RLS
CREATE POLICY "meeting_action_candidates_org_isolation" ON meeting_action_candidates
    FOR ALL USING (organization_id = get_auth_user_organization_id());

-- Risk Records RLS
CREATE POLICY "risk_records_org_isolation" ON risk_records
    FOR ALL USING (organization_id = get_auth_user_organization_id());

-- Risk Mitigations RLS
CREATE POLICY "risk_mitigations_org_isolation" ON risk_mitigations
    FOR ALL USING (risk_id IN (SELECT id FROM risk_records WHERE organization_id = get_auth_user_organization_id()));

-- Task Dependencies RLS
CREATE POLICY "task_dependencies_org_isolation" ON task_dependencies
    FOR ALL USING (organization_id = get_auth_user_organization_id());
