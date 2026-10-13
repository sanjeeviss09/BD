-- Migration: 018_production_rfq_management.sql
-- Description: Implement full production-grade RFQ management lifecycle

BEGIN;

-- 1. Extend RFQ Table
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS rfq_type VARCHAR(50) DEFAULT 'NEW_PRODUCT';
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS source_reference TEXT;
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10);
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS confidentiality_level VARCHAR(50) DEFAULT 'STANDARD';
ALTER TABLE public.rfqs ADD COLUMN IF NOT EXISTS current_revision INTEGER DEFAULT 0;

-- Drop NOT NULL on template_version_id to allow manual RFQs without an import template
ALTER TABLE public.rfqs ALTER COLUMN template_version_id DROP NOT NULL;

-- 2. Extend RFQ Line Items
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS product_name_as_received VARCHAR(255);
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS dosage_form VARCHAR(100);
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS strength VARCHAR(100);
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS pack_size VARCHAR(100);
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS packaging VARCHAR(100);
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS annual_volume NUMERIC;
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS target_launch_date DATE;
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS customer_target_price NUMERIC;
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS production_fit VARCHAR(50) DEFAULT 'UNKNOWN';
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS regulatory_fit VARCHAR(50) DEFAULT 'UNKNOWN';
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS technical_status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE public.rfq_line_items ADD COLUMN IF NOT EXISTS commercial_status VARCHAR(50) DEFAULT 'PENDING';

-- 3. RFQ Revisions
CREATE TABLE IF NOT EXISTS public.rfq_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    change_reason TEXT,
    snapshot_data JSONB NOT NULL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rfq_id, revision_number)
);

-- 4. Technical Assessments
CREATE TABLE IF NOT EXISTS public.rfq_technical_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_line_item_id UUID NOT NULL REFERENCES public.rfq_line_items(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assessment_type VARCHAR(100) NOT NULL, -- e.g. FORMULATION, PACKAGING, ANALYTICAL
    status VARCHAR(50) DEFAULT 'PENDING',
    evidence TEXT,
    owner_id UUID,
    assessed_by UUID,
    assessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Regulatory Assessments
CREATE TABLE IF NOT EXISTS public.rfq_regulatory_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_line_item_id UUID NOT NULL REFERENCES public.rfq_line_items(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_country VARCHAR(100),
    regulatory_path VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING',
    evidence TEXT,
    owner_id UUID,
    assessed_by UUID,
    assessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Production Assessments
CREATE TABLE IF NOT EXISTS public.rfq_production_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_line_item_id UUID NOT NULL REFERENCES public.rfq_line_items(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    facility_id UUID,
    manufacturing_line VARCHAR(100),
    batch_size NUMERIC,
    estimated_batches NUMERIC,
    status VARCHAR(50) DEFAULT 'PENDING',
    evidence TEXT,
    owner_id UUID,
    assessed_by UUID,
    assessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Commercial Links
CREATE TABLE IF NOT EXISTS public.rfq_commercial_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_line_item_id UUID NOT NULL REFERENCES public.rfq_line_items(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL, -- Logical link to commercial_evaluations table
    status VARCHAR(50) DEFAULT 'LINKED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Quotations
CREATE TABLE IF NOT EXISTS public.rfq_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    quotation_number VARCHAR(100) NOT NULL,
    current_revision INTEGER DEFAULT 0,
    currency_code VARCHAR(10),
    incoterm VARCHAR(50),
    payment_terms TEXT,
    validity_date DATE,
    lead_time VARCHAR(100),
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, quotation_number)
);

-- 9. Quotation Revisions
CREATE TABLE IF NOT EXISTS public.rfq_quotation_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.rfq_quotations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(quotation_id, revision_number)
);

-- 10. Clarifications
CREATE TABLE IF NOT EXISTS public.rfq_clarifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'OPEN',
    response TEXT,
    raised_by UUID,
    assigned_to UUID,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. RFQ Events/Audit
CREATE TABLE IF NOT EXISTS public.rfq_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. RFQ Risks
CREATE TABLE IF NOT EXISTS public.rfq_risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    risk_category VARCHAR(100) NOT NULL,
    risk_level VARCHAR(50) NOT NULL,
    description TEXT,
    evidence JSONB,
    status VARCHAR(50) DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.rfq_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_technical_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_regulatory_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_production_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_commercial_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_quotation_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_clarifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_risks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY rfq_revisions_org_isolation ON public.rfq_revisions USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_tech_assess_org_isolation ON public.rfq_technical_assessments USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_reg_assess_org_isolation ON public.rfq_regulatory_assessments USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_prod_assess_org_isolation ON public.rfq_production_assessments USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_comm_eval_org_isolation ON public.rfq_commercial_evaluations USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_quotations_org_isolation ON public.rfq_quotations USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_quot_revs_org_isolation ON public.rfq_quotation_revisions USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_clarifications_org_isolation ON public.rfq_clarifications USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_events_org_isolation ON public.rfq_events USING (organization_id = get_auth_user_organization_id());
CREATE POLICY rfq_risks_org_isolation ON public.rfq_risks USING (organization_id = get_auth_user_organization_id());

-- Triggers for updated_at
CREATE TRIGGER update_rfq_tech_assess_modtime BEFORE UPDATE ON public.rfq_technical_assessments FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
CREATE TRIGGER update_rfq_reg_assess_modtime BEFORE UPDATE ON public.rfq_regulatory_assessments FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
CREATE TRIGGER update_rfq_prod_assess_modtime BEFORE UPDATE ON public.rfq_production_assessments FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
CREATE TRIGGER update_rfq_quotations_modtime BEFORE UPDATE ON public.rfq_quotations FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
CREATE TRIGGER update_rfq_clarifications_modtime BEFORE UPDATE ON public.rfq_clarifications FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();
CREATE TRIGGER update_rfq_risks_modtime BEFORE UPDATE ON public.rfq_risks FOR EACH ROW EXECUTE FUNCTION update_rfq_updated_at_column();

COMMIT;
