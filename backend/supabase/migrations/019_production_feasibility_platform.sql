-- ============================================================================
-- Migration: 019_production_feasibility_platform.sql
-- Description: Step 19 Production Feasibility & Manufacturing Intelligence Platform
-- Safe, Idempotent, Additive, Tenant-Isolated Production-Grade Schema
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Sequences for Codes
CREATE SEQUENCE IF NOT EXISTS production_feasibility_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS production_facility_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS production_line_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS production_equipment_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS production_technology_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_feasibility_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('production_feasibility_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'PF-' || year_str || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_facility_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
BEGIN
    SELECT nextval('production_facility_code_seq') INTO next_val;
    RETURN 'FAC-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_line_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
BEGIN
    SELECT nextval('production_line_code_seq') INTO next_val;
    RETURN 'LINE-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_equipment_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
BEGIN
    SELECT nextval('production_equipment_code_seq') INTO next_val;
    RETURN 'EQP-' || LPAD(next_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_next_technology_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
BEGIN
    SELECT nextval('production_technology_code_seq') INTO next_val;
    RETURN 'TECH-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Facility Master
CREATE TABLE IF NOT EXISTS public.production_facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    facility_code VARCHAR(50) NOT NULL,
    facility_name VARCHAR(255) NOT NULL,
    site_type VARCHAR(50) DEFAULT 'COMMERCIAL' CHECK (site_type IN ('COMMERCIAL', 'R_AND_D', 'PILOT_PLANT', 'CORPORATE', 'CONTRACT_MANUFACTURING')),
    building_block VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
    country_iso2 VARCHAR(2) DEFAULT 'IN',
    site_status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (site_status IN ('ACTIVE', 'INACTIVE', 'AUDIT_PENDING', 'UNDER_EXPANSION', 'MAINTENANCE_SHUTDOWN')),
    regulatory_approvals JSONB DEFAULT '[]'::jsonb,
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    operational_hours_per_day INT DEFAULT 16,
    operational_days_per_year INT DEFAULT 300,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, facility_code)
);

CREATE INDEX IF NOT EXISTS idx_prod_facilities_org ON public.production_facilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_facilities_status ON public.production_facilities(organization_id, site_status);

-- 3. Production Lines Master
CREATE TABLE IF NOT EXISTS public.production_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES public.production_facilities(id) ON DELETE CASCADE,
    line_code VARCHAR(50) NOT NULL,
    line_name VARCHAR(255) NOT NULL,
    manufacturing_type VARCHAR(100) NOT NULL, -- e.g. ORAL_SOLID_DOSAGE, STERILE_INJECTABLE, LIQUID_ORAL, TOPICAL
    applicable_dosage_forms JSONB DEFAULT '[]'::jsonb, -- ['TABLET', 'CAPSULE']
    applicable_technologies JSONB DEFAULT '[]'::jsonb,
    batch_size_min NUMERIC(15,2) DEFAULT 10000,
    batch_size_max NUMERIC(15,2) DEFAULT 1000000,
    batch_size_unit VARCHAR(50) DEFAULT 'UNITS',
    nominal_hourly_capacity NUMERIC(15,2) DEFAULT 50000,
    nominal_annual_capacity NUMERIC(15,2) DEFAULT 50000000,
    operating_hours_per_day INT DEFAULT 16,
    working_days_per_year INT DEFAULT 300,
    qualification_status VARCHAR(50) DEFAULT 'QUALIFIED' CHECK (qualification_status IN ('QUALIFIED', 'PARTIALLY_QUALIFIED', 'EXPIRED', 'NOT_QUALIFIED', 'UNKNOWN')),
    validation_status VARCHAR(50) DEFAULT 'VALIDATED' CHECK (validation_status IN ('VALIDATED', 'REVALIDATION_DUE', 'PENDING')),
    current_utilization_pct NUMERIC(5,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'QUALIFICATION', 'MAINTENANCE', 'BLOCKED', 'RETIRED')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, facility_id, line_code)
);

CREATE INDEX IF NOT EXISTS idx_prod_lines_org ON public.production_lines(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_lines_facility ON public.production_lines(facility_id);

-- 4. Production Equipment Master
CREATE TABLE IF NOT EXISTS public.production_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES public.production_facilities(id) ON DELETE CASCADE,
    production_line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
    equipment_code VARCHAR(50) NOT NULL,
    equipment_name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100) NOT NULL, -- Blender, Granulator, Compression Machine, Coating Machine, Capsule Filler, etc.
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(100),
    capacity_nominal NUMERIC(15,2),
    capacity_min NUMERIC(15,2),
    capacity_max NUMERIC(15,2),
    capacity_unit VARCHAR(50) DEFAULT 'kg/hr',
    qualification_status VARCHAR(50) DEFAULT 'QUALIFIED' CHECK (qualification_status IN ('QUALIFIED', 'PARTIALLY_QUALIFIED', 'EXPIRED', 'NOT_QUALIFIED', 'UNKNOWN')),
    iq_status VARCHAR(50) DEFAULT 'QUALIFIED',
    oq_status VARCHAR(50) DEFAULT 'QUALIFIED',
    pq_status VARCHAR(50) DEFAULT 'QUALIFIED',
    calibration_status VARCHAR(50) DEFAULT 'CALIBRATED' CHECK (calibration_status IN ('CALIBRATED', 'DUE', 'EXPIRED', 'NOT_APPLICABLE')),
    validation_status VARCHAR(50) DEFAULT 'VALIDATED',
    maintenance_status VARCHAR(50) DEFAULT 'OPERATIONAL' CHECK (maintenance_status IN ('OPERATIONAL', 'UNDER_MAINTENANCE', 'BREAKDOWN')),
    qualification_expiry_date DATE,
    calibration_due_date DATE,
    availability_status VARCHAR(50) DEFAULT 'AVAILABLE' CHECK (availability_status IN ('AVAILABLE', 'IN_USE', 'RESERVED', 'UNAVAILABLE')),
    is_critical BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'RETIRED')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, facility_id, equipment_code)
);

CREATE INDEX IF NOT EXISTS idx_prod_equipment_org ON public.production_equipment(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_equipment_facility ON public.production_equipment(facility_id);
CREATE INDEX IF NOT EXISTS idx_prod_equipment_line ON public.production_equipment(production_line_id);

-- 5. Manufacturing Technologies Capability Master
CREATE TABLE IF NOT EXISTS public.production_technologies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    technology_code VARCHAR(50) NOT NULL,
    technology_name VARCHAR(255) NOT NULL,
    applicable_dosage_forms JSONB DEFAULT '[]'::jsonb,
    applicable_routes JSONB DEFAULT '[]'::jsonb,
    facility_id UUID REFERENCES public.production_facilities(id) ON DELETE CASCADE,
    production_line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
    equipment_ids JSONB DEFAULT '[]'::jsonb,
    qualification_status VARCHAR(50) DEFAULT 'QUALIFIED' CHECK (qualification_status IN ('QUALIFIED', 'DEVELOPMENT_ONLY', 'PROPOSED')),
    capacity NUMERIC(15,2),
    validated_products_count INT DEFAULT 0,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, technology_code, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_technologies_org ON public.production_technologies(organization_id);

-- 6. Production Feasibility Core Record
CREATE TABLE IF NOT EXISTS public.production_feasibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_code VARCHAR(50) NOT NULL,
    rfq_id UUID REFERENCES public.rfqs(id) ON DELETE SET NULL,
    rfq_line_item_id UUID REFERENCES public.rfq_line_items(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name VARCHAR(255),
    product_version_id INT DEFAULT 1,
    molecule_id UUID REFERENCES public.molecules(id) ON DELETE SET NULL,
    dosage_form VARCHAR(100),
    route VARCHAR(100),
    strength VARCHAR(100),
    presentation VARCHAR(100),
    pack_size VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'DATA_COLLECTION',
        'UNDER_EVALUATION',
        'TECHNICAL_REVIEW',
        'CAPACITY_REVIEW',
        'CONDITIONAL',
        'READY_FOR_DECISION',
        'FINALIZED',
        'SUPERSEDED',
        'CANCELLED'
    )),
    feasibility_result VARCHAR(50) NOT NULL DEFAULT 'DATA_INSUFFICIENT' CHECK (feasibility_result IN (
        'FEASIBLE',
        'CONDITIONALLY_FEASIBLE',
        'FEASIBLE_WITH_DEVELOPMENT',
        'CAPACITY_CONSTRAINED',
        'TECHNOLOGY_GAP',
        'EQUIPMENT_GAP',
        'MATERIAL_GAP',
        'REGULATORY_CONSTRAINT',
        'TIMELINE_CONSTRAINT',
        'NOT_FEASIBLE',
        'DATA_INSUFFICIENT'
    )),
    feasibility_score NUMERIC(5,2),
    score_breakdown JSONB DEFAULT '{}'::jsonb,
    facility_id UUID REFERENCES public.production_facilities(id) ON DELETE SET NULL,
    production_line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
    production_owner UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    technical_owner UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    evaluation_date DATE DEFAULT CURRENT_DATE,
    required_quantity NUMERIC(15,2),
    required_quantity_unit VARCHAR(50) DEFAULT 'UNITS',
    annual_volume NUMERIC(15,2),
    customer_required_date DATE,
    estimated_available_date DATE,
    batch_size NUMERIC(15,2),
    batch_size_unit VARCHAR(50) DEFAULT 'UNITS',
    estimated_batches NUMERIC(10,2),
    expected_yield_pct NUMERIC(5,2) DEFAULT 95.0,
    yield_source VARCHAR(50) DEFAULT 'ENGINEERING_ESTIMATE' CHECK (yield_source IN ('HISTORICAL_YIELD', 'VALIDATED_YIELD', 'ENGINEERING_ESTIMATE', 'ASSUMPTION')),
    required_manufacturing_quantity NUMERIC(15,2),
    setup_time_hours NUMERIC(10,2) DEFAULT 0,
    processing_time_hours NUMERIC(10,2) DEFAULT 0,
    cleaning_time_hours NUMERIC(10,2) DEFAULT 0,
    changeover_time_hours NUMERIC(10,2) DEFAULT 0,
    testing_release_time_days NUMERIC(10,2) DEFAULT 0,
    manufacturing_lead_time_days NUMERIC(10,2) DEFAULT 0,
    total_customer_lead_time_days NUMERIC(10,2) DEFAULT 0,
    development_required BOOLEAN DEFAULT FALSE,
    development_category VARCHAR(50) DEFAULT 'NO_DEVELOPMENT' CHECK (development_category IN ('NO_DEVELOPMENT', 'MINOR_DEVELOPMENT', 'SIGNIFICANT_DEVELOPMENT', 'FULL_DEVELOPMENT_PROGRAM', 'UNKNOWN')),
    technology_transfer_required BOOLEAN DEFAULT FALSE,
    technology_transfer_status VARCHAR(50) DEFAULT 'NOT_REQUIRED' CHECK (technology_transfer_status IN ('NOT_REQUIRED', 'REQUIRED', 'IN_PROGRESS', 'COMPLETED', 'UNKNOWN')),
    technology_transfer_duration_weeks INT DEFAULT 0,
    validation_required BOOLEAN DEFAULT FALSE,
    regulatory_assessment_required BOOLEAN DEFAULT FALSE,
    regulatory_status VARCHAR(50) DEFAULT 'COMPLIANT',
    sterile_manufacturing_required BOOLEAN DEFAULT FALSE,
    sterile_status VARCHAR(50) DEFAULT 'NOT_APPLICABLE',
    packaging_feasibility_status VARCHAR(50) DEFAULT 'FEASIBLE',
    capacity_status VARCHAR(50) DEFAULT 'UNKNOWN',
    equipment_status VARCHAR(50) DEFAULT 'UNKNOWN',
    material_status VARCHAR(50) DEFAULT 'UNKNOWN',
    quality_status VARCHAR(50) DEFAULT 'UNKNOWN',
    supply_chain_status VARCHAR(50) DEFAULT 'UNKNOWN',
    overall_risk VARCHAR(50) DEFAULT 'LOW' CHECK (overall_risk IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    recommendation VARCHAR(50) DEFAULT 'PROCEED' CHECK (recommendation IN ('PROCEED', 'PROCEED_WITH_CONDITIONS', 'HOLD_FOR_CAPACITY', 'REJECT', 'DATA_REQUIRED')),
    recommendation_reason TEXT,
    data_completeness_pct NUMERIC(5,2) DEFAULT 0,
    is_finalized BOOLEAN DEFAULT FALSE,
    version_number INT DEFAULT 1,
    active_version_id UUID,
    finalized_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    finalized_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, feasibility_code)
);

CREATE INDEX IF NOT EXISTS idx_prod_feasibility_org ON public.production_feasibility(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_feasibility_status ON public.production_feasibility(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_prod_feasibility_rfq ON public.production_feasibility(rfq_id);
CREATE INDEX IF NOT EXISTS idx_prod_feasibility_product ON public.production_feasibility(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_feasibility_facility ON public.production_feasibility(facility_id);

-- 7. Production Feasibility Versions (Immutable Snapshots)
CREATE TABLE IF NOT EXISTS public.production_feasibility_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_summary TEXT,
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
    finalized_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    finalized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(feasibility_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_prod_feas_ver_feas ON public.production_feasibility_versions(feasibility_id);
CREATE INDEX IF NOT EXISTS idx_prod_feas_ver_org ON public.production_feasibility_versions(organization_id);

-- 8. Capacity Allocations & Ledger
CREATE TABLE IF NOT EXISTS public.production_capacity_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES public.production_facilities(id) ON DELETE CASCADE,
    production_line_id UUID NOT NULL REFERENCES public.production_lines(id) ON DELETE CASCADE,
    period_year INT NOT NULL,
    period_type VARCHAR(20) DEFAULT 'ANNUAL' CHECK (period_type IN ('ANNUAL', 'QUARTERLY', 'MONTHLY')),
    period_number INT DEFAULT 0, -- 0 for annual, 1-4 for quarter, 1-12 for month
    theoretical_capacity NUMERIC(15,2) NOT NULL DEFAULT 0,
    available_capacity NUMERIC(15,2) NOT NULL DEFAULT 0,
    committed_capacity NUMERIC(15,2) NOT NULL DEFAULT 0,
    reserved_capacity NUMERIC(15,2) NOT NULL DEFAULT 0,
    remaining_capacity NUMERIC(15,2) NOT NULL DEFAULT 0,
    utilization_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    rfq_id UUID REFERENCES public.rfqs(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    production_feasibility_id UUID REFERENCES public.production_feasibility(id) ON DELETE SET NULL,
    allocation_type VARCHAR(50) DEFAULT 'COMMITTED' CHECK (allocation_type IN ('COMMITTED', 'RESERVED', 'PLANNED', 'BUFFER')),
    allocated_units NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'EXPIRED')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_capacity_org ON public.production_capacity_allocations(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_capacity_facility ON public.production_capacity_allocations(facility_id);
CREATE INDEX IF NOT EXISTS idx_prod_capacity_line ON public.production_capacity_allocations(production_line_id);
CREATE INDEX IF NOT EXISTS idx_prod_capacity_period ON public.production_capacity_allocations(period_year, period_type, period_number);

-- 9. Production Gaps
CREATE TABLE IF NOT EXISTS public.production_gaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    gap_category VARCHAR(50) NOT NULL CHECK (gap_category IN (
        'CAPABILITY_GAP',
        'CAPACITY_GAP',
        'EQUIPMENT_GAP',
        'MATERIAL_GAP',
        'TECHNOLOGY_GAP',
        'QUALITY_GAP',
        'REGULATORY_GAP',
        'TIMELINE_GAP',
        'PACKAGING_GAP',
        'SUPPLIER_GAP'
    )),
    description TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    required_action TEXT NOT NULL,
    responsible_department VARCHAR(100),
    responsible_role VARCHAR(100),
    target_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MITIGATING', 'RESOLVED', 'WAIVED')),
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_gaps_org ON public.production_gaps(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_gaps_feas ON public.production_gaps(feasibility_id);
CREATE INDEX IF NOT EXISTS idx_prod_gaps_task ON public.production_gaps(task_id);

-- 10. Production Risks
CREATE TABLE IF NOT EXISTS public.production_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    risk_category VARCHAR(50) NOT NULL CHECK (risk_category IN (
        'CAPACITY',
        'EQUIPMENT',
        'MATERIAL',
        'SUPPLIER',
        'TECHNOLOGY',
        'PROCESS',
        'QUALITY',
        'REGULATORY',
        'TIMELINE',
        'PACKAGING',
        'PERSONNEL',
        'FACILITY'
    )),
    risk_title VARCHAR(255) NOT NULL,
    description TEXT,
    probability INT NOT NULL CHECK (probability >= 1 AND probability <= 5),
    impact INT NOT NULL CHECK (impact >= 1 AND impact <= 5),
    risk_score INT NOT NULL,
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    mitigation_plan TEXT,
    owner_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_risks_org ON public.production_risks(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_risks_feas ON public.production_risks(feasibility_id);

-- 11. Production Material Requirements & Availability
CREATE TABLE IF NOT EXISTS public.production_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    material_category VARCHAR(50) NOT NULL CHECK (material_category IN (
        'API',
        'EXCIPIENT',
        'SOLVENT',
        'PROCESS_MATERIAL',
        'PACKAGING_MATERIAL',
        'PRIMARY_PACKAGING',
        'SECONDARY_PACKAGING',
        'TERTIARY_PACKAGING',
        'LABELS',
        'OTHER'
    )),
    material_name VARCHAR(255) NOT NULL,
    cas_number VARCHAR(50),
    required_quantity NUMERIC(15,2) NOT NULL,
    required_unit VARCHAR(50) NOT NULL DEFAULT 'kg',
    available_quantity NUMERIC(15,2) DEFAULT 0,
    reserved_quantity NUMERIC(15,2) DEFAULT 0,
    gap_quantity NUMERIC(15,2) DEFAULT 0,
    supplier_name VARCHAR(255),
    supplier_country VARCHAR(100),
    lead_time_days INT,
    moq NUMERIC(15,2),
    safety_stock NUMERIC(15,2),
    availability_status VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN' CHECK (availability_status IN (
        'AVAILABLE',
        'PARTIALLY_AVAILABLE',
        'NOT_AVAILABLE',
        'SUPPLIER_DEPENDENT',
        'LONG_LEAD',
        'UNKNOWN'
    )),
    supplier_qualification_status VARCHAR(50) DEFAULT 'QUALIFIED',
    is_critical BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_materials_org ON public.production_materials(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_materials_feas ON public.production_materials(feasibility_id);

-- 12. Production Process Steps
CREATE TABLE IF NOT EXISTS public.production_process_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    operation_name VARCHAR(255) NOT NULL,
    equipment_type_required VARCHAR(100),
    equipment_id UUID REFERENCES public.production_equipment(id) ON DELETE SET NULL,
    setup_time_hours NUMERIC(10,2) DEFAULT 0,
    processing_time_hours NUMERIC(10,2) DEFAULT 0,
    cleaning_time_hours NUMERIC(10,2) DEFAULT 0,
    changeover_time_hours NUMERIC(10,2) DEFAULT 0,
    inspection_time_hours NUMERIC(10,2) DEFAULT 0,
    waiting_time_hours NUMERIC(10,2) DEFAULT 0,
    total_step_hours NUMERIC(10,2) DEFAULT 0,
    step_yield_pct NUMERIC(5,2) DEFAULT 100.0,
    critical_parameters JSONB DEFAULT '[]'::jsonb,
    quality_checks JSONB DEFAULT '[]'::jsonb,
    responsible_department VARCHAR(100),
    responsible_role VARCHAR(100),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_steps_org ON public.production_process_steps(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_steps_feas ON public.production_process_steps(feasibility_id);

-- 13. Production Documents
CREATE TABLE IF NOT EXISTS public.production_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL CHECK (document_type IN (
        'PROCESS_DESCRIPTION',
        'MANUFACTURING_FLOW',
        'EQUIPMENT_LIST',
        'CAPACITY_SHEET',
        'MATERIAL_LIST',
        'SUPPLIER_QUOTE',
        'TECH_TRANSFER_DOC',
        'CUSTOMER_SPEC',
        'PACKAGING_SPEC',
        'VALIDATION_INFO',
        'REGULATORY_DOC'
    )),
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    version INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_docs_org ON public.production_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_docs_feas ON public.production_documents(feasibility_id);

-- 14. Enable Row Level Security (RLS)
ALTER TABLE public.production_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_technologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_feasibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_feasibility_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_capacity_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_documents ENABLE ROW LEVEL SECURITY;

-- 15. Create RLS Policies
CREATE POLICY prod_facilities_org_isolation ON public.production_facilities USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_lines_org_isolation ON public.production_lines USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_equipment_org_isolation ON public.production_equipment USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_technologies_org_isolation ON public.production_technologies USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_feasibility_org_isolation ON public.production_feasibility USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_feas_ver_org_isolation ON public.production_feasibility_versions USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_capacity_org_isolation ON public.production_capacity_allocations USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_gaps_org_isolation ON public.production_gaps USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_risks_org_isolation ON public.production_risks USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_materials_org_isolation ON public.production_materials USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_steps_org_isolation ON public.production_process_steps USING (organization_id = get_auth_user_organization_id());
CREATE POLICY prod_docs_org_isolation ON public.production_documents USING (organization_id = get_auth_user_organization_id());

-- 16. Seed Permissions for RBAC
INSERT INTO public.permissions (resource, action, code, name, category, description) VALUES
('production', 'read', 'production.read', 'View Production Feasibility', 'Production', 'Can view production feasibility assessments and facility data'),
('production', 'view', 'production.view', 'View Production Records', 'Production', 'Can view production intelligence and feasibility assessments'),
('production', 'create', 'production.create', 'Create Production Feasibility', 'Production', 'Can create new production feasibility evaluations'),
('production', 'edit', 'production.edit', 'Edit Production Feasibility', 'Production', 'Can edit production feasibility evaluations'),
('production', 'finalize', 'production.finalize', 'Finalize Production Feasibility', 'Production', 'Can finalize and lock production feasibility assessments'),
('production', 'export', 'production.export', 'Export Production Data', 'Production', 'Can export production feasibility and capacity workbooks'),
('production', 'manage_facilities', 'production.manage_facilities', 'Manage Facilities', 'Production', 'Can manage manufacturing facility masters'),
('production', 'manage_equipment', 'production.manage_equipment', 'Manage Equipment', 'Production', 'Can manage equipment and qualification records'),
('production', 'manage_capacity', 'production.manage_capacity', 'Manage Capacity', 'Production', 'Can manage line capacity and allocation planning'),
('production', 'manage_process', 'production.manage_process', 'Manage Process', 'Production', 'Can manage manufacturing process configurations'),
('production', 'manage_configuration', 'production.manage_configuration', 'Manage Production Configuration', 'Production', 'Can configure production master parameters')
ON CONFLICT (resource, action) DO UPDATE SET
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;

COMMIT;
