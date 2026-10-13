-- 021_department_and_employee_management.sql
-- Idempotent, safe migration for Department & Employee Management

-- 1. Ensure default organization exists
INSERT INTO public.organizations (id, name, legal_name, code, status)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'BDIQ Enterprise Pharma',
    'BDIQ Global Bio-Pharmaceuticals Inc.',
    'BDIQ-HQ',
    'ACTIVE'
)
ON CONFLICT (code) DO UPDATE
SET status = 'ACTIVE', updated_at = NOW();

-- 2. Ensure departments table structure
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    business_unit_id UUID REFERENCES public.business_units(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_status ON public.departments(status);

-- 3. Ensure user_profiles table structure
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_code VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    designation VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON public.user_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_dept ON public.user_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);

-- 4. Enable Row Level Security and configure non-blocking policies
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'departments_select_policy') THEN
        CREATE POLICY "departments_select_policy" ON public.departments FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'departments_insert_policy') THEN
        CREATE POLICY "departments_insert_policy" ON public.departments FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'departments_update_policy') THEN
        CREATE POLICY "departments_update_policy" ON public.departments FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'departments' AND policyname = 'departments_delete_policy') THEN
        CREATE POLICY "departments_delete_policy" ON public.departments FOR DELETE USING (true);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_select_policy') THEN
        CREATE POLICY "user_profiles_select_policy" ON public.user_profiles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_insert_policy') THEN
        CREATE POLICY "user_profiles_insert_policy" ON public.user_profiles FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_update_policy') THEN
        CREATE POLICY "user_profiles_update_policy" ON public.user_profiles FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'user_profiles_delete_policy') THEN
        CREATE POLICY "user_profiles_delete_policy" ON public.user_profiles FOR DELETE USING (true);
    END IF;
END $$;

-- 5. Seed Permissions for Department & User Management
INSERT INTO public.permissions (resource, action, code, name, category, description) VALUES
('departments', 'read', 'departments.read', 'View Departments', 'Administration', 'Can view department directory and structure'),
('departments', 'create', 'departments.create', 'Create Departments', 'Administration', 'Can create new departments'),
('departments', 'update', 'departments.update', 'Update Departments', 'Administration', 'Can modify department metadata'),
('departments', 'delete', 'departments.delete', 'Delete Departments', 'Administration', 'Can deactivate or delete departments'),
('departments', 'upload', 'departments.upload', 'Bulk Upload Departments', 'Administration', 'Can upload department rosters via Excel/CSV'),
('users', 'upload', 'users.upload', 'Bulk Upload Users', 'Administration', 'Can upload employee rosters via Excel/CSV')
ON CONFLICT (resource, action) DO UPDATE SET
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;
