import fs from 'fs';
import path from 'path';

describe('Step 7 Database Migration Safety & Idempotency Suite', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/004_task_management.sql');
  let migrationSql: string;

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf8');
  });

  it('Migration file must exist and be non-empty', () => {
    expect(migrationSql.length).toBeGreaterThan(100);
  });

  it('REGRESSION FIX: Replaces unsafe CREATE INDEX with CREATE INDEX IF NOT EXISTS', () => {
    // Specifically test the reported error: relation "idx_tasks_org" already exists
    expect(migrationSql).toContain('CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id)');

    // Ensure NO bare "CREATE INDEX idx_..." exists without "IF NOT EXISTS"
    const bareCreateIndexRegex = /CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\s+)[a-zA-Z0-9_]+\s+ON/i;
    expect(bareCreateIndexRegex.test(migrationSql)).toBe(false);
  });

  it('SAFETY: Does NOT contain destructive operations (DROP TABLE, TRUNCATE, DROP SCHEMA)', () => {
    expect(migrationSql.toUpperCase()).not.toContain('DROP TABLE');
    expect(migrationSql.toUpperCase()).not.toContain('TRUNCATE');
    expect(migrationSql.toUpperCase()).not.toContain('DROP SCHEMA');
  });

  it('SAFETY: Handles existing tasks table gracefully with ADD COLUMN IF NOT EXISTS', () => {
    expect(migrationSql).toContain('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_code');
    expect(migrationSql).toContain('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS original_due_date');
    expect(migrationSql).toContain('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_due_date');
    expect(migrationSql).toContain('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_user_id');
  });

  it('SAFETY: Handles existing task_followups table with ADD COLUMN IF NOT EXISTS', () => {
    expect(migrationSql).toContain('ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS organization_id');
    expect(migrationSql).toContain('ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS response_status');
    expect(migrationSql).toContain('ALTER TABLE task_followups ADD COLUMN IF NOT EXISTS response_received');
  });

  it('IDEMPOTENCY: Safely adds UNIQUE constraints without throwing constraint already exists errors', () => {
    expect(migrationSql).toContain('tasks_org_code_unique');
    expect(migrationSql).toContain('task_followups_task_num_unique');
  });

  it('RBAC INTEGRATION: Seeds all 11 task permissions with ON CONFLICT DO UPDATE', () => {
    const requiredPermissions = [
      'tasks.read',
      'tasks.create',
      'tasks.update',
      'tasks.assign',
      'tasks.followup',
      'tasks.complete',
      'tasks.cancel',
      'tasks.reschedule',
      'tasks.export',
      'tasks.analytics',
      'tasks.admin',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(`'${perm}'`);
    }

    expect(migrationSql).toContain('ON CONFLICT (resource, action) DO UPDATE');
  });

  it('SECURITY: Enforces tenant isolation using get_auth_user_organization_id()', () => {
    expect(migrationSql).toContain('get_auth_user_organization_id()');
    expect(migrationSql).toContain('ALTER TABLE tasks ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('ALTER TABLE task_followups ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('ALTER TABLE task_timeline ENABLE ROW LEVEL SECURITY');
  });
});
