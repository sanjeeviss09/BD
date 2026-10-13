-- 005_seed_admin_user.sql
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/ihykbjwzferyqqzazhfk/sql)

-- 1. Confirm user in Supabase Auth to enable instant login (case-insensitive for safety)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE LOWER(email) = 'axx09@bdiq.com';

-- 2. Create the default organization
INSERT INTO organizations (id, name, code, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'BDIQ Enterprise', 'BDIQ-HQ', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- 3. Create/link the user profile for AXX09
INSERT INTO user_profiles (id, auth_user_id, organization_id, employee_code, full_name, email, status)
SELECT 
    'b0000000-0000-0000-0000-000000000001',
    u.id,
    o.id,
    'EMP-AXX09',
    'Admin AXX09',
    u.email,
    'ACTIVE'
FROM auth.users u
CROSS JOIN (SELECT id FROM organizations WHERE code = 'BDIQ-HQ' LIMIT 1) o
WHERE LOWER(u.email) = 'axx09@bdiq.com'
ON CONFLICT (organization_id, email) DO UPDATE
SET auth_user_id = EXCLUDED.auth_user_id, status = 'ACTIVE';

-- 4. Create Super Administrator role
INSERT INTO roles (id, organization_id, name, code, description, system_role, status)
SELECT
    'c0000000-0000-0000-0000-000000000001',
    o.id,
    'Super Administrator',
    'SUPER_ADMIN',
    'Full system and organization administrative access',
    TRUE,
    'ACTIVE'
FROM organizations o
WHERE o.code = 'BDIQ-HQ'
ON CONFLICT (organization_id, code) DO NOTHING;

-- 5. Grant all permissions to Super Administrator
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    r.id,
    p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 6. Assign Super Administrator role to AXX09
INSERT INTO user_roles (user_id, role_id)
SELECT 
    up.id,
    r.id
FROM user_profiles up
CROSS JOIN roles r
WHERE LOWER(up.email) = 'axx09@bdiq.com' AND r.code = 'SUPER_ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;
