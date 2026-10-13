import * as fs from 'fs';
import * as path from 'path';

describe('Opportunity Management Migration Safety & Standards (007_opportunity_management.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/007_opportunity_management.sql');
  let migrationSql = '';

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('does not contain destructive DROP TABLE, TRUNCATE, or DROP SCHEMA commands', () => {
    const dangerousPatterns = [/DROP\s+TABLE(?!\s+IF\s+EXISTS\s+temp)/i, /TRUNCATE\s+/i, /DROP\s+SCHEMA/i];

    for (const pattern of dangerousPatterns) {
      expect(pattern.test(migrationSql)).toBe(false);
    }
  });

  it('uses IF NOT EXISTS for all table and sequence creations', () => {
    const createTableMatches = migrationSql.match(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_]+/gi);
    expect(createTableMatches).toBeNull();

    const createSeqMatches = migrationSql.match(/CREATE\s+SEQUENCE\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_]+/gi);
    expect(createSeqMatches).toBeNull();
  });

  it('uses CREATE INDEX IF NOT EXISTS for all index creation statements', () => {
    const rawIndexMatches = migrationSql.match(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_]+/gi);
    expect(rawIndexMatches).toBeNull();
  });

  it('enforces Row Level Security (RLS) policies on all tables', () => {
    const requiredRlsTables = [
      'opportunities',
      'opportunity_products',
      'opportunity_markets',
      'opportunity_customers',
      'opportunity_risks',
      'opportunity_requirements',
      'opportunity_qualification_runs',
      'opportunity_qualification_scores',
      'opportunity_decisions',
      'opportunity_comments',
      'opportunity_timeline',
    ];

    for (const table of requiredRlsTables) {
      expect(migrationSql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('seeds all 12 required opportunity permissions in the RBAC engine', () => {
    const requiredPermissions = [
      'opportunities.read',
      'opportunities.create',
      'opportunities.update',
      'opportunities.assign',
      'opportunities.stage',
      'opportunities.qualify',
      'opportunities.close',
      'opportunities.reopen',
      'opportunities.risk',
      'opportunities.export',
      'opportunities.analytics',
      'opportunities.admin',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });
});
