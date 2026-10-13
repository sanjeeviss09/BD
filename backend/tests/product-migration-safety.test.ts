import * as fs from 'fs';
import * as path from 'path';

describe('Product Master Migration Safety & Standards (006_product_master.sql)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/006_product_master.sql');
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
      'products',
      'product_presentations',
      'product_companies',
      'product_countries',
      'product_aliases',
      'molecules',
      'dosage_forms',
      'routes_of_administration',
      'strength_units',
      'countries',
      'therapeutic_categories',
    ];

    for (const table of requiredRlsTables) {
      expect(migrationSql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('seeds all 7 required product permissions in the RBAC engine', () => {
    const requiredPermissions = [
      'products.read',
      'products.create',
      'products.update',
      'products.archive',
      'products.manage',
      'products.export',
      'products.admin',
    ];

    for (const perm of requiredPermissions) {
      expect(migrationSql).toContain(perm);
    }
  });
});
