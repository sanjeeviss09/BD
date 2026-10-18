-- ============================================================================
-- Migration: 024_nvidia_enterprise_ai_intelligence.sql
-- Description: NVIDIA Enterprise AI Platform (Nemotron 3 Ultra, Nemotron Parse, NeMo Retriever)
-- Safety: Additive, Backward-Compatible, RLS-Enforced, Idempotent
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Extend AI Provider Configurations Table to support NVIDIA and Multi-Capability Routing
ALTER TABLE public.ai_provider_configurations
  DROP CONSTRAINT IF EXISTS ai_provider_configurations_provider_name_check;

ALTER TABLE public.ai_provider_configurations
  ADD CONSTRAINT ai_provider_configurations_provider_name_check
  CHECK (provider_name IN ('NVIDIA', 'OPENAI', 'ANTHROPIC', 'GEMINI', 'AZURE_OPENAI', 'CUSTOM_LLM', 'LOCAL'));

ALTER TABLE public.ai_provider_configurations
  ADD COLUMN IF NOT EXISTS nemotron_parse_endpoint VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nemotron_parse_key_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS nemo_retriever_endpoint VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nemo_retriever_key_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS retriever_model_name VARCHAR(100) DEFAULT 'nvidia/llama-3.2-nv-embedqa-1b-v1',
  ADD COLUMN IF NOT EXISTS active_capabilities JSONB DEFAULT '["REASONING", "DOCUMENT_PARSE", "ENTERPRISE_RETRIEVAL"]'::jsonb;

-- 2. Enterprise Knowledge Documents (Source Documentation Registry)
CREATE TABLE IF NOT EXISTS public.enterprise_knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    document_title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('FACILITY_SPEC', 'EQUIPMENT_MANUAL', 'REGULATORY_DOSSIER', 'RFQ_PACKAGE', 'COMMERCIAL_RATE_CARD', 'QUALITY_SOP', 'MEETING_MINUTES', 'MARKET_REPORT')),
    source_filename VARCHAR(255) NOT NULL,
    file_format VARCHAR(20) NOT NULL CHECK (file_format IN ('PDF', 'DOCX', 'XLSX', 'CSV', 'PNG', 'JPEG', 'TXT')),
    file_size_bytes BIGINT DEFAULT 0,
    storage_path TEXT,
    sha256_hash VARCHAR(64),
    extraction_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (extraction_status IN ('PENDING', 'PARSING', 'INDEXED', 'FAILED', 'VALIDATED')),
    parser_used VARCHAR(50) DEFAULT 'NEMOTRON_PARSE',
    total_pages INT DEFAULT 1,
    total_chunks INT DEFAULT 0,
    document_metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ekd_org ON public.enterprise_knowledge_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_ekd_type ON public.enterprise_knowledge_documents(organization_id, document_type);

-- 3. Enterprise Knowledge Chunks (Granular Evidence Store with Lineage)
CREATE TABLE IF NOT EXISTS public.enterprise_knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES public.enterprise_knowledge_documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    page_number INT,
    sheet_name VARCHAR(100),
    row_number INT,
    cell_range VARCHAR(50),
    section_heading VARCHAR(255),
    content_text TEXT NOT NULL,
    content_type VARCHAR(30) DEFAULT 'TEXT' CHECK (content_type IN ('TEXT', 'TABLE', 'KEY_VALUE', 'HEADER', 'FOOTNOTE')),
    embedding JSONB,
    source_provenance JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ekc_doc ON public.enterprise_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_ekc_org ON public.enterprise_knowledge_chunks(organization_id);

-- 4. Document Extraction Jobs (Idempotency and Processing Audit)
CREATE TABLE IF NOT EXISTS public.document_extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.enterprise_knowledge_documents(id) ON DELETE CASCADE,
    job_status VARCHAR(50) NOT NULL DEFAULT 'QUEUED' CHECK (job_status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    parser_service VARCHAR(50) NOT NULL DEFAULT 'NEMOTRON_PARSE',
    error_message TEXT,
    validation_warnings JSONB DEFAULT '[]'::jsonb,
    extraction_duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_dej_org ON public.document_extraction_jobs(organization_id);

-- 5. AI Audit and Traceability Logs (Observability and Quality Enforcement)
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    request_id VARCHAR(100) NOT NULL,
    module_name VARCHAR(50) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    total_latency_ms INT DEFAULT 0,
    feasibility_conclusion VARCHAR(50),
    validation_status VARCHAR(50) DEFAULT 'PASSED',
    supporting_evidence_count INT DEFAULT 0,
    constraints_flagged_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aal_org ON public.ai_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_aal_module ON public.ai_audit_logs(organization_id, module_name);

-- 6. Row Level Security Policies
ALTER TABLE public.enterprise_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enterprise_knowledge_documents' AND policyname = 'ekd_org_isolation') THEN
        CREATE POLICY ekd_org_isolation ON public.enterprise_knowledge_documents
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enterprise_knowledge_chunks' AND policyname = 'ekc_org_isolation') THEN
        CREATE POLICY ekc_org_isolation ON public.enterprise_knowledge_chunks
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_extraction_jobs' AND policyname = 'dej_org_isolation') THEN
        CREATE POLICY dej_org_isolation ON public.document_extraction_jobs
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_audit_logs' AND policyname = 'aal_org_isolation') THEN
        CREATE POLICY aal_org_isolation ON public.ai_audit_logs
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 7. Seed Required RBAC Permissions for NVIDIA Orchestration
INSERT INTO public.permissions (code, name, module, description)
VALUES 
    ('ai.orchestrator_admin', 'Administer NVIDIA AI Orchestration', 'AI', 'Manage NVIDIA Nemotron 3 Ultra, Parse, and NeMo Retriever configurations and endpoints'),
    ('ai.document_parse', 'Parse Enterprise Documents', 'AI', 'Extract visual and structural document data with Nemotron Parse'),
    ('ai.retrieve_knowledge', 'Retrieve Knowledge Evidence', 'AI', 'Perform semantic and hybrid search over enterprise knowledge chunks via NeMo Retriever'),
    ('ai.reasoning_generate', 'Generate CDMO Synthesis', 'AI', 'Execute reasoning and synthesis through Nemotron 3 Ultra 550B')
ON CONFLICT (code) DO NOTHING;
