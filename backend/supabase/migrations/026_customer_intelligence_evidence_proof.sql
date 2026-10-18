-- Migration: 026_customer_intelligence_evidence_proof.sql
-- Description: Additive schema extensions for clickable evidence proof, verification status model, deterministic scoring breakdown, and customer intent tracking.

-- 1. Extend Companies table additively
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255),
  ADD COLUMN IF NOT EXISTS countries_of_operation JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS business_segments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS corporate_identifiers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS therapeutic_areas JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS relationship_with_axxelent VARCHAR(100) DEFAULT 'PROSPECT',
  ADD COLUMN IF NOT EXISTS last_source_refresh_at TIMESTAMP WITH TIME ZONE;

-- 2. Extend Customer Candidates table additively
ALTER TABLE public.customer_candidates
  ADD COLUMN IF NOT EXISTS intent_status VARCHAR(100) DEFAULT 'NO_VERIFIED_INTENT',
  ADD COLUMN IF NOT EXISTS intent_evidence_summary TEXT,
  ADD COLUMN IF NOT EXISTS completeness_score INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS scoring_breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS discovery_query JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_origin_type VARCHAR(100) DEFAULT 'INTERNAL_RECORD',
  ADD COLUMN IF NOT EXISTS production_feasibility_id UUID,
  ADD COLUMN IF NOT EXISTS commercial_evaluation_id UUID;

-- 3. Extend Customer Evidence table additively
ALTER TABLE public.customer_evidence
  ADD COLUMN IF NOT EXISTS claim TEXT,
  ADD COLUMN IF NOT EXISTS claim_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS source_organization VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_excerpt TEXT,
  ADD COLUMN IF NOT EXISTS location_reference VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_date DATE,
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(100) DEFAULT 'OFFICIAL_REGULATORY',
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(100) DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS reviewer_id UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(100),
  ADD COLUMN IF NOT EXISTS limitations TEXT,
  ADD COLUMN IF NOT EXISTS internal_entity_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS internal_entity_id VARCHAR(255);

-- 4. Create Source Ingestion Connectors Tracking Table
CREATE TABLE IF NOT EXISTS public.customer_intelligence_connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    connector_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- PUBLIC_REGULATORY, COMPANY_DISCLOSURES, LICENSED_MARKET, INTERNAL_BDIQ
    status VARCHAR(50) DEFAULT 'CONNECTED', -- CONNECTED, DEGRADED, DISCONNECTED, DEMO_MODE
    coverage_description TEXT,
    refresh_policy VARCHAR(100) DEFAULT 'WEEKLY',
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_error TEXT,
    total_records_ingested INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.customer_intelligence_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization connectors" 
ON public.customer_intelligence_connectors FOR SELECT 
USING (organization_id = get_auth_user_organization_id() OR organization_id IS NULL);

-- 5. Seed default scoring configuration if none exists
INSERT INTO public.customer_fit_configurations (id, organization_id, version, dimensions, is_active)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  1,
  '[
    {"key": "capability_fit", "name": "CDMO Manufacturing Capability Fit", "weight": 25, "mandatory": true, "description": "Compatibility with Axxelent sterile fill-finish, oral solid dose, and lyophilization equipment"},
    {"key": "portfolio_alignment", "name": "Product Portfolio Alignment", "weight": 20, "mandatory": true, "description": "Overlap between customer active commercial portfolio and target therapeutic categories"},
    {"key": "market_fit", "name": "Target Market & Regulatory Footprint", "weight": 15, "mandatory": false, "description": "Commercial presence in US, EU, and regulated markets matching Axxelent GMP approvals"},
    {"key": "regulatory_fit", "name": "Regulatory & Quality Gate Alignment", "weight": 15, "mandatory": false, "description": "DMF/ASMF submission readiness, CQA validation, and quality agreement feasibility"},
    {"key": "commercial_value", "name": "Commercial Scale & Batch Value", "weight": 10, "mandatory": false, "description": "Estimated annual batch revenue potential and volume commitments"},
    {"key": "sourcing_signals", "name": "Verified Sourcing / Outsourcing Signals", "weight": 15, "mandatory": false, "description": "Documented dual-sourcing strategy, CDMO tender announcements, or verified RFQs"}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 6. Indexes for fast inspection
CREATE INDEX IF NOT EXISTS idx_customer_evidence_verification ON public.customer_evidence(verification_status);
CREATE INDEX IF NOT EXISTS idx_customer_evidence_type ON public.customer_evidence(source_type);
CREATE INDEX IF NOT EXISTS idx_customer_candidates_intent ON public.customer_candidates(intent_status);
