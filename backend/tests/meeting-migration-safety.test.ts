import * as fs from 'fs';
import * as path from 'path';

describe('Meeting Intelligence Platform Migration Safety & Standards (020_meeting_intelligence_platform.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/020_meeting_intelligence_platform.sql');
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

  it('enforces Row Level Security (RLS) on all new meeting tables', () => {
    const requiredRlsTables = [
      'meeting_series',
      'meeting_notes',
      'meeting_points',
      'meeting_decisions',
      'meeting_templates',
      'meeting_configurations',
      'meeting_configuration_history',
      'meeting_reminders',
    ];

    for (const table of requiredRlsTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('seeds all required meeting permissions in the RBAC engine', () => {
    const requiredPermissions = [
      'meeting.view',
      'meeting.create',
      'meeting.edit',
      'meeting.start',
      'meeting.close',
      'meeting.manage_points',
      'meeting.manage_decisions',
      'meeting.create_tasks',
      'meeting.export',
      'meeting.manage_templates',
      'meeting.manage_reminders',
      'meeting.manage_configuration',
      'meeting.view_audit',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });
});
