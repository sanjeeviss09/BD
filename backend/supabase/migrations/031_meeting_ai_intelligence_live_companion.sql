-- ============================================================================
-- Migration 031: Meeting AI Intelligence & Live Companion Support
-- Supports Phase 3 Meeting Intelligence: Grounded Summarisation, Suggestion-First
-- Action Item & Decision Extraction, and Real-Time Companion Assistant
-- ============================================================================

-- 1. Extend meeting_points for AI suggestions and confidence
ALTER TABLE public.meeting_points
  ADD COLUMN IF NOT EXISTS is_ai_suggested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_suggested_rationale TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_original_snippet TEXT DEFAULT NULL;

-- 2. Extend meeting_decisions for AI suggestions and confidence
ALTER TABLE public.meeting_decisions
  ADD COLUMN IF NOT EXISTS is_ai_suggested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_suggested_rationale TEXT DEFAULT NULL;

-- 3. Add companion preferences to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS companion_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_intelligence_cache JSONB DEFAULT NULL;

-- 4. Safe indexes
CREATE INDEX IF NOT EXISTS idx_meeting_points_ai_suggested ON public.meeting_points(meeting_id, is_ai_suggested);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_ai_suggested ON public.meeting_decisions(meeting_id, is_ai_suggested);

-- 5. Audit Comments
COMMENT ON COLUMN public.meeting_points.is_ai_suggested IS 'Indicates whether the action/point was extracted by Copilot AI and requires explicit user confirmation';
COMMENT ON COLUMN public.meeting_decisions.is_ai_suggested IS 'Indicates whether the decision was extracted by Copilot AI and requires explicit user confirmation';
