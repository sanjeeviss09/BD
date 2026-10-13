-- Step 9: Opportunity Management Module (Idempotent, Re-runnable & Production-Safe Migration)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Concurrency-safe sequence for opportunity codes
CREATE SEQUENCE IF NOT EXISTS opportunity_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_opportunity_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('opportunity_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'OPP-' || year_str || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Enhance Existing Opportunities Table
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_code VARCHAR(100) NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- Made nullable for multi-product support
    title VARCHAR(255) NOT NULL,
    description TEXT,
    opportunity_type VARCHAR(100) DEFAULT 'NEW_PRODUCT_DEVELOPMENT',
    source VARCHAR(100) DEFAULT 'CUSTOMER',
    owner_id UUID REFERENCES user_profiles(id),
    department_id UUID,
    team_id UUID,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    stage VARCHAR(50) DEFAULT 'IDENTIFIED',
    status VARCHAR(50) DEFAULT 'OPEN',
    estimated_value NUMERIC(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    probability INT DEFAULT 10 CHECK (probability >= 0 AND probability <= 100),
    strategic_priority VARCHAR(50) DEFAULT 'MEDIUM',
    risk_level VARCHAR(50) DEFAULT 'LOW',
    qualification_status VARCHAR(50) DEFAULT 'NOT_EVALUATED',
    qualification_score NUMERIC(5, 2),
    expected_decision_date DATE,
    target_launch_date DATE,
    target_market_date DATE,
    next_action TEXT,
    next_action_date DATE,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_reason TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    version INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id),
    updated_by UUID REFERENCES user_profiles(id)
);

-- Safely alter opportunities table if columns are missing
ALTER TABLE opportunities ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS department_id UUID;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS strategic_priority VARCHAR(50) DEFAULT 'MEDIUM';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'LOW';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(50) DEFAULT 'NOT_EVALUATED';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS qualification_score NUMERIC(5, 2);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS expected_decision_date DATE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS target_launch_date DATE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS target_market_date DATE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS next_action_date DATE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS closed_reason TEXT;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- Backfill codes and defaults
DO $$
BEGIN
    UPDATE opportunities SET opportunity_code = generate_next_opportunity_code() WHERE opportunity_code IS NULL;
    UPDATE opportunities SET status = 'OPEN' WHERE status = 'ACTIVE' OR status IS NULL;
    UPDATE opportunities SET stage = 'IDENTIFIED' WHERE stage IS NULL;
    UPDATE opportunities SET probability = 10 WHERE probability IS NULL;
    UPDATE opportunities SET target_launch_date = expected_launch_date WHERE target_launch_date IS NULL AND expected_launch_date IS NOT NULL;
    UPDATE opportunities SET target_market_date = target_date WHERE target_market_date IS NULL AND target_date IS NOT NULL;
END $$;

ALTER TABLE opportunities ALTER COLUMN opportunity_code SET DEFAULT generate_next_opportunity_code();

-- Ensure unique opportunity_code per organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'opportunities'::regclass AND conname IN ('opportunities_organization_id_opportunity_code_key', 'opportunities_org_code_unique')
    ) THEN
        ALTER TABLE opportunities ADD CONSTRAINT opportunities_org_code_unique UNIQUE (organization_id, opportunity_code);
    END IF;
END $$;

-- 3. Opportunity Products Relationship (Multi-Product Support)
CREATE TABLE IF NOT EXISTS opportunity_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'PRIMARY_PRODUCT',
    -- PRIMARY_PRODUCT, SECONDARY_PRODUCT, ALTERNATIVE_PRODUCT, REFERENCE_PRODUCT, COMPETITOR_PRODUCT, RELATED_PRODUCT
    is_primary BOOLEAN DEFAULT FALSE,
    quantity_or_scope TEXT,
    notes TEXT,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(opportunity_id, product_id)
);

-- Backfill primary product relationship from opportunities table
DO $$
BEGIN
    INSERT INTO opportunity_products (organization_id, opportunity_id, product_id, relationship_type, is_primary)
    SELECT organization_id, id, product_id, 'PRIMARY_PRODUCT', TRUE
    FROM opportunities
    WHERE product_id IS NOT NULL
    ON CONFLICT (opportunity_id, product_id) DO UPDATE SET is_primary = TRUE;
END $$;

-- 4. Opportunity Markets / Countries
CREATE TABLE IF NOT EXISTS opportunity_markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    country_code VARCHAR(10) NOT NULL,
    market_role VARCHAR(50) DEFAULT 'PRIMARY',
    -- PRIMARY, SECONDARY, EXPANSION, REFERENCE
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    target_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(opportunity_id, country_code)
);

-- 5. Opportunity Customers (Extension point)
CREATE TABLE IF NOT EXISTS opportunity_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_type VARCHAR(50) DEFAULT 'PROSPECT',
    -- CUSTOMER, PROSPECT, PARTNER, DISTRIBUTOR, OTHER
    contact_person VARCHAR(255),
    contact_email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Opportunity Risks
CREATE TABLE IF NOT EXISTS opportunity_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    risk_type VARCHAR(50) NOT NULL,
    -- TECHNICAL, REGULATORY, COMMERCIAL, CUSTOMER, SUPPLY, MANUFACTURING, TIMELINE, COMPETITIVE, FINANCIAL, STRATEGIC
    severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT NOT NULL,
    mitigation TEXT,
    owner_id UUID REFERENCES user_profiles(id),
    status VARCHAR(50) DEFAULT 'OPEN',
    -- OPEN, MITIGATED, ACCEPTED, CLOSED
    target_resolution_date DATE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Opportunity Requirements
CREATE TABLE IF NOT EXISTS opportunity_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    requirement_type VARCHAR(50) NOT NULL,
    -- TECHNICAL, REGULATORY, COMMERCIAL, CUSTOMER, PACKAGING, SUPPLY, TIMELINE
    description TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    status VARCHAR(50) DEFAULT 'PENDING',
    -- PENDING, IN_REVIEW, MET, WAIVED
    owner_id UUID REFERENCES user_profiles(id),
    due_date DATE,
    source VARCHAR(100),
    evidence TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Opportunity Qualification Runs & Scores
CREATE TABLE IF NOT EXISTS opportunity_qualification_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    score NUMERIC(5, 2) NOT NULL,
    result VARCHAR(50) NOT NULL,
    -- QUALIFIED, CONDITIONAL, NOT_QUALIFIED
    completed_by UUID REFERENCES user_profiles(id),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunity_qualification_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qualification_run_id UUID NOT NULL REFERENCES opportunity_qualification_runs(id) ON DELETE CASCADE,
    criterion_key VARCHAR(100) NOT NULL,
    criterion_name VARCHAR(255) NOT NULL,
    score NUMERIC(5, 2) NOT NULL,
    weight NUMERIC(5, 2) NOT NULL,
    weighted_score NUMERIC(5, 2) NOT NULL,
    comment TEXT,
    evidence_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Opportunity Decisions History
CREATE TABLE IF NOT EXISTS opportunity_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    decision VARCHAR(50) NOT NULL,
    -- QUALIFIED, REJECTED, ON_HOLD, WON, LOST, CANCELLED
    reason VARCHAR(100),
    comment TEXT,
    decision_by UUID REFERENCES user_profiles(id),
    decision_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Opportunity Comments
CREATE TABLE IF NOT EXISTS opportunity_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Opportunity Timeline
CREATE TABLE IF NOT EXISTS opportunity_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES user_profiles(id),
    description TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Indexes for Fast Filtering and Search
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(organization_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_code ON opportunities(opportunity_code);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner ON opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_priority ON opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_opportunities_prob ON opportunities(probability);
CREATE INDEX IF NOT EXISTS idx_opportunities_val ON opportunities(estimated_value);
CREATE INDEX IF NOT EXISTS idx_opportunity_products_opp ON opportunity_products(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_products_prod ON opportunity_products(product_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_markets_opp ON opportunity_markets(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_risks_opp ON opportunity_risks(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_reqs_opp ON opportunity_requirements(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_qual_runs_opp ON opportunity_qualification_runs(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_timeline_opp ON opportunity_timeline(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_comments_opp ON opportunity_comments(opportunity_id);

-- 13. Row-Level Security (RLS)
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_qualification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_qualification_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_timeline ENABLE ROW LEVEL SECURITY;

-- Helper function: get_auth_user_organization_id
CREATE OR REPLACE FUNCTION get_auth_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id 
  FROM public.user_profiles 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies
DROP POLICY IF EXISTS opportunities_tenant_policy ON opportunities;
CREATE POLICY opportunities_tenant_policy ON opportunities
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_products_tenant_policy ON opportunity_products;
CREATE POLICY opportunity_products_tenant_policy ON opportunity_products
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_markets_tenant_policy ON opportunity_markets;
CREATE POLICY opportunity_markets_tenant_policy ON opportunity_markets
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_customers_tenant_policy ON opportunity_customers;
CREATE POLICY opportunity_customers_tenant_policy ON opportunity_customers
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_risks_tenant_policy ON opportunity_risks;
CREATE POLICY opportunity_risks_tenant_policy ON opportunity_risks
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_reqs_tenant_policy ON opportunity_requirements;
CREATE POLICY opportunity_reqs_tenant_policy ON opportunity_requirements
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_qual_runs_tenant_policy ON opportunity_qualification_runs;
CREATE POLICY opportunity_qual_runs_tenant_policy ON opportunity_qualification_runs
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_qual_scores_policy ON opportunity_qualification_scores;
CREATE POLICY opportunity_qual_scores_policy ON opportunity_qualification_scores
  FOR ALL
  USING (TRUE);

DROP POLICY IF EXISTS opportunity_decisions_tenant_policy ON opportunity_decisions;
CREATE POLICY opportunity_decisions_tenant_policy ON opportunity_decisions
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_comments_tenant_policy ON opportunity_comments;
CREATE POLICY opportunity_comments_tenant_policy ON opportunity_comments
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS opportunity_timeline_tenant_policy ON opportunity_timeline;
CREATE POLICY opportunity_timeline_tenant_policy ON opportunity_timeline
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

-- 14. Seed RBAC Permissions for Opportunity Management
INSERT INTO permissions (resource, action, code, name, category, description) VALUES
('opportunities', 'read', 'opportunities.read', 'View Opportunities', 'Opportunities', 'Can view business opportunities, pipeline, and evaluations'),
('opportunities', 'create', 'opportunities.create', 'Create Opportunities', 'Opportunities', 'Can create new commercial and development opportunities'),
('opportunities', 'update', 'opportunities.update', 'Update Opportunities', 'Opportunities', 'Can modify opportunity details, requirements, and markets'),
('opportunities', 'assign', 'opportunities.assign', 'Assign Opportunities', 'Opportunities', 'Can assign or reassign opportunity owner and team'),
('opportunities', 'stage', 'opportunities.stage', 'Transition Stages', 'Opportunities', 'Can transition opportunity stages in the BD workflow'),
('opportunities', 'qualify', 'opportunities.qualify', 'Qualify Opportunities', 'Opportunities', 'Can execute opportunity qualification criteria and scoring'),
('opportunities', 'close', 'opportunities.close', 'Close Opportunities', 'Opportunities', 'Can mark opportunity as Won, Lost, or Cancelled'),
('opportunities', 'reopen', 'opportunities.reopen', 'Reopen Opportunities', 'Opportunities', 'Can reopen closed or cancelled opportunities'),
('opportunities', 'risk', 'opportunities.risk', 'Manage Opportunity Risks', 'Opportunities', 'Can add, update, and mitigate opportunity risks'),
('opportunities', 'export', 'opportunities.export', 'Export Opportunities', 'Opportunities', 'Can export opportunity pipeline data to CSV/Excel'),
('opportunities', 'analytics', 'opportunities.analytics', 'Opportunity Analytics', 'Opportunities', 'Can access executive pipeline and commercial analytics'),
('opportunities', 'admin', 'opportunities.admin', 'Administer Opportunities', 'Opportunities', 'Full administrative authority over opportunities workflow')
ON CONFLICT (resource, action) DO UPDATE SET
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;
