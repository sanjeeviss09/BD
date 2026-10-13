import * as fs from 'fs';
import * as path from 'path';

describe('Notification Platform Migration Safety & Standards (023_enterprise_notification_system.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/023_enterprise_notification_system.sql');
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

  it('enforces Row Level Security (RLS) on new notification tables', () => {
    const requiredRlsTables = [
      'user_notification_preferences',
      'notification_delivery_logs',
    ];

    for (const table of requiredRlsTables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('seeds all required notification and meeting action permissions', () => {
    const requiredPermissions = [
      'notification.view',
      'notification.manage',
      'notification.configure',
      'meeting.live_notes',
      'meeting.review_actions',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });
});
