import * as fs from 'fs';
import * as path from 'path';

describe('Production Feasibility Platform Migration Safety & Standards (019_production_feasibility_platform.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/019_production_feasibility_platform.sql');
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

  it('enforces Row Level Security (RLS) on all production tables', () => {
    const requiredRlsTables = [
      'production_facilities',
      'production_lines',
      'production_equipment',
      'production_technologies',
      'production_feasibility',
      'production_feasibility_versions',
      'production_capacity_allocations',
      'production_gaps',
      'production_risks',
      'production_materials',
      'production_process_steps',
      'production_documents',
    ];

    for (const table of requiredRlsTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('seeds all required production permissions in the RBAC engine', () => {
    const requiredPermissions = [
      'production.read',
      'production.view',
      'production.create',
      'production.edit',
      'production.finalize',
      'production.export',
      'production.manage_facilities',
      'production.manage_equipment',
      'production.manage_capacity',
      'production.manage_process',
      'production.manage_configuration',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });
});
