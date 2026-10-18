-- =====================================================================================
-- 028 Central Platform Settings, Feature Registry & Configuration Engine
-- -------------------------------------------------------------------------------------
-- STRICTLY ADDITIVE, IDEMPOTENT and RE-RUNNABLE.
-- Zero destructive operations.
-- Production database safety verified.
-- =====================================================================================

-- 1. Central Feature Registry
CREATE TABLE IF NOT EXISTS public.platform_features (
    id VARCHAR(100) PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tier VARCHAR(50) DEFAULT 'OPTIONAL', -- 'ESSENTIAL' or 'OPTIONAL'
    is_enabled BOOLEAN DEFAULT TRUE,
    dependencies JSONB DEFAULT '[]'::jsonb,
    config_keys JSONB DEFAULT '[]'::jsonb,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tenant Feature Overrides (Allows multi-tenant feature toggling)
CREATE TABLE IF NOT EXISTS public.tenant_feature_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feature_id VARCHAR(100) NOT NULL REFERENCES public.platform_features(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL,
    updated_by UUID REFERENCES public.user_profiles(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, feature_id)
);

-- 3. Central Platform Settings (Tenant-level configuration values)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT DEFAULT 1,
    updated_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, module)
);

-- 4. Configuration Version Snapshots & Audit Trail
CREATE TABLE IF NOT EXISTS public.configuration_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version INT NOT NULL,
    snapshot_json JSONB NOT NULL,
    change_summary TEXT,
    published_by UUID REFERENCES public.user_profiles(id),
    is_rollback BOOLEAN DEFAULT FALSE,
    rolled_back_from_version INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, version)
);

-- 5. Indexes for High-Performance Configuration Queries
CREATE INDEX IF NOT EXISTS idx_platform_features_module ON public.platform_features(module);
CREATE INDEX IF NOT EXISTS idx_tenant_feature_overrides_org ON public.tenant_feature_overrides(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_settings_org_module ON public.platform_settings(organization_id, module);
CREATE INDEX IF NOT EXISTS idx_configuration_snapshots_org_ver ON public.configuration_snapshots(organization_id, version DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuration_snapshots ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- platform_features: readable by all authenticated users
DROP POLICY IF EXISTS platform_features_read_all ON public.platform_features;
CREATE POLICY platform_features_read_all ON public.platform_features
    FOR SELECT TO authenticated USING (true);

-- tenant_feature_overrides: scoped to user's organization
DROP POLICY IF EXISTS tenant_feature_overrides_org_policy ON public.tenant_feature_overrides;
CREATE POLICY tenant_feature_overrides_org_policy ON public.tenant_feature_overrides
    FOR ALL TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- platform_settings: scoped to user's organization
DROP POLICY IF EXISTS platform_settings_org_policy ON public.platform_settings;
CREATE POLICY platform_settings_org_policy ON public.platform_settings
    FOR ALL TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- configuration_snapshots: scoped to user's organization
DROP POLICY IF EXISTS configuration_snapshots_org_policy ON public.configuration_snapshots;
CREATE POLICY configuration_snapshots_org_policy ON public.configuration_snapshots
    FOR ALL TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE auth_user_id = auth.uid()));

-- 8. Seed Core Platform Features (All 19 BDIQ Domains Discovered in Audit)
INSERT INTO public.platform_features (id, module, name, description, tier, is_enabled, dependencies, config_keys) VALUES
('executive_dashboard', 'dashboard', 'Executive Intelligence & Dashboard', 'Executive KPI aggregations, pipeline throughput, and velocity dashboards.', 'ESSENTIAL', true, '[]'::jsonb, '["default_view", "kpi_refresh_rate"]'::jsonb),
('product_master', 'products', 'Product Master Directory', 'Pharmaceutical product master catalog, molecules, dosage forms, and strengths.', 'ESSENTIAL', true, '[]'::jsonb, '["allowed_dosage_forms", "duplicate_detection", "archival_rules"]'::jsonb),
('opportunity_management', 'opportunities', 'Opportunity Management & Pipeline', 'Commercial pipeline tracking, qualification stages, probability weights, and win-loss intelligence.', 'ESSENTIAL', true, '["product_master"]'::jsonb, '["pipeline_stages", "scoring_criteria", "assignment_defaults"]'::jsonb),
('task_management', 'tasks', 'Department Tasks & Follow-up History', 'Department follow-up tracking, immutable follow-up dates, SLA tracking, and delay calculation.', 'ESSENTIAL', true, '[]'::jsonb, '["followup_intervals", "escalation_hours", "sla_calendar"]'::jsonb),
('responsibility_engine', 'responsibility', 'Central Responsibility Engine', 'Matrix for responsibility assignments, SLA hours calendar, and automatic routing rules.', 'ESSENTIAL', true, '["task_management"]'::jsonb, '["assignment_mode", "escalation_levels", "sla_calendar_type"]'::jsonb),
('workflow_engine', 'workflows', 'Configurable Workflow Engine', 'State machine transitions, entry/exit condition enforcement, and SLA guardrails.', 'ESSENTIAL', true, '[]'::jsonb, '["transition_rules", "auto_advance", "approval_thresholds"]'::jsonb),
('market_intelligence', 'market_data', 'Market Intelligence & Ingestion', 'Pharmaceutical market data, IQVIA MIDAS dataset imports, geographic mapping, and pricing analytics.', 'OPTIONAL', true, '["product_master"]'::jsonb, '["data_sources", "geo_mapping", "freshness_alert_days"]'::jsonb),
('customer_intelligence', 'customers', 'Customer Intelligence & Intent Verification', 'Customer tiering, intent verification proof documentation, and qualification scoring.', 'OPTIONAL', true, '["product_master"]'::jsonb, '["qualification_criteria", "intent_evidence_required"]'::jsonb),
('regulatory_intelligence', 'regulatory', 'Regulatory Intelligence & Guidelines', 'Country filing guidelines, regulatory dossier requirements, and submission risk tracking.', 'OPTIONAL', true, '["product_master"]'::jsonb, '["target_jurisdictions", "warning_offsets_days"]'::jsonb),
('production_feasibility', 'feasibility', 'Technical & CDMO Production Feasibility', 'Facility line capacities, batch sizes, equipment constraints, and yield calculations.', 'OPTIONAL', true, '["product_master"]'::jsonb, '["batch_size_constraints", "yield_assumptions", "equipment_lines"]'::jsonb),
('cdmo_benchmarking', 'benchmarking', 'CDMO Competitor Benchmarking', 'Competitor plant capabilities, dosage form benchmarks, and comparative pricing intelligence.', 'OPTIONAL', true, '["production_feasibility"]'::jsonb, '["benchmark_metrics", "peer_group"]'::jsonb),
('rfq_management', 'rfqs', 'RFQ Management & Supplier Bidding', 'Request for Quotation lifecycle, line items, customer specifications, and vendor responses.', 'OPTIONAL', true, '["product_master", "opportunity_management"]'::jsonb, '["quote_templates", "clarification_statuses", "validity_days"]'::jsonb),
('commercial_evaluation', 'commercial', 'Commercial Evaluation & Pricing Models', 'Margin modeling, scenario simulations, COGS breakdowns, and commercial viability.', 'OPTIONAL', true, '["production_feasibility", "rfq_management"]'::jsonb, '["cost_categories", "default_margins", "pricing_currency"]'::jsonb),
('meeting_intelligence', 'meetings', 'Meeting Intelligence & Live Capture', 'Meeting scheduler, live notes workbench, agenda templates, and action item task creation.', 'OPTIONAL', true, '["task_management"]'::jsonb, '["meeting_types", "mini_notes_default", "reminder_offsets"]'::jsonb),
('notification_system', 'notifications', 'Enterprise Notification & Escalation', 'In-app notification drawer, browser alerts, meeting reminders, and task escalation alerts.', 'ESSENTIAL', true, '[]'::jsonb, '["channels", "reminder_lead_time_min", "escalation_offset_hours"]'::jsonb),
('department_management', 'departments', 'Department & Staff Master Directory', 'Organizational hierarchies, business units, operating sites, and department staff rosters.', 'ESSENTIAL', true, '[]'::jsonb, '["hierarchy_depth", "code_prefix"]'::jsonb),
('role_security', 'roles', 'Role-Based Access Control (RBAC)', 'Role permissions, tenant isolation, resource-level grants, and security policies.', 'ESSENTIAL', true, '[]'::jsonb, '["session_timeout_min", "mfa_enforced"]'::jsonb),
('ai_orchestrator', 'ai', 'Enterprise AI & NVIDIA Intelligence', 'Document extraction, synthesis, and CDMO feasibility assistance using encrypted provider keys.', 'OPTIONAL', true, '[]'::jsonb, '["model_provider", "temperature", "max_tokens"]'::jsonb),
('reports_and_exports', 'reports', 'Reports, Analytics & Spreadsheet Exports', 'Automated PDF/Excel exports, executive summaries, and audit trail data exports.', 'ESSENTIAL', true, '[]'::jsonb, '["export_formats", "page_size", "include_audit_trail"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    tier = EXCLUDED.tier,
    dependencies = EXCLUDED.dependencies,
    config_keys = EXCLUDED.config_keys,
    updated_at = NOW();

-- 9. Seed Configuration Permissions
INSERT INTO public.permissions (resource, action, code, name, category, description) VALUES
('configuration', 'features', 'configuration.features', 'Manage Platform Features', 'Settings', 'Can toggle optional platform features and view feature registry'),
('configuration', 'publish', 'configuration.publish', 'Publish Configuration Snapshots', 'Settings', 'Can publish versioned platform configuration changes'),
('configuration', 'rollback', 'configuration.rollback', 'Rollback Configuration', 'Settings', 'Can revert configuration to previous snapshots')
ON CONFLICT (resource, action) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;
