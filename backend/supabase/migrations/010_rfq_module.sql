-- Migration: 010_rfq_module.sql
-- Description: Core schema for template-driven RFQ module with hardened security and RBAC
-- Note: Replaced phantom public.users table with get_auth_user_organization_id() for RLS

BEGIN;

-- RFQ Templates
CREATE TABLE IF NOT EXISTS public.rfq_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    template_code VARCHAR(100) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'MAPPING_REQUIRED', 'VALIDATION_REQUIRED', 'ACTIVE', 'INACTIVE', 'RETIRED')),
    created_by UUID, -- Stores auth.uid()
    updated_by UUID, -- Stores auth.uid()
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, template_code)
);

CREATE INDEX IF NOT EXISTS idx_rfq_templates_org ON public.rfq_templates(organization_id);

-- RFQ Template Versions
CREATE TABLE IF NOT EXISTS public.rfq_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.rfq_templates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    version_number INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    source_file_name VARCHAR(255),
    source_file_hash VARCHAR(255),
    source_file_type VARCHAR(100),
    file_reference VARCHAR(500),
    activated_at TIMESTAMP WITH TIME ZONE,
    retired_at TIMESTAMP WITH TIME ZONE,
    created_by UUID, -- Stores auth.uid()
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_rfq_template_versions_org ON public.rfq_template_versions(organization_id);

-- RFQ Template Sheets
CREATE TABLE IF NOT EXISTS public.rfq_template_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_version_id UUID NOT NULL REFERENCES public.rfq_template_versions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    sheet_name VARCHAR(255) NOT NULL,
    sheet_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    header_row_index INTEGER DEFAULT 1,
    data_start_row_index INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rfq_template_sheets_org ON public.rfq_template_sheets(organization_id);

-- RFQ Template Fields
CREATE TABLE IF NOT EXISTS public.rfq_template_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_version_id UUID NOT NULL REFERENCES public.rfq_template_versions(id) ON DELETE CASCADE,
    sheet_id UUID REFERENCES public.rfq_template_sheets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    external_field_name VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- TEXT, NUMBER, DATE, BOOLEAN, DROPDOWN, PRODUCT_REFERENCE, etc.
    is_required BOOLEAN DEFAULT false,
    is_custom BOOLEAN DEFAULT false,
    canonical_field_name VARCHAR(255),
    display_label VARCHAR(255),
    validation_rules JSONB,
    allowed_values JSONB, -- For dropdowns
    default_value TEXT,
    field_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rfq_template_fields_org ON public.rfq_template_fields(organization_id);

-- Core RFQ Table
CREATE TABLE IF NOT EXISTS public.rfqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    rfq_number VARCHAR(100) NOT NULL,
    template_version_id UUID NOT NULL REFERENCES public.rfq_template_versions(id),
    customer_id UUID, -- Decoupled for schema modularity
    customer_name VARCHAR(255), -- Denormalized for flexibility if no company record
    rfq_date DATE NOT NULL,
    response_due_date DATE,
    validity_date DATE,
    status VARCHAR(50) DEFAULT 'DRAFT',
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    owner_id UUID, -- Stores auth.uid()
    opportunity_id UUID, -- Decoupled for schema modularity
    description TEXT,
    commercial_notes TEXT,
    technical_notes TEXT,
    regulatory_notes TEXT,
    internal_notes TEXT,
    created_by UUID, -- Stores auth.uid()
    updated_by UUID, -- Stores auth.uid()
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, rfq_number)
);

CREATE INDEX IF NOT EXISTS idx_rfqs_org_status ON public.rfqs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_rfqs_customer ON public.rfqs(customer_id);

-- RFQ Line Items
CREATE TABLE IF NOT EXISTS public.rfq_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    product_id UUID, -- Decoupled for schema modularity
    molecule_id UUID, -- Decoupled for schema modularity
    target_country VARCHAR(100),
    quantity NUMERIC,
    unit VARCHAR(50),
    required_date DATE,
    line_item_status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rfq_line_items_rfq ON public.rfq_line_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_line_items_product ON public.rfq_line_items(product_id);

-- RFQ Custom Field Values
CREATE TABLE IF NOT EXISTS public.rfq_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID REFERENCES public.rfqs(id) ON DELETE CASCADE,
    rfq_line_item_id UUID REFERENCES public.rfq_line_items(id) ON DELETE CASCADE, -- Can be attached to RFQ or Line Item
    field_id UUID NOT NULL REFERENCES public.rfq_template_fields(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    text_value TEXT,
    number_value NUMERIC,
    date_value DATE,
    boolean_value BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (rfq_id IS NOT NULL AND rfq_line_item_id IS NULL) OR 
        (rfq_id IS NULL AND rfq_line_item_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_rfq_custom_fields_rfq ON public.rfq_custom_field_values(rfq_id);
CREATE INDEX IF NOT EXISTS idx_rfq_custom_fields_line ON public.rfq_custom_field_values(rfq_line_item_id);

-- RFQ Documents
CREATE TABLE IF NOT EXISTS public.rfq_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    document_type VARCHAR(100) NOT NULL, -- ORIGINAL_RFQ, TECHNICAL_SPEC, etc.
    file_name VARCHAR(255) NOT NULL,
    file_reference VARCHAR(500) NOT NULL,
    file_hash VARCHAR(255),
    file_size BIGINT,
    uploaded_by UUID, -- Stores auth.uid()
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rfq_docs_rfq ON public.rfq_documents(rfq_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_rfq_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    CREATE TRIGGER update_rfq_templates_modtime BEFORE UPDATE ON public.rfq_templates FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_rfqs_modtime BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_rfq_line_items_modtime BEFORE UPDATE ON public.rfq_line_items FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_rfq_custom_field_values_modtime BEFORE UPDATE ON public.rfq_custom_field_values FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enable RLS
ALTER TABLE public.rfq_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_template_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies hardened to use get_auth_user_organization_id()
CREATE POLICY "Users can view their organization's rfq_templates" ON public.rfq_templates FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfq_templates" ON public.rfq_templates FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfq_templates" ON public.rfq_templates FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can view their organization's rfq_template_versions" ON public.rfq_template_versions FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfq_template_versions" ON public.rfq_template_versions FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfq_template_versions" ON public.rfq_template_versions FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can view their organization's rfq_template_sheets" ON public.rfq_template_sheets FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfq_template_sheets" ON public.rfq_template_sheets FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfq_template_sheets" ON public.rfq_template_sheets FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can view their organization's rfq_template_fields" ON public.rfq_template_fields FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfq_template_fields" ON public.rfq_template_fields FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfq_template_fields" ON public.rfq_template_fields FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can view their organization's rfqs" ON public.rfqs FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfqs" ON public.rfqs FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfqs" ON public.rfqs FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can view their organization's rfq_line_items" ON public.rfq_line_items FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfq_line_items" ON public.rfq_line_items FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfq_line_items" ON public.rfq_line_items FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can view their organization's rfq_custom_field_values" ON public.rfq_custom_field_values FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfq_custom_field_values" ON public.rfq_custom_field_values FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfq_custom_field_values" ON public.rfq_custom_field_values FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

CREATE POLICY "Users can view their organization's rfq_documents" ON public.rfq_documents FOR SELECT USING (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization's rfq_documents" ON public.rfq_documents FOR INSERT WITH CHECK (organization_id = public.get_auth_user_organization_id());
CREATE POLICY "Users can update their organization's rfq_documents" ON public.rfq_documents FOR UPDATE USING (organization_id = public.get_auth_user_organization_id());

COMMIT;
