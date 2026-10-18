-- =====================================================================================
-- 027 Market Intelligence — Data Integrity, Lineage & Configuration
-- -------------------------------------------------------------------------------------
-- ADDITIVE, IDEMPOTENT and RE-RUNNABLE. No DROP / TRUNCATE / RESET / data deletion.
--
-- Audit context (2026-10-13):
--   * The live database was found WITHOUT migration 013 applied (e.g. market_observations
--     .brand_name / market_dataset_versions.validation_status missing). Because 009 enables
--     RLS without policies, tenant users could neither read nor write market tables.
--   * This migration re-applies the 013 columns/policies idempotently (safe if 013 has
--     already run) and adds the columns needed for canonical geography, period coverage,
--     dataset versioning, import configuration and Market Intelligence settings.
-- =====================================================================================

-- 1. market_observations — 013 columns (idempotent re-apply) + canonical geography
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS brand_name VARCHAR(255);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS atc_code VARCHAR(50);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS disease VARCHAR(255);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS channel VARCHAR(100);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC(20, 4);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS price_currency VARCHAR(10);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS pack_size VARCHAR(100);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS source_sheet_name VARCHAR(255);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS source_row_number INT;
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS calculation_type VARCHAR(50) DEFAULT 'SOURCE_VALUE';
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS calculation_formula TEXT;
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS country_iso VARCHAR(2);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS region_name VARCHAR(100);
ALTER TABLE public.market_observations ADD COLUMN IF NOT EXISTS period_granularity VARCHAR(20) DEFAULT 'MONTH';

-- 2. market_dataset_versions — 013 columns (idempotent re-apply) + versioning & coverage
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS license_status VARCHAR(100) DEFAULT 'AUTHORIZED';
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS source_type VARCHAR(100) DEFAULT 'EXTERNAL_IMPORT';
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'MONTHLY';
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'VALIDATED';
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS version_number INT DEFAULT 1;
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS reporting_period_start DATE;
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS reporting_period_end DATE;
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS countries_count INT DEFAULT 0;
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS license_reference VARCHAR(255);
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN DEFAULT FALSE;
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.user_profiles(id);

-- 3. market_data_import_sessions — persisted wizard configuration & authorisation audit
ALTER TABLE public.market_data_import_sessions ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.market_data_import_sessions ADD COLUMN IF NOT EXISTS total_rows INT DEFAULT 0;
ALTER TABLE public.market_data_import_sessions ADD COLUMN IF NOT EXISTS authorization_confirmed_by UUID REFERENCES public.user_profiles(id);
ALTER TABLE public.market_data_import_sessions ADD COLUMN IF NOT EXISTS authorization_confirmed_at TIMESTAMP WITH TIME ZONE;

-- 4. Market Intelligence settings (Configure dialog) — one row per organisation
CREATE TABLE IF NOT EXISTS public.market_intelligence_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_market_obs_brand ON public.market_observations(brand_name);
CREATE INDEX IF NOT EXISTS idx_market_obs_molecule ON public.market_observations(molecule);
CREATE INDEX IF NOT EXISTS idx_market_obs_country_iso ON public.market_observations(country_name);
CREATE INDEX IF NOT EXISTS idx_market_obs_org_dataset ON public.market_observations(organization_id, dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_market_obs_country_iso2 ON public.market_observations(country_iso);
CREATE INDEX IF NOT EXISTS idx_market_obs_dataset_period ON public.market_observations(dataset_version_id, reporting_period);
CREATE INDEX IF NOT EXISTS idx_market_staging_session_state ON public.market_data_staging(import_session_id, validation_state);
CREATE INDEX IF NOT EXISTS idx_market_dataset_versions_status ON public.market_dataset_versions(organization_id, status);

-- 6. Row Level Security — tenant isolation (idempotent re-apply of 013 + settings)
ALTER TABLE public.market_analysis_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_analysis_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intelligence_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "market_contexts_tenant_isolation" ON public.market_analysis_contexts
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "market_snapshots_tenant_isolation" ON public.market_analysis_snapshots
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "market_datasets_tenant_isolation" ON public.market_dataset_versions
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "market_import_sessions_tenant_isolation" ON public.market_data_import_sessions
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "market_mappings_tenant_isolation" ON public.market_data_mappings
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "market_staging_tenant_isolation" ON public.market_data_staging
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "market_observations_tenant_isolation" ON public.market_observations
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "export_templates_tenant_isolation" ON public.export_templates
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "export_records_tenant_isolation" ON public.export_records
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "market_settings_tenant_isolation" ON public.market_intelligence_settings
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Canonical market-data permissions (idempotent re-apply of 013)
DO $$
BEGIN
    INSERT INTO public.permissions (resource, action, code, name, description, category)
    VALUES
        ('market_data', 'read', 'market_data.read', 'Read Market Data', 'Access market intelligence analysis and country datasets', 'MARKET_DATA'),
        ('market_data', 'import', 'market_data.import', 'Import Market Data', 'Upload and configure external authorized market data files', 'MARKET_DATA'),
        ('market_data', 'validate', 'market_data.validate', 'Validate Market Data', 'Run and inspect quality and entity matches on datasets', 'MARKET_DATA'),
        ('market_data', 'export', 'market_data.export', 'Export Market Data', 'Generate custom multi-sheet Excel workbooks', 'MARKET_DATA'),
        ('market_data', 'admin', 'market_data.admin', 'Administer Market Data', 'Manage dataset versions, mappings, settings and licenses', 'MARKET_DATA')
    ON CONFLICT (resource, action) DO UPDATE
    SET code = EXCLUDED.code, name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;
EXCEPTION WHEN undefined_column THEN
    INSERT INTO public.permissions (resource, action, code, name, description)
    VALUES
        ('market_data', 'read', 'market_data.read', 'Read Market Data', 'Access market intelligence analysis and country datasets'),
        ('market_data', 'import', 'market_data.import', 'Import Market Data', 'Upload and configure external authorized market data files'),
        ('market_data', 'validate', 'market_data.validate', 'Validate Market Data', 'Run and inspect quality and entity matches on datasets'),
        ('market_data', 'export', 'market_data.export', 'Export Market Data', 'Generate custom multi-sheet Excel workbooks'),
        ('market_data', 'admin', 'market_data.admin', 'Administer Market Data', 'Manage dataset versions, mappings, settings and licenses')
    ON CONFLICT (resource, action) DO NOTHING;
END $$;

DO $$
DECLARE
    admin_role_id UUID;
    perm RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM public.roles WHERE code = 'SUPER_ADMIN' OR name = 'Super Administrator' LIMIT 1;
    IF admin_role_id IS NOT NULL THEN
        FOR perm IN SELECT id FROM public.permissions WHERE resource = 'market_data' LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
