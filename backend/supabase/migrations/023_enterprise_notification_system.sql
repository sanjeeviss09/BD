-- ============================================================================
-- Migration: 023_enterprise_notification_system.sql
-- Description: BDIQ Enterprise Notification & Meeting Reminder Platform
-- Features:
--   1. Extend Canonical notifications Table with Category, Priority, Action URLs, and Dismissal
--   2. User Notification Preferences (In-App, Browser, Quiet Hours, Reminder Offsets)
--   3. Notification Delivery & Deduplication Audit Logs
--   4. RLS Policies and RBAC Permissions
-- Safe, Idempotent, Additive, Tenant-Isolated Production-Grade Migration
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Safely Extend Canonical notifications Table
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'MEDIUM';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'SYSTEM';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Constraints validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_priority_check'
    ) THEN
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_priority_check 
            CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_category_check'
    ) THEN
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check 
            CHECK (category IN ('MEETING', 'TASK', 'FOLLOWUP', 'OVERDUE', 'SYSTEM', 'COMMERCIAL', 'PRODUCTION'));
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(organization_id, recipient_id, read_at, dismissed_at);
CREATE INDEX IF NOT EXISTS idx_notifications_cat_pri ON public.notifications(organization_id, category, priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(recipient_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 2. User Notification Preferences Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    browser_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    meeting_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    meeting_offsets_minutes JSONB NOT NULL DEFAULT '[1440, 60, 15, 5, 0]'::jsonb, -- 24h, 1h, 15m, 5m, 0m (start)
    meeting_start_popup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    meeting_end_popup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    task_due_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    task_overdue_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '07:00:00',
    categories_filter JSONB NOT NULL DEFAULT '{"MEETING": true, "TASK": true, "FOLLOWUP": true, "OVERDUE": true, "SYSTEM": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_notification_preferences'::regclass AND conname = 'user_notification_prefs_unique'
    ) THEN
        ALTER TABLE public.user_notification_preferences ADD CONSTRAINT user_notification_prefs_unique UNIQUE (organization_id, user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user ON public.user_notification_preferences(organization_id, user_id);

-- ----------------------------------------------------------------------------
-- 3. Notification Delivery & Deduplication Audit Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('IN_APP', 'BROWSER', 'EMAIL', 'TOAST', 'POPUP')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('DELIVERED', 'FAILED', 'DISMISSED', 'SUPPRESSED_QUIET_HOURS', 'SUPPRESSED_IN_FOCUS')),
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deduplication_hash VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_delivery_org ON public.notification_delivery_logs(organization_id, recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_delivery_hash ON public.notification_delivery_logs(organization_id, deduplication_hash);

-- ----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- User Notification Preferences Isolation
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_notification_preferences' AND policyname = 'user_notif_prefs_isolation') THEN
        CREATE POLICY user_notif_prefs_isolation ON public.user_notification_preferences
            FOR ALL USING (organization_id = get_auth_user_organization_id())
            WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- Notification Delivery Logs Isolation
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_delivery_logs' AND policyname = 'notif_delivery_logs_isolation') THEN
        CREATE POLICY notif_delivery_logs_isolation ON public.notification_delivery_logs
            FOR ALL USING (organization_id = get_auth_user_organization_id())
            WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- Ensure Notifications policy allows users to see their own notifications or org notifications
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_user_isolation') THEN
        CREATE POLICY notifications_user_isolation ON public.notifications
            FOR ALL USING (organization_id = get_auth_user_organization_id() AND recipient_id = auth.uid())
            WITH CHECK (organization_id = get_auth_user_organization_id() AND recipient_id = auth.uid());
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Seed Required RBAC Permissions
-- ----------------------------------------------------------------------------
INSERT INTO public.permissions (code, name, module, description)
VALUES 
    ('notification.view', 'View Notifications', 'Notifications', 'View personal in-app and system alerts'),
    ('notification.manage', 'Manage Notifications', 'Notifications', 'Mark read, dismiss, and configure notification preferences'),
    ('notification.configure', 'Configure System Notifications', 'Notifications', 'Configure organization-wide reminder offsets and escalation intervals'),
    ('meeting.live_notes', 'Use Live Meeting Notes', 'Meetings', 'Access Live Meeting Notes split workspace with carried-forward points'),
    ('meeting.review_actions', 'Review Meeting Action Items', 'Meetings', 'Review and convert meeting actions into canonical BDIQ tasks')
ON CONFLICT (code) DO NOTHING;

COMMIT;
