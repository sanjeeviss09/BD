import * as fs from 'fs';
import * as path from 'path';

describe('Department & Employee Management Migration Safety & Standards (021_department_and_employee_management.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/021_department_and_employee_management.sql');
  let migrationSql = '';

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('Migration file exists and has content', () => {
    expect(migrationSql.length).toBeGreaterThan(500);
  });

  it('does not contain destructive DROP TABLE, TRUNCATE, or DROP SCHEMA commands', () => {
    const dangerousPatterns = [/DROP\s+TABLE/i, /TRUNCATE\s+/i, /DROP\s+SCHEMA/i];

    for (const pattern of dangerousPatterns) {
      expect(pattern.test(migrationSql)).toBe(false);
    }
  });

  it('uses IF NOT EXISTS for all table creations', () => {
    const rawCreateTableMatches = migrationSql.match(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_.]+/gi);
    expect(rawCreateTableMatches).toBeNull();
  });

  it('uses CREATE INDEX IF NOT EXISTS for all index creation statements', () => {
    const rawIndexMatches = migrationSql.match(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_.]+/gi);
    expect(rawIndexMatches).toBeNull();
  });

  it('configures Row Level Security (RLS) on departments and user_profiles', () => {
    expect(migrationSql).toContain('ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;');
    expect(migrationSql).toContain('ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;');
  });

  it('seeds all required department and upload permissions in the RBAC engine', () => {
    const requiredPermissions = [
      'departments.read',
      'departments.create',
      'departments.update',
      'departments.delete',
      'departments.upload',
      'users.upload',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });
});
