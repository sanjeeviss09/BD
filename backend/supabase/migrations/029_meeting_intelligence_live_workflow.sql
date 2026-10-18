-- ============================================================================
-- Migration: 029_meeting_intelligence_live_workflow.sql
-- Description: Additive, Idempotent, Production-Grade Meeting Live Assistant,
-- Lifecycle Governance, MOM Persistence, and Conferencing Integration Schema
-- ============================================================================

BEGIN;

-- 1. Safely extend meetings table with live session, MOM, and conferencing fields
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS location_or_link TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS rfq_id UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS meeting_series_id UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS previous_meeting_id UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS expected_outcomes TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS external_organizations TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS reminder_preferences JSONB DEFAULT '{"upcoming_24h": true, "upcoming_1h": true, "upcoming_15m": true, "preparation_reminder": true, "closure_reminder": true}'::jsonb;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closure_status VARCHAR(50) DEFAULT 'OPEN';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closure_summary TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closure_data JSONB;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_text TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS minutes_approved_by UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS preparation_notes TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Live Assistant & MOM Lifecycle Extensions
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS started_by UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'CUSTOM';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS conferencing_meeting_id VARCHAR(255);
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS recording_status VARCHAR(50) DEFAULT 'NOT_CONFIGURED';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(50) DEFAULT 'NOT_CONFIGURED';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS raw_transcript TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS mom_draft TEXT;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS mom_status VARCHAR(50) DEFAULT 'NOT_GENERATED';
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS mom_version INT DEFAULT 0;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS mom_confirmed_by UUID;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS mom_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS external_participants JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS live_agenda_state JSONB DEFAULT '[]'::jsonb;

-- 2. Ensure meeting_notes table exists
CREATE TABLE IF NOT EXISTS public.meeting_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID,
    content TEXT NOT NULL,
    speaker VARCHAR(255),
    department_id UUID,
    agenda_item VARCHAR(255),
    note_type VARCHAR(50) DEFAULT 'NOTE',
    is_draft BOOLEAN DEFAULT FALSE,
    converted_to_type VARCHAR(50),
    converted_to_id UUID,
    client_mutation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ensure meeting_points table exists
CREATE TABLE IF NOT EXISTS public.meeting_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    point_code VARCHAR(50),
    agenda_item VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'DISCUSSION',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    discussion_notes TEXT,
    decision_text TEXT,
    action_required BOOLEAN DEFAULT FALSE,
    responsible_department_id UUID,
    responsible_user_id UUID,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'OPEN',
    related_customer_id UUID,
    related_opportunity_id UUID,
    related_rfq_id UUID,
    related_product_id UUID,
    linked_task_id UUID,
    linked_risk_id UUID,
    source_note_id UUID,
    carried_forward_from_id UUID,
    carry_forward_count INT DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Ensure meeting_decisions table exists
CREATE TABLE IF NOT EXISTS public.meeting_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    decision_code VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    decision_owner_id UUID,
    participants_summary TEXT,
    rationale TEXT,
    evidence TEXT,
    affected_product_id UUID,
    affected_opportunity_id UUID,
    affected_rfq_id UUID,
    impact VARCHAR(50) DEFAULT 'MEDIUM',
    followup_required BOOLEAN DEFAULT FALSE,
    linked_point_id UUID,
    linked_task_id UUID,
    previous_decision_id UUID,
    is_confirmed BOOLEAN DEFAULT TRUE,
    confirmed_by UUID,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Safe Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_status_live ON public.meetings(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meetings_actual_start ON public.meetings(actual_start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_live ON public.meeting_notes(meeting_id, created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_points_linked_task ON public.meeting_points(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meet ON public.meeting_decisions(meeting_id);

-- 6. Row Level Security
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_decisions ENABLE ROW LEVEL SECURITY;

COMMIT;
