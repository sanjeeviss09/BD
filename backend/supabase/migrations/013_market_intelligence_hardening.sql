-- Step 11 & 12 Market Intelligence Hardening, RLS Tenant Isolation & Extended Schema
-- Idempotent, re-runnable, and production-safe migration

-- 1. Extended Dimensions & Provenance Columns on market_observations
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

-- 2. Extended Metadata Columns on market_dataset_versions
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS license_status VARCHAR(100) DEFAULT 'AUTHORIZED';
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS source_type VARCHAR(100) DEFAULT 'EXTERNAL_IMPORT';
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'MONTHLY';
ALTER TABLE public.market_dataset_versions ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'VALIDATED';

-- 3. Additional Performance Indexes
CREATE INDEX IF NOT EXISTS idx_market_obs_brand ON public.market_observations(brand_name);
CREATE INDEX IF NOT EXISTS idx_market_obs_molecule ON public.market_observations(molecule);
CREATE INDEX IF NOT EXISTS idx_market_obs_country_iso ON public.market_observations(country_name);
CREATE INDEX IF NOT EXISTS idx_market_obs_org_dataset ON public.market_observations(organization_id, dataset_version_id);

-- 4. Enable RLS and Attach Tenant Isolation Policies
ALTER TABLE public.market_analysis_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_analysis_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_records ENABLE ROW LEVEL SECURITY;

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

-- 5. Seed Canonical Permissions (Idempotent)
INSERT INTO public.permissions (resource, action, code, name, description, category)
VALUES
    ('market_data', 'read', 'market_data.read', 'Read Market Data', 'Access market intelligence analysis and country datasets', 'MARKET_DATA'),
    ('market_data', 'import', 'market_data.import', 'Import Market Data', 'Upload and configure external authorized market data files', 'MARKET_DATA'),
    ('market_data', 'validate', 'market_data.validate', 'Validate Market Data', 'Run and inspect quality and entity matches on datasets', 'MARKET_DATA'),
    ('market_data', 'export', 'market_data.export', 'Export Market Data', 'Generate custom multi-sheet Excel workbooks', 'MARKET_DATA'),
    ('market_data', 'admin', 'market_data.admin', 'Administer Market Data', 'Manage dataset versions, mappings, and licenses', 'MARKET_DATA')
ON CONFLICT (resource, action) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Link permissions to SUPER_ADMIN role
DO $$
DECLARE
    admin_role_id UUID;
    perm RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM public.roles WHERE code = 'SUPER_ADMIN' OR name = 'Super Administrator' LIMIT 1;
    IF admin_role_id IS NOT NULL THEN
        FOR perm IN SELECT id FROM public.permissions WHERE category = 'MARKET_DATA' LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
