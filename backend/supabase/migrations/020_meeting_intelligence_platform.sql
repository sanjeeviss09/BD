-- ============================================================================
-- Migration: 020_meeting_intelligence_platform.sql
-- Description: Step 20 Meeting Intelligence & Follow-up Management System
-- Safe, Idempotent, Additive, Tenant-Isolated Production-Grade Schema
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Sequences for Meeting Points & Decisions & Series
CREATE SEQUENCE IF NOT EXISTS meeting_series_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS meeting_point_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS meeting_decision_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_series_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('meeting_series_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'MSR-' || year_str || '-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_meeting_point_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('meeting_point_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'MPT-' || year_str || '-' || LPAD(next_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_meeting_decision_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('meeting_decision_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'MDEC-' || year_str || '-' || LPAD(next_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Meeting Series Table (Recurring Meetings)
CREATE TABLE IF NOT EXISTS public.meeting_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    series_code VARCHAR(50) DEFAULT generate_next_series_code(),
    title VARCHAR(255) NOT NULL,
    meeting_type VARCHAR(100) NOT NULL DEFAULT 'INTERNAL',
    recurrence_type VARCHAR(50) NOT NULL DEFAULT 'WEEKLY', -- DAILY, WEEKLY, BIWEEKLY, MONTHLY, CUSTOM
    recurrence_interval INT DEFAULT 1,
    days_of_week JSONB DEFAULT '[]'::jsonb, -- e.g. [1, 3] for Mon, Wed
    day_of_month INT,
    start_date DATE NOT NULL,
    end_date DATE,
    total_occurrences INT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safe unique constraint on series_code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.meeting_series'::regclass AND conname = 'meeting_series_org_code_unique'
    ) THEN
        ALTER TABLE public.meeting_series ADD CONSTRAINT meeting_series_org_code_unique UNIQUE (organization_id, series_code);
    END IF;
END $$;

-- 3. Safely Extend Meetings Table
-- Ensure compatibility customers table exists if referenced elsewhere
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    company_type VARCHAR(100) DEFAULT 'PHARMACEUTICAL',
    website VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS location_or_link TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS rfq_id UUID REFERENCES rfqs(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meeting_series_id UUID REFERENCES meeting_series(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS previous_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS expected_outcomes TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS external_organizations TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS reminder_preferences JSONB DEFAULT '{"upcoming_24h": true, "upcoming_1h": true, "upcoming_15m": true, "preparation_reminder": true, "closure_reminder": true}'::jsonb;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closure_status VARCHAR(50) DEFAULT 'OPEN';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closure_summary TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closure_data JSONB;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_text TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_approved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS preparation_notes TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 4. Live Mini Notes Table
CREATE TABLE IF NOT EXISTS public.meeting_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    speaker VARCHAR(255),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    agenda_item VARCHAR(255),
    note_type VARCHAR(50) DEFAULT 'NOTE', -- NOTE, DECISION_DRAFT, ACTION_DRAFT, RISK_DRAFT
    is_draft BOOLEAN DEFAULT FALSE,
    converted_to_type VARCHAR(50), -- POINT, DECISION, ACTION, RISK
    converted_to_id UUID,
    client_mutation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Structured Meeting Points Table
CREATE TABLE IF NOT EXISTS public.meeting_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    point_code VARCHAR(50) DEFAULT generate_next_meeting_point_code(),
    agenda_item VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'DISCUSSION',
    -- Categories: INFORMATION, DISCUSSION, DECISION, ACTION, RISK, DEPENDENCY, QUESTION, CUSTOMER_REQUIREMENT, FOLLOW_UP, PARKED
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    discussion_notes TEXT,
    decision_text TEXT,
    action_required BOOLEAN DEFAULT FALSE,
    responsible_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    responsible_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'OPEN',
    -- Statuses: OPEN, IN_DISCUSSION, DECIDED, ACTION_REQUIRED, CARRIED_FORWARD, RESOLVED, CANCELLED
    related_customer_id UUID,
    related_opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    related_rfq_id UUID REFERENCES rfqs(id) ON DELETE SET NULL,
    related_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    linked_risk_id UUID REFERENCES risk_records(id) ON DELETE SET NULL,
    source_note_id UUID REFERENCES meeting_notes(id) ON DELETE SET NULL,
    carried_forward_from_id UUID REFERENCES meeting_points(id) ON DELETE SET NULL,
    carry_forward_count INT DEFAULT 0,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safe unique constraint on point_code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.meeting_points'::regclass AND conname = 'meeting_points_org_code_unique'
    ) THEN
        ALTER TABLE public.meeting_points ADD CONSTRAINT meeting_points_org_code_unique UNIQUE (organization_id, point_code);
    END IF;
END $$;

-- Conditionally attach customer foreign keys if companies or customers exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_customer_id_fkey') THEN
            ALTER TABLE public.meetings ADD CONSTRAINT meetings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.companies(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_points_related_customer_id_fkey') THEN
            ALTER TABLE public.meeting_points ADD CONSTRAINT meeting_points_related_customer_id_fkey FOREIGN KEY (related_customer_id) REFERENCES public.companies(id) ON DELETE SET NULL;
        END IF;
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_customer_id_fkey') THEN
            ALTER TABLE public.meetings ADD CONSTRAINT meetings_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_points_related_customer_id_fkey') THEN
            ALTER TABLE public.meeting_points ADD CONSTRAINT meeting_points_related_customer_id_fkey FOREIGN KEY (related_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 6. Meeting Decisions Table
CREATE TABLE IF NOT EXISTS public.meeting_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    decision_code VARCHAR(50) DEFAULT generate_next_meeting_decision_code(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    decision_owner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    participants_summary TEXT,
    rationale TEXT,
    evidence TEXT,
    affected_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    affected_opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    affected_rfq_id UUID REFERENCES rfqs(id) ON DELETE SET NULL,
    impact VARCHAR(50) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    followup_required BOOLEAN DEFAULT FALSE,
    linked_point_id UUID REFERENCES meeting_points(id) ON DELETE SET NULL,
    linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    previous_decision_id UUID REFERENCES meeting_decisions(id) ON DELETE SET NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safe unique constraint on decision_code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.meeting_decisions'::regclass AND conname = 'meeting_decisions_org_code_unique'
    ) THEN
        ALTER TABLE public.meeting_decisions ADD CONSTRAINT meeting_decisions_org_code_unique UNIQUE (organization_id, decision_code);
    END IF;
END $$;

-- 7. Meeting Templates Table
CREATE TABLE IF NOT EXISTS public.meeting_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    meeting_type VARCHAR(100) NOT NULL,
    description TEXT,
    default_agenda JSONB DEFAULT '[]'::jsonb,
    default_categories JSONB DEFAULT '[]'::jsonb,
    default_duration_minutes INT DEFAULT 60,
    required_fields JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Meeting Configurations Table
CREATE TABLE IF NOT EXISTS public.meeting_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_name VARCHAR(255) NOT NULL,
    description TEXT,
    config_value JSONB NOT NULL,
    allowed_values JSONB,
    default_value JSONB,
    scope VARCHAR(50) DEFAULT 'ORGANIZATION',
    effective_date DATE DEFAULT CURRENT_DATE,
    is_enabled BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    updated_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.meeting_configurations'::regclass AND conname = 'meeting_configurations_org_key_unique'
    ) THEN
        ALTER TABLE public.meeting_configurations ADD CONSTRAINT meeting_configurations_org_key_unique UNIQUE (organization_id, config_key);
    END IF;
END $$;

-- 9. Meeting Configuration History / Audit
CREATE TABLE IF NOT EXISTS public.meeting_configuration_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    config_id UUID REFERENCES meeting_configurations(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    version INT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    change_reason TEXT,
    changed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Meeting Reminders Table
CREATE TABLE IF NOT EXISTS public.meeting_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    reminder_type VARCHAR(100) NOT NULL, -- UPCOMING_24H, UPCOMING_1H, UPCOMING_15M, PREPARATION_PENDING, CLOSURE_PENDING, ACTION_REVIEW
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, SENT, FAILED, CANCELLED
    delivery_channel VARCHAR(50) DEFAULT 'IN_APP', -- IN_APP, EMAIL, ALL
    recipient_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    deduplication_key VARCHAR(255) NOT NULL,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.meeting_reminders'::regclass AND conname = 'meeting_reminders_org_dedup_unique'
    ) THEN
        ALTER TABLE public.meeting_reminders ADD CONSTRAINT meeting_reminders_org_dedup_unique UNIQUE (organization_id, deduplication_key);
    END IF;
END $$;

-- 11. Extend Task Follow-ups to Link with Meeting Points
ALTER TABLE public.task_followups ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;
ALTER TABLE public.task_followups ADD COLUMN IF NOT EXISTS meeting_point_id UUID REFERENCES meeting_points(id) ON DELETE SET NULL;

-- 12. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_meeting_series_org ON public.meeting_series(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_series_id ON public.meetings(meeting_series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_customer_id ON public.meetings(customer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_rfq_id ON public.meetings(rfq_id);
CREATE INDEX IF NOT EXISTS idx_meetings_prev_id ON public.meetings(previous_meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date_status ON public.meetings(organization_id, meeting_date, status);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_meet ON public.meeting_notes(organization_id, meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_mutation ON public.meeting_notes(organization_id, client_mutation_id);
CREATE INDEX IF NOT EXISTS idx_meeting_points_meet ON public.meeting_points(organization_id, meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_points_status ON public.meeting_points(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meeting_points_task ON public.meeting_points(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_meeting_points_carried ON public.meeting_points(carried_forward_from_id);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meet ON public.meeting_decisions(organization_id, meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_templates_org ON public.meeting_templates(organization_id, meeting_type);
CREATE INDEX IF NOT EXISTS idx_meeting_config_org_key ON public.meeting_configurations(organization_id, config_key);
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_sched ON public.meeting_reminders(organization_id, scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_task_followups_meeting ON public.task_followups(meeting_id, meeting_point_id);

-- 13. Row Level Security Policies
ALTER TABLE public.meeting_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_configuration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "meeting_series_org_isolation" ON public.meeting_series;
    CREATE POLICY "meeting_series_org_isolation" ON public.meeting_series
        FOR ALL USING (organization_id = get_auth_user_organization_id());

    DROP POLICY IF EXISTS "meeting_notes_org_isolation" ON public.meeting_notes;
    CREATE POLICY "meeting_notes_org_isolation" ON public.meeting_notes
        FOR ALL USING (organization_id = get_auth_user_organization_id());

    DROP POLICY IF EXISTS "meeting_points_org_isolation" ON public.meeting_points;
    CREATE POLICY "meeting_points_org_isolation" ON public.meeting_points
        FOR ALL USING (organization_id = get_auth_user_organization_id());

    DROP POLICY IF EXISTS "meeting_decisions_org_isolation" ON public.meeting_decisions;
    CREATE POLICY "meeting_decisions_org_isolation" ON public.meeting_decisions
        FOR ALL USING (organization_id = get_auth_user_organization_id());

    DROP POLICY IF EXISTS "meeting_templates_org_isolation" ON public.meeting_templates;
    CREATE POLICY "meeting_templates_org_isolation" ON public.meeting_templates
        FOR ALL USING (organization_id = get_auth_user_organization_id());

    DROP POLICY IF EXISTS "meeting_configurations_org_isolation" ON public.meeting_configurations;
    CREATE POLICY "meeting_configurations_org_isolation" ON public.meeting_configurations
        FOR ALL USING (organization_id = get_auth_user_organization_id());

    DROP POLICY IF EXISTS "meeting_config_history_org_isolation" ON public.meeting_configuration_history;
    CREATE POLICY "meeting_config_history_org_isolation" ON public.meeting_configuration_history
        FOR ALL USING (organization_id = get_auth_user_organization_id());

    DROP POLICY IF EXISTS "meeting_reminders_org_isolation" ON public.meeting_reminders;
    CREATE POLICY "meeting_reminders_org_isolation" ON public.meeting_reminders
        FOR ALL USING (organization_id = get_auth_user_organization_id());
END $$;

-- 14. Seed RBAC Permissions
INSERT INTO permissions (code, name, description, category, resource, action)
VALUES
('meeting.view', 'View Meetings', 'Can view meetings, points, decisions and minutes', 'Meeting Intelligence', 'meeting', 'read'),
('meeting.create', 'Schedule Meetings', 'Can create and schedule meetings and series', 'Meeting Intelligence', 'meeting', 'create'),
('meeting.edit', 'Edit Meetings', 'Can update meeting details, dates and metadata', 'Meeting Intelligence', 'meeting', 'update'),
('meeting.start', 'Start Live Meeting', 'Can initiate live meeting mode and capture notes', 'Meeting Intelligence', 'meeting', 'update'),
('meeting.close', 'Close Meeting', 'Can execute meeting closure wizard and finalize', 'Meeting Intelligence', 'meeting', 'update'),
('meeting.manage_points', 'Manage Meeting Points', 'Can create, edit and carry forward meeting points', 'Meeting Intelligence', 'meeting', 'manage'),
('meeting.manage_decisions', 'Record Decisions', 'Can formally record and amend decisions', 'Meeting Intelligence', 'meeting', 'manage'),
('meeting.create_tasks', 'Create Tasks from Actions', 'Can convert meeting action items into tasks', 'Meeting Intelligence', 'meeting', 'create'),
('meeting.export', 'Export Meeting Minutes', 'Can export minutes to PDF, DOCX or Excel', 'Meeting Intelligence', 'meeting', 'export'),
('meeting.manage_templates', 'Manage Meeting Templates', 'Can configure agenda and meeting templates', 'Meeting Intelligence', 'meeting', 'manage'),
('meeting.manage_reminders', 'Configure Reminders', 'Can configure meeting reminder policies', 'Meeting Intelligence', 'meeting', 'manage'),
('meeting.manage_configuration', 'Manage Meeting Settings', 'Can manage central meeting & follow-up settings', 'Meeting Intelligence', 'meeting', 'manage'),
('meeting.view_audit', 'View Meeting Audit History', 'Can view meeting revision and decision history', 'Meeting Intelligence', 'meeting', 'read')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to standard administrative & BD roles
DO $$
DECLARE
    role_rec RECORD;
BEGIN
    FOR role_rec IN SELECT * FROM roles WHERE code IN ('SYS_ADMIN', 'ORG_ADMIN', 'BD_MANAGER', 'BD_USER')
    LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_rec.id, id FROM permissions WHERE category = 'Meeting Intelligence'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
END $$;

-- 15. Seed Default Configurations for Organizations
DO $$
DECLARE
    org_rec RECORD;
BEGIN
    FOR org_rec IN SELECT id FROM organizations
    LOOP
        -- Meeting Types Config
        INSERT INTO public.meeting_configurations (organization_id, config_key, config_name, description, config_value, default_value, scope)
        VALUES (
            org_rec.id,
            'meeting_types',
            'Configurable Meeting Types',
            'Organization-approved meeting types for categorization and templates',
            '["Customer Meeting", "Internal BD Meeting", "R&D Discussion", "Regulatory Discussion", "Production Review", "Supply Chain Review", "Commercial Discussion", "Project Review", "Management Review", "Vendor Meeting", "Other"]'::jsonb,
            '["Customer Meeting", "Internal BD Meeting", "R&D Discussion", "Regulatory Discussion", "Production Review", "Supply Chain Review", "Commercial Discussion", "Project Review", "Management Review", "Vendor Meeting", "Other"]'::jsonb,
            'ORGANIZATION'
        ) ON CONFLICT (organization_id, config_key) DO NOTHING;

        -- Reminder Offsets Config
        INSERT INTO public.meeting_configurations (organization_id, config_key, config_name, description, config_value, default_value, scope)
        VALUES (
            org_rec.id,
            'reminder_policies',
            'Meeting Reminder Offsets & Policies',
            'Configurable notification offsets and delivery channels for meeting lifecycle',
            '{"offsets_minutes": [1440, 60, 15], "enable_email": true, "enable_in_app": true, "prep_reminder_hours": 4, "closure_reminder_hours": 2}'::jsonb,
            '{"offsets_minutes": [1440, 60, 15], "enable_email": true, "enable_in_app": true, "prep_reminder_hours": 4, "closure_reminder_hours": 2}'::jsonb,
            'ORGANIZATION'
        ) ON CONFLICT (organization_id, config_key) DO NOTHING;

        -- Follow-up Policy Config
        INSERT INTO public.meeting_configurations (organization_id, config_key, config_name, description, config_value, default_value, scope)
        VALUES (
            org_rec.id,
            'followup_policies',
            'Meeting Action Follow-up Policies',
            'SLA rules, delay calculations, weekend rules and escalation thresholds',
            '{"default_interval_days": 2, "max_frequency_days": 1, "escalation_threshold_days": 3, "business_days_only": true, "calculate_from_original_due": true, "auto_no_update_after_days": 2}'::jsonb,
            '{"default_interval_days": 2, "max_frequency_days": 1, "escalation_threshold_days": 3, "business_days_only": true, "calculate_from_original_due": true, "auto_no_update_after_days": 2}'::jsonb,
            'ORGANIZATION'
        ) ON CONFLICT (organization_id, config_key) DO NOTHING;

        -- Carry-Forward Rules Config
        INSERT INTO public.meeting_configurations (organization_id, config_key, config_name, description, config_value, default_value, scope)
        VALUES (
            org_rec.id,
            'carry_forward_rules',
            'Previous Meeting Point Carry-Forward Rules',
            'Rules governing historical preservation and linkage when carrying forward points',
            '{"preserve_original_history": true, "preserve_original_due_date": true, "require_update_note": true, "max_carry_forwards_before_escalation": 3}'::jsonb,
            '{"preserve_original_history": true, "preserve_original_due_date": true, "require_update_note": true, "max_carry_forwards_before_escalation": 3}'::jsonb,
            'ORGANIZATION'
        ) ON CONFLICT (organization_id, config_key) DO NOTHING;

        -- Seed Default Meeting Templates
        INSERT INTO public.meeting_templates (organization_id, template_name, meeting_type, description, default_agenda, default_categories, default_duration_minutes)
        VALUES 
        (
            org_rec.id,
            'Internal Production Review Template',
            'Production Review',
            'Standard review for plant capacity, equipment availability, materials and timeline risks',
            '["Review of Previous Actions", "Plant Capacity & Utilization", "Equipment Status & Changeover", "Raw Material & Excipient Readiness", "Quality & Compliance Checks", "Milestones & Delivery Timelines", "Risks & Blockers", "Agreed Decisions & New Actions"]'::jsonb,
            '["DISCUSSION", "ACTION", "RISK", "DECISION", "DEPENDENCY"]'::jsonb,
            60
        ),
        (
            org_rec.id,
            'Customer Commercial & Technical Discussion',
            'Customer Meeting',
            'Standard agenda for pharmaceutical customer qualification and RFQ alignment',
            '["Customer Product Requirements", "Annual Volume & Batch Specifications", "Target Launch Markets & Regulatory Route", "Technical Feasibility Feedback", "Commercial Terms & Pricing Structure", "Commitments & Joint Next Steps"]'::jsonb,
            '["CUSTOMER_REQUIREMENT", "DISCUSSION", "DECISION", "ACTION", "FOLLOW_UP"]'::jsonb,
            45
        ),
        (
            org_rec.id,
            'Internal BD Strategy Review',
            'Internal BD Meeting',
            'Periodic pipeline, deal qualification, RFQ status and customer progress review',
            '["Pipeline Overview & Target Accounts", "High-Priority Opportunities", "RFQ Submission Deadlines", "Inter-departmental Dependencies", "Action Item Accountability Review"]'::jsonb,
            '["DISCUSSION", "DECISION", "ACTION", "DEPENDENCY"]'::jsonb,
            30
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

COMMIT;
