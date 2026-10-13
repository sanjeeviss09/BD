import * as fs from 'fs';
import * as path from 'path';

describe('Workflow Engine Migration Safety & Standards (008_workflow_engine.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/008_workflow_engine.sql');
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

  it('uses IF NOT EXISTS for all table creations', () => {
    const createTableMatches = migrationSql.match(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_]+/gi);
    expect(createTableMatches).toBeNull();
  });

  it('uses CREATE INDEX IF NOT EXISTS for all index creation statements', () => {
    const rawIndexMatches = migrationSql.match(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_]+/gi);
    expect(rawIndexMatches).toBeNull();
  });

  it('enforces Row Level Security (RLS) policies on all workflow tables', () => {
    const requiredRlsTables = [
      'workflow_definitions',
      'workflow_versions',
      'workflow_stages',
      'workflow_transitions',
      'workflow_stage_tasks',
      'workflow_instances',
      'workflow_stage_history',
    ];

    for (const table of requiredRlsTables) {
      expect(migrationSql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('seeds all required workflow permissions in the RBAC engine', () => {
    const requiredPermissions = [
      'workflow.read',
      'workflow.execute',
      'workflow.assign',
      'workflow.history',
      'workflow.analytics',
      'workflow.manage',
      'workflow.admin',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });

  it('seeds the complete standard 10-stage operational workflow without management approval', () => {
    const expectedStages = [
      'OPPORTUNITY_CREATED',
      'QUALIFICATION',
      'MARKET_INTELLIGENCE',
      'TECHNICAL_EVALUATION',
      'REGULATORY_EVALUATION',
      'PRODUCTION_FEASIBILITY',
      'COMMERCIAL_EVALUATION',
      'RFQ_CUSTOMER_ENGAGEMENT',
      'OPPORTUNITY_DECISION',
      'WON',
      'LOST',
      'ON_HOLD',
    ];

    for (const stage of expectedStages) {
      expect(migrationSql).toContain(stage);
    }

    // Explicitly verify NO management approval stage
    expect(migrationSql).not.toContain('MANAGEMENT_REVIEW');
    expect(migrationSql).not.toContain('APPROVAL');
  });
});
