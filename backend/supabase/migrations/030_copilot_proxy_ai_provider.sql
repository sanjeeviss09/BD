-- ============================================================================
-- Migration: 030_copilot_proxy_ai_provider.sql
-- Description: GitHub Copilot API Proxy Integration as Configurable AI Provider
-- Safety: Additive, Backward-Compatible, RLS-Enforced, Idempotent
-- ============================================================================

-- 1. Extend AI Provider Configurations Table to support COPILOT_PROXY
ALTER TABLE public.ai_provider_configurations
  DROP CONSTRAINT IF EXISTS ai_provider_configurations_provider_name_check;

ALTER TABLE public.ai_provider_configurations
  ADD CONSTRAINT ai_provider_configurations_provider_name_check
  CHECK (provider_name IN ('NVIDIA', 'OPENAI', 'ANTHROPIC', 'GEMINI', 'AZURE_OPENAI', 'CUSTOM_LLM', 'LOCAL', 'COPILOT_PROXY'));

-- 2. Add columns for dynamic model discovery, runtime capability probing, and embedding dimension validation
ALTER TABLE public.ai_provider_configurations
  ADD COLUMN IF NOT EXISTS discovered_models JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_capabilities JSONB DEFAULT '{"chat": false, "embeddings": false, "structured_output": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS embedding_dimensions INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_concurrency INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS request_timeout_seconds INT DEFAULT 15;

-- 3. Audit trail note
COMMENT ON COLUMN public.ai_provider_configurations.discovered_models IS 'Cached list of models dynamically discovered from provider /v1/models endpoint';
COMMENT ON COLUMN public.ai_provider_configurations.verified_capabilities IS 'Active probed capabilities (chat, embeddings, structured_output) for the selected model';
COMMENT ON COLUMN public.ai_provider_configurations.embedding_dimensions IS 'Verified vector embedding dimensions produced by the model (e.g. 1536)';
