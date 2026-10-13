import * as fs from 'fs';
import * as path from 'path';

describe('AI Assisted Production Feasibility Migration Safety & Standards (022_ai_assisted_production_feasibility.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/022_ai_assisted_production_feasibility.sql');
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

  it('enforces Row Level Security (RLS) on all newly created tables', () => {
    const requiredRlsTables = [
      'ai_provider_configurations',
      'facility_import_sessions',
      'production_assessment_scenarios',
      'production_cost_breakdowns',
      'assessment_decision_snapshots',
    ];

    for (const table of requiredRlsTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('seeds all required AI and Production Feasibility permissions in the RBAC engine', () => {
    const requiredPermissions = [
      'ai.manage_config',
      'ai.use_assist',
      'production.import_facilities',
      'production.evaluate_commercial',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });
});
