-- Step 11 & 12 Market Intelligence and Authorized Ingestion Engine

-- 1. Analysis Context & Snapshots
CREATE TABLE market_analysis_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255),
    selected_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    selected_molecule VARCHAR(255),
    selected_brand VARCHAR(255),
    selected_therapeutic_category_id UUID,
    selected_jurisdictions JSONB, -- Array of country IDs
    selected_date_range JSONB, -- { start_date, end_date }
    selected_dataset_versions JSONB, -- Array of dataset version IDs
    selected_sources JSONB,
    selected_metrics JSONB,
    filters JSONB,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'ACTIVE'
);

CREATE TABLE market_analysis_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    context_id UUID REFERENCES market_analysis_contexts(id) ON DELETE SET NULL,
    snapshot_name VARCHAR(255) NOT NULL,
    snapshot_metadata JSONB NOT NULL, -- The exact state of the analysis at the time
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Data Sources & Import Sessions
CREATE TABLE market_dataset_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dataset_name VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(500),
    file_reference VARCHAR(500),
    file_hash VARCHAR(255),
    reporting_period VARCHAR(100),
    import_session_id UUID, -- Will reference import_sessions below
    mapping_version_id UUID,
    record_count INT DEFAULT 0,
    valid_count INT DEFAULT 0,
    invalid_count INT DEFAULT 0,
    duplicate_count INT DEFAULT 0,
    data_quality_score NUMERIC(5,2),
    capabilities JSONB, -- e.g. { "sales": true, "volume": true }
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE market_data_import_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_id UUID, -- References data_sources if they exist
    dataset_version_id UUID REFERENCES market_dataset_versions(id) ON DELETE SET NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_reference VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(255),
    processing_status VARCHAR(50) DEFAULT 'UPLOADED',
    current_step VARCHAR(100),
    progress INT DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    error_summary TEXT,
    warning_count INT DEFAULT 0,
    valid_count INT DEFAULT 0,
    invalid_count INT DEFAULT 0,
    duplicate_count INT DEFAULT 0,
    unmatched_count INT DEFAULT 0,
    uploaded_by UUID REFERENCES user_profiles(id)
);

-- Self-referential update for dataset version
ALTER TABLE market_dataset_versions ADD CONSTRAINT fk_import_session FOREIGN KEY (import_session_id) REFERENCES market_data_import_sessions(id) ON DELETE SET NULL;

CREATE TABLE market_data_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    mapping_name VARCHAR(255) NOT NULL,
    source_provider VARCHAR(255),
    mapping_config JSONB NOT NULL, -- { "Source Column": "Canonical Field" }
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Staging and Market Observations
CREATE TABLE market_data_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    import_session_id UUID NOT NULL REFERENCES market_data_import_sessions(id) ON DELETE CASCADE,
    source_row_index INT NOT NULL,
    raw_values JSONB NOT NULL,
    parsed_values JSONB,
    validation_state VARCHAR(50) DEFAULT 'PENDING',
    match_state VARCHAR(50) DEFAULT 'PENDING',
    errors JSONB,
    warnings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE market_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dataset_version_id UUID NOT NULL REFERENCES market_dataset_versions(id) ON DELETE CASCADE,
    import_session_id UUID REFERENCES market_data_import_sessions(id) ON DELETE SET NULL,
    source_record_reference VARCHAR(255), -- Reference to staging or original row

    -- Canonical Identity
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    external_product_identifier VARCHAR(255),
    external_product_name VARCHAR(255),
    molecule VARCHAR(255),
    
    company_id UUID,
    external_company_identifier VARCHAR(255),
    external_company_name VARCHAR(255),

    country_id UUID,
    country_name VARCHAR(255),
    region_id UUID,
    
    -- Dimensions
    reporting_period DATE NOT NULL,
    dosage_form VARCHAR(255),
    route VARCHAR(255),
    strength VARCHAR(255),
    market_segment VARCHAR(255),
    
    -- Metrics
    sales_value NUMERIC(20, 4),
    sales_currency VARCHAR(10),
    volume_value NUMERIC(20, 4),
    volume_unit VARCHAR(50),
    market_share NUMERIC(10, 4),
    
    data_quality_status VARCHAR(50) DEFAULT 'VALID',
    match_status VARCHAR(50) DEFAULT 'MATCHED',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Custom Excel Export System
CREATE TABLE export_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    scope_config JSONB NOT NULL,
    selected_fields JSONB NOT NULL,
    field_order JSONB NOT NULL,
    sheet_selection JSONB NOT NULL,
    sheet_order JSONB NOT NULL,
    summary_enabled BOOLEAN DEFAULT TRUE,
    summary_blocks JSONB,
    summary_block_order JSONB,
    formatting_preferences JSONB,
    default_filters JSONB,
    created_by UUID REFERENCES user_profiles(id),
    updated_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE export_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    analysis_snapshot_id UUID REFERENCES market_analysis_snapshots(id) ON DELETE SET NULL,
    template_id UUID REFERENCES export_templates(id) ON DELETE SET NULL,
    dataset_version_ids JSONB,
    filters JSONB,
    selected_fields JSONB,
    selected_sheets JSONB,
    file_name VARCHAR(500) NOT NULL,
    file_reference VARCHAR(500),
    row_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'PROCESSING',
    error_details TEXT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_analysis_contexts_org ON market_analysis_contexts(organization_id);
CREATE INDEX IF NOT EXISTS idx_market_dataset_versions_org ON market_dataset_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_org ON market_data_import_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_market_data_staging_session ON market_data_staging(import_session_id);
CREATE INDEX IF NOT EXISTS idx_market_observations_dataset ON market_observations(dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_market_observations_product ON market_observations(product_id);
CREATE INDEX IF NOT EXISTS idx_market_observations_period ON market_observations(reporting_period);
CREATE INDEX IF NOT EXISTS idx_market_observations_company ON market_observations(external_company_name);
CREATE INDEX IF NOT EXISTS idx_export_templates_org ON export_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_records_org ON export_records(organization_id);

-- Apply RLS (Row Level Security)
ALTER TABLE market_analysis_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_analysis_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_records ENABLE ROW LEVEL SECURITY;
