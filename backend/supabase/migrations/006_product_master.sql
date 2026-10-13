-- Step 8: Product Master Module (Idempotent, Re-runnable & Production-Safe Migration)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Concurrency-safe sequence for product codes
CREATE SEQUENCE IF NOT EXISTS product_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION generate_next_product_code()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('product_code_seq') INTO next_val;
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'PROD-' || year_str || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Therapeutic Categories (Hierarchical: Area -> Category -> Subcategory)
CREATE TABLE IF NOT EXISTS therapeutic_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES therapeutic_categories(id) ON DELETE SET NULL,
    level INT DEFAULT 1,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Dosage Forms Master Reference
CREATE TABLE IF NOT EXISTS dosage_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'SOLID', -- SOLID, LIQUID, SEMI_SOLID, PARENTERAL, INHALATION, TOPICAL
    compatible_routes JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Routes of Administration Master Reference
CREATE TABLE IF NOT EXISTS routes_of_administration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Strength Units Master Reference
CREATE TABLE IF NOT EXISTS strength_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    unit_type VARCHAR(50) DEFAULT 'MASS', -- MASS, VOLUME, CONCENTRATION, BIOLOGICAL
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Countries Master Reference (ISO-3166)
CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    iso2 VARCHAR(2) NOT NULL UNIQUE,
    iso3 VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    subregion VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Canonical Molecules Master
CREATE TABLE IF NOT EXISTS molecules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL means global reference
    canonical_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    cas_number VARCHAR(50),
    therapeutic_category_id UUID REFERENCES therapeutic_categories(id) ON DELETE SET NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS molecule_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    molecule_id UUID NOT NULL REFERENCES molecules(id) ON DELETE CASCADE,
    alias_name VARCHAR(255) NOT NULL,
    normalized_alias VARCHAR(255) NOT NULL,
    alias_type VARCHAR(50) DEFAULT 'SYNONYM', -- SYNONYM, SALT_FORM, BRAND_REFERENCE, INN, USAN
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Canonical Products Table (Safely update if already exists from 002)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_code VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    molecule VARCHAR(255),
    molecule_id UUID REFERENCES molecules(id) ON DELETE SET NULL,
    brand_name VARCHAR(255),
    dosage_form_id UUID REFERENCES dosage_forms(id) ON DELETE SET NULL,
    strength_value NUMERIC(12, 4),
    strength_unit_id UUID REFERENCES strength_units(id) ON DELETE SET NULL,
    strength_raw VARCHAR(100),
    route_id UUID REFERENCES routes_of_administration(id) ON DELETE SET NULL,
    therapeutic_category_id UUID REFERENCES therapeutic_categories(id) ON DELETE SET NULL,
    product_type VARCHAR(100) DEFAULT 'FINISHED_DOSAGE_FORM',
    product_category VARCHAR(100) DEFAULT 'GENERIC',
    originator VARCHAR(255),
    originator_company VARCHAR(255),
    reference_product VARCHAR(255),
    description TEXT,
    lifecycle_status VARCHAR(50) DEFAULT 'ACTIVE',
    development_status VARCHAR(50) DEFAULT 'COMMERCIAL',
    country_of_origin VARCHAR(10),
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_by UUID REFERENCES user_profiles(id),
    archive_reason TEXT,
    normalized_name VARCHAR(255),
    version INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id),
    updated_by UUID REFERENCES user_profiles(id)
);

-- Alter existing products table if columns are missing
ALTER TABLE products ADD COLUMN IF NOT EXISTS molecule_id UUID REFERENCES molecules(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS strength_raw VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_category VARCHAR(100) DEFAULT 'GENERIC';
ALTER TABLE products ADD COLUMN IF NOT EXISTS originator_company VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(50) DEFAULT 'ACTIVE';
ALTER TABLE products ADD COLUMN IF NOT EXISTS development_status VARCHAR(50) DEFAULT 'COMMERCIAL';
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin VARCHAR(10);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES user_profiles(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS archive_reason TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- Backfills for existing products table
DO $$
BEGIN
    UPDATE products SET product_code = generate_next_product_code() WHERE product_code IS NULL;
    UPDATE products SET normalized_name = LOWER(REGEXP_REPLACE(product_name, '[^a-zA-Z0-9]+', ' ', 'g')) WHERE normalized_name IS NULL;
    UPDATE products SET lifecycle_status = status WHERE lifecycle_status IS NULL AND status IS NOT NULL;
    UPDATE products SET originator_company = originator WHERE originator_company IS NULL AND originator IS NOT NULL;
END $$;

ALTER TABLE products ALTER COLUMN product_code SET DEFAULT generate_next_product_code();

-- Ensure unique product_code per organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'products'::regclass AND conname IN ('products_organization_id_product_code_key', 'products_org_code_unique')
    ) THEN
        ALTER TABLE products ADD CONSTRAINT products_org_code_unique UNIQUE (organization_id, product_code);
    END IF;
END $$;

-- 9. Product Presentations Table
CREATE TABLE IF NOT EXISTS product_presentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    presentation_code VARCHAR(100),
    presentation_name VARCHAR(255) NOT NULL,
    pack_size INT,
    pack_unit VARCHAR(50) DEFAULT 'Tablets',
    packaging_type VARCHAR(100) DEFAULT 'Blister Pack',
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Product Companies Table (Origins, Manufacturers, Marketers, License Holders)
CREATE TABLE IF NOT EXISTS product_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    relationship_type VARCHAR(50) NOT NULL DEFAULT 'MANUFACTURER',
    -- ORIGINATOR, MANUFACTURER, MARKETER, LICENSE_HOLDER, DISTRIBUTOR, CONTRACT_MANUFACTURER, OTHER
    country_code VARCHAR(10),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Product Countries Applicability Table
CREATE TABLE IF NOT EXISTS product_countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    country_code VARCHAR(10) NOT NULL,
    market_status VARCHAR(50) DEFAULT 'UNDER_EVALUATION',
    -- COMMERCIAL, LAUNCH_PLANNED, UNDER_EVALUATION, NOT_PURSUED
    availability_status VARCHAR(50) DEFAULT 'ACTIVE',
    expected_launch_date DATE,
    actual_launch_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, country_code)
);

-- 12. Product Aliases Table
CREATE TABLE IF NOT EXISTS product_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alias_value VARCHAR(255) NOT NULL,
    normalized_alias VARCHAR(255) NOT NULL,
    alias_type VARCHAR(50) NOT NULL DEFAULT 'BRAND_NAME',
    -- INTERNAL_CODE, BRAND_NAME, CUSTOMER_NAME, MARKET_SPECIFIC, EXTERNAL_ID
    country_code VARCHAR(10),
    source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_molecule ON products(molecule_id);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle ON products(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_products_dosage_form ON products(dosage_form_id);
CREATE INDEX IF NOT EXISTS idx_products_route ON products(route_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(product_category);
CREATE INDEX IF NOT EXISTS idx_products_norm_name ON products(normalized_name);
CREATE INDEX IF NOT EXISTS idx_molecules_norm_name ON molecules(normalized_name);
CREATE INDEX IF NOT EXISTS idx_molecules_org ON molecules(organization_id);
CREATE INDEX IF NOT EXISTS idx_molecule_aliases_norm ON molecule_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_product_presentations_prod ON product_presentations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_companies_prod ON product_companies(product_id);
CREATE INDEX IF NOT EXISTS idx_product_countries_prod ON product_countries(product_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_prod ON product_aliases(product_id);
CREATE INDEX IF NOT EXISTS idx_product_aliases_norm ON product_aliases(normalized_alias);

-- 14. Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE molecules ENABLE ROW LEVEL SECURITY;
ALTER TABLE molecule_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dosage_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes_of_administration ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapeutic_categories ENABLE ROW LEVEL SECURITY;

-- Helper function: get_auth_user_organization_id
CREATE OR REPLACE FUNCTION get_auth_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id 
  FROM public.user_profiles 
  WHERE auth_user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies for Tenant-Owned Tables
DROP POLICY IF EXISTS products_tenant_isolation_policy ON products;
CREATE POLICY products_tenant_isolation_policy ON products
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS product_presentations_tenant_policy ON product_presentations;
CREATE POLICY product_presentations_tenant_policy ON product_presentations
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS product_companies_tenant_policy ON product_companies;
CREATE POLICY product_companies_tenant_policy ON product_companies
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS product_countries_tenant_policy ON product_countries;
CREATE POLICY product_countries_tenant_policy ON product_countries
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS product_aliases_tenant_policy ON product_aliases;
CREATE POLICY product_aliases_tenant_policy ON product_aliases
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

-- RLS Policies for Molecules (Global reference readable by all, org custom scoped)
DROP POLICY IF EXISTS molecules_read_policy ON molecules;
CREATE POLICY molecules_read_policy ON molecules
  FOR SELECT
  USING (organization_id IS NULL OR organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS molecules_write_policy ON molecules;
CREATE POLICY molecules_write_policy ON molecules
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());

DROP POLICY IF EXISTS molecule_aliases_read_policy ON molecule_aliases;
CREATE POLICY molecule_aliases_read_policy ON molecule_aliases
  FOR SELECT
  USING (TRUE);

-- Reference Tables: Read-only for authenticated users
DROP POLICY IF EXISTS dosage_forms_read_policy ON dosage_forms;
CREATE POLICY dosage_forms_read_policy ON dosage_forms FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS routes_read_policy ON routes_of_administration;
CREATE POLICY routes_read_policy ON routes_of_administration FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS strength_units_read_policy ON strength_units;
CREATE POLICY strength_units_read_policy ON strength_units FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS countries_read_policy ON countries;
CREATE POLICY countries_read_policy ON countries FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS therapeutic_categories_read_policy ON therapeutic_categories;
CREATE POLICY therapeutic_categories_read_policy ON therapeutic_categories FOR SELECT USING (TRUE);

-- 15. Seed Master Reference Data
-- Dosage Forms
INSERT INTO dosage_forms (key, name, category, compatible_routes, sort_order) VALUES
('TABLET', 'Tablet', 'SOLID', '["ORAL", "SUBLINGUAL"]'::jsonb, 1),
('FILM_COATED_TABLET', 'Film-Coated Tablet', 'SOLID', '["ORAL"]'::jsonb, 2),
('EXTENDED_RELEASE_TABLET', 'Extended Release Tablet', 'SOLID', '["ORAL"]'::jsonb, 3),
('CAPSULE', 'Capsule', 'SOLID', '["ORAL"]'::jsonb, 4),
('INJECTION_SOLUTION', 'Injection (Solution)', 'PARENTERAL', '["INTRAVENOUS", "INTRAMUSCULAR", "SUBCUTANEOUS"]'::jsonb, 5),
('PREFILLED_SYRINGE', 'Prefilled Syringe', 'PARENTERAL', '["INTRAVENOUS", "SUBCUTANEOUS"]'::jsonb, 6),
('VIAL_LYOPHILIZED', 'Lyophilized Powder for Injection (Vial)', 'PARENTERAL', '["INTRAVENOUS", "INTRAMUSCULAR"]'::jsonb, 7),
('ORAL_SUSPENSION', 'Oral Suspension', 'LIQUID', '["ORAL"]'::jsonb, 8),
('ORAL_SOLUTION', 'Oral Solution', 'LIQUID', '["ORAL"]'::jsonb, 9),
('CREAM', 'Topical Cream', 'SEMI_SOLID', '["TOPICAL"]'::jsonb, 10),
('OINTMENT', 'Topical Ointment', 'SEMI_SOLID', '["TOPICAL"]'::jsonb, 11),
('INHALER_METERED_DOSE', 'Metered Dose Inhaler', 'INHALATION', '["INHALATION"]'::jsonb, 12),
('EYE_DROPS', 'Ophthalmic Solution (Eye Drops)', 'LIQUID', '["OPHTHALMIC"]'::jsonb, 13),
('NASAL_SPRAY', 'Nasal Spray', 'LIQUID', '["NASAL"]'::jsonb, 14),
('TRANSDERMAL_PATCH', 'Transdermal Patch', 'SOLID', '["TRANSDERMAL"]'::jsonb, 15)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, compatible_routes = EXCLUDED.compatible_routes;

-- Routes of Administration
INSERT INTO routes_of_administration (key, name, description, sort_order) VALUES
('ORAL', 'Oral', 'Administered through the mouth', 1),
('INTRAVENOUS', 'Intravenous (IV)', 'Administered into a vein', 2),
('INTRAMUSCULAR', 'Intramuscular (IM)', 'Administered into a muscle', 3),
('SUBCUTANEOUS', 'Subcutaneous (SC)', 'Administered beneath the skin', 4),
('TOPICAL', 'Topical', 'Applied directly to skin or mucous membranes', 5),
('OPHTHALMIC', 'Ophthalmic', 'Applied into the eye', 6),
('INHALATION', 'Inhalation', 'Inhaled into the respiratory tract', 7),
('NASAL', 'Nasal', 'Administered into nasal cavity', 8),
('TRANSDERMAL', 'Transdermal', 'Delivered across the skin into bloodstream', 9),
('SUBLINGUAL', 'Sublingual', 'Placed under the tongue', 10)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name;

-- Strength Units
INSERT INTO strength_units (key, name, symbol, unit_type, sort_order) VALUES
('MG', 'Milligram', 'mg', 'MASS', 1),
('G', 'Gram', 'g', 'MASS', 2),
('MCG', 'Microgram', 'mcg', 'MASS', 3),
('ML', 'Milliliter', 'mL', 'VOLUME', 4),
('MG_PER_ML', 'Milligram per Milliliter', 'mg/mL', 'CONCENTRATION', 5),
('MCG_PER_ML', 'Microgram per Milliliter', 'mcg/mL', 'CONCENTRATION', 6),
('PERCENT', 'Percent (w/v or w/w)', '%', 'CONCENTRATION', 7),
('IU', 'International Unit', 'IU', 'BIOLOGICAL', 8),
('MG_PER_G', 'Milligram per Gram', 'mg/g', 'CONCENTRATION', 9)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, symbol = EXCLUDED.symbol;

-- Countries
INSERT INTO countries (iso2, iso3, name, region, subregion, sort_order) VALUES
('US', 'USA', 'United States', 'Americas', 'Northern America', 1),
('DE', 'DEU', 'Germany', 'Europe', 'Western Europe', 2),
('GB', 'GBR', 'United Kingdom', 'Europe', 'Northern Europe', 3),
('FR', 'FRA', 'France', 'Europe', 'Western Europe', 4),
('IT', 'ITA', 'Italy', 'Europe', 'Southern Europe', 5),
('ES', 'ESP', 'Spain', 'Europe', 'Southern Europe', 6),
('JP', 'JPN', 'Japan', 'Asia', 'Eastern Asia', 7),
('IN', 'IND', 'India', 'Asia', 'Southern Asia', 8),
('CA', 'CAN', 'Canada', 'Americas', 'Northern America', 9),
('AU', 'AUS', 'Australia', 'Oceania', 'Australasia', 10),
('BR', 'BRA', 'Brazil', 'Americas', 'South America', 11),
('CH', 'CHE', 'Switzerland', 'Europe', 'Western Europe', 12),
('SA', 'SAU', 'Saudi Arabia', 'Asia', 'Western Asia', 13),
('AE', 'ARE', 'United Arab Emirates', 'Asia', 'Western Asia', 14),
('ZA', 'ZAF', 'South Africa', 'Africa', 'Southern Africa', 15)
ON CONFLICT (iso2) DO UPDATE SET name = EXCLUDED.name;

-- Therapeutic Categories
INSERT INTO therapeutic_categories (code, name, level, description, sort_order) VALUES
('CARDIO', 'Cardiovascular System', 1, 'Agents acting on the cardiovascular system', 1),
('CNS', 'Central Nervous System', 1, 'Agents acting on the central nervous system', 2),
('ONCO', 'Antineoplastic & Immunomodulating', 1, 'Oncology and immunotherapy therapeutics', 3),
('INFECT', 'Anti-Infectives for Systemic Use', 1, 'Antibacterials, antivirals, and antifungals', 4),
('GASTRO', 'Alimentary Tract & Metabolism', 1, 'Gastrointestinal and metabolic therapeutics', 5),
('RESP', 'Respiratory System', 1, 'Respiratory tract therapeutics', 6),
('ENDO', 'Systemic Hormonal Preparations', 1, 'Hormones, insulins, thyroid therapies', 7)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Standard Canonical Reference Molecules
INSERT INTO molecules (canonical_name, normalized_name, cas_number, description, status) VALUES
('Atorvastatin', 'atorvastatin', '134523-00-5', 'HMG-CoA reductase inhibitor for dyslipidemia and cardiovascular prevention', 'ACTIVE'),
('Metformin', 'metformin', '657-24-9', 'Biguanide oral antihyperglycemic agent for type 2 diabetes mellitus', 'ACTIVE'),
('Pembrolizumab', 'pembrolizumab', '1374853-91-4', 'Monoclonal antibody targeting PD-1 receptor for oncology indications', 'ACTIVE'),
('Amoxicillin', 'amoxicillin', '26787-78-0', 'Beta-lactam antibiotic for bacterial infections', 'ACTIVE'),
('Paracetamol', 'paracetamol', '103-90-2', 'Analgesic and antipyretic agent', 'ACTIVE'),
('Semaglutide', 'semaglutide', '910463-68-2', 'GLP-1 receptor agonist for type 2 diabetes and obesity management', 'ACTIVE'),
('Apixaban', 'apixaban', '503612-47-3', 'Direct factor Xa inhibitor anticoagulant', 'ACTIVE'),
('Dapagliflozin', 'dapagliflozin', '461432-26-8', 'SGLT2 inhibitor for diabetes, heart failure, and chronic kidney disease', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Seed Molecule Aliases
DO $$
DECLARE
    mol_atorv UUID;
    mol_metf UUID;
    mol_pembro UUID;
    mol_parac UUID;
BEGIN
    SELECT id INTO mol_atorv FROM molecules WHERE canonical_name = 'Atorvastatin' LIMIT 1;
    IF mol_atorv IS NOT NULL THEN
        INSERT INTO molecule_aliases (molecule_id, alias_name, normalized_alias, alias_type) VALUES
        (mol_atorv, 'Atorvastatin Calcium', 'atorvastatin calcium', 'SALT_FORM'),
        (mol_atorv, 'Lipitor', 'lipitor', 'BRAND_REFERENCE'),
        (mol_atorv, 'Atorvastatine', 'atorvastatine', 'INN')
        ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO mol_metf FROM molecules WHERE canonical_name = 'Metformin' LIMIT 1;
    IF mol_metf IS NOT NULL THEN
        INSERT INTO molecule_aliases (molecule_id, alias_name, normalized_alias, alias_type) VALUES
        (mol_metf, 'Metformin Hydrochloride', 'metformin hydrochloride', 'SALT_FORM'),
        (mol_metf, 'Glucophage', 'glucophage', 'BRAND_REFERENCE')
        ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO mol_parac FROM molecules WHERE canonical_name = 'Paracetamol' LIMIT 1;
    IF mol_parac IS NOT NULL THEN
        INSERT INTO molecule_aliases (molecule_id, alias_name, normalized_alias, alias_type) VALUES
        (mol_parac, 'Acetaminophen', 'acetaminophen', 'SYNONYM'),
        (mol_parac, 'Tylenol', 'tylenol', 'BRAND_REFERENCE'),
        (mol_parac, 'APAP', 'apap', 'SYNONYM')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 16. Seed Permissions for Product Master Module
INSERT INTO permissions (resource, action, code, name, category, description) VALUES
('products', 'read', 'products.read', 'View Products', 'Products', 'Can view products, presentations, and product master references'),
('products', 'create', 'products.create', 'Create Products', 'Products', 'Can create canonical products and presentations'),
('products', 'update', 'products.update', 'Update Products', 'Products', 'Can update product specifications and mappings'),
('products', 'archive', 'products.archive', 'Archive Products', 'Products', 'Can archive and restore products'),
('products', 'manage', 'products.manage', 'Manage Product Master', 'Products', 'Can manage product presentations, companies, and countries'),
('products', 'export', 'products.export', 'Export Products', 'Products', 'Can export product master records to CSV/Excel'),
('products', 'admin', 'products.admin', 'Administer Product Master', 'Products', 'Full administrative authority over product master catalog')
ON CONFLICT (resource, action) DO UPDATE SET
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;
