-- Step 6: RBAC & Configuration Engine Enhancements

-- 1. Extend Permissions Table (if needed, it already has resource, action, description)
-- We need to add 'code', 'name', 'category', 'status'
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS code VARCHAR(100) UNIQUE;
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Populate existing code if needed or just use code as the primary unique key
UPDATE permissions SET code = resource || '.' || action WHERE code IS NULL;
ALTER TABLE permissions ALTER COLUMN code SET NOT NULL;

-- 2. Configuration Engine
CREATE TABLE IF NOT EXISTS configuration_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES configuration_groups(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    data_type VARCHAR(50) NOT NULL, -- text, number, boolean, select, multi_select, date, json
    default_value TEXT,
    validation_rules JSONB,
    is_required BOOLEAN DEFAULT FALSE,
    is_system BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    metadata_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, key)
);

CREATE TABLE IF NOT EXISTS configuration_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    definition_id UUID NOT NULL REFERENCES configuration_definitions(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL means system-wide
    key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(definition_id, organization_id, key)
);

-- Fix configuration_groups (add scope, category)
ALTER TABLE configuration_groups ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE configuration_groups ADD COLUMN IF NOT EXISTS scope VARCHAR(50) DEFAULT 'ORGANIZATION';
ALTER TABLE configuration_groups ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE configuration_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE configuration_groups ADD COLUMN IF NOT EXISTS key VARCHAR(100);

-- Make configuration_groups.key unique
-- We need to populate keys if there are existing groups, but it's safe to just add the constraint if empty.
-- ALTER TABLE configuration_groups ADD CONSTRAINT config_groups_key_unique UNIQUE(key);

-- 3. Seed Permissions
INSERT INTO permissions (resource, action, code, name, category, description) VALUES 
('users', 'read', 'users.read', 'View Users', 'Administration', 'Can view users within the organization'),
('users', 'create', 'users.create', 'Create Users', 'Administration', 'Can create new users'),
('users', 'update', 'users.update', 'Update Users', 'Administration', 'Can modify user details'),
('users', 'disable', 'users.disable', 'Disable Users', 'Administration', 'Can disable users'),
('users', 'manage', 'users.manage', 'Manage Users', 'Administration', 'Full control over users'),
('roles', 'read', 'roles.read', 'View Roles', 'Administration', 'Can view roles'),
('roles', 'manage', 'roles.manage', 'Manage Roles', 'Administration', 'Can create and modify roles and permissions'),
('permissions', 'read', 'permissions.read', 'View Permissions', 'Administration', 'Can view available permissions'),
('organizations', 'read', 'organizations.read', 'View Organization', 'Administration', 'Can view organization settings'),
('organizations', 'update', 'organizations.update', 'Update Organization', 'Administration', 'Can update organization settings'),
('business_units', 'read', 'business_units.read', 'View Business Units', 'Administration', 'Can view business units'),
('business_units', 'manage', 'business_units.manage', 'Manage Business Units', 'Administration', 'Can manage business units'),
('departments', 'read', 'departments.read', 'View Departments', 'Administration', 'Can view departments'),
('departments', 'manage', 'departments.manage', 'Manage Departments', 'Administration', 'Can manage departments'),
('teams', 'read', 'teams.read', 'View Teams', 'Administration', 'Can view teams'),
('teams', 'manage', 'teams.manage', 'Manage Teams', 'Administration', 'Can manage teams'),
('locations', 'read', 'locations.read', 'View Locations', 'Administration', 'Can view locations'),
('locations', 'manage', 'locations.manage', 'Manage Locations', 'Administration', 'Can manage locations'),
('configuration', 'read', 'configuration.read', 'View Configuration', 'Settings', 'Can view system and business configuration'),
('configuration', 'manage', 'configuration.manage', 'Manage Configuration', 'Settings', 'Can modify system and business configuration'),
('audit', 'read', 'audit.read', 'View Audit Logs', 'Administration', 'Can view audit logs'),
('audit', 'export', 'audit.export', 'Export Audit Logs', 'Administration', 'Can export audit logs'),
('products', 'read', 'products.read', 'View Products', 'Products', 'Can view products'),
('products', 'create', 'products.create', 'Create Products', 'Products', 'Can create products'),
('products', 'update', 'products.update', 'Update Products', 'Products', 'Can update products'),
('opportunities', 'read', 'opportunities.read', 'View Opportunities', 'Opportunities', 'Can view opportunities'),
('opportunities', 'create', 'opportunities.create', 'Create Opportunities', 'Opportunities', 'Can create opportunities'),
('opportunities', 'update', 'opportunities.update', 'Update Opportunities', 'Opportunities', 'Can update opportunities'),
('reports', 'read', 'reports.read', 'View Reports', 'Reporting', 'Can view reports'),
('reports', 'export', 'reports.export', 'Export Reports', 'Reporting', 'Can export reports')
ON CONFLICT (resource, action) DO UPDATE SET 
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;

-- 4. Seed Role Definitions (We don't know the exact organization_id yet, so we just prepare the system roles)
-- Organizations should ideally be seeded here, but we will let the application handle role creation on org signup.
