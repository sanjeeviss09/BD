import * as fs from 'fs';
import * as path from 'path';
import {
  SettingsService,
  GeneralSettingsSchema,
  ProductMasterSettingsSchema,
  TaskSettingsSchema,
  MeetingSettingsSchema,
  PlatformDefaults,
} from '../src/services/settings.service';
import { ValidationError, NotFoundError } from '../src/utils/errors';

describe('BDIQ Central Settings & Configuration Architecture (Phase 1)', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/028_central_platform_settings_and_feature_registry.sql');
  let migrationSql = '';

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  describe('1. Migration 028 Safety & Governance Standards', () => {
    it('migration file exists and has substantial content', () => {
      expect(migrationSql.length).toBeGreaterThan(1000);
    });

    it('contains ZERO destructive DROP TABLE, TRUNCATE, or DROP SCHEMA commands', () => {
      const dangerousPatterns = [/DROP\s+TABLE/i, /TRUNCATE\s+/i, /DROP\s+SCHEMA/i];
      for (const pattern of dangerousPatterns) {
        expect(pattern.test(migrationSql)).toBe(false);
      }
    });

    it('uses CREATE TABLE IF NOT EXISTS for all table creations', () => {
      const rawCreateTableMatches = migrationSql.match(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_.]+/gi);
      expect(rawCreateTableMatches).toBeNull();
    });

    it('uses CREATE INDEX IF NOT EXISTS for all index creation statements', () => {
      const rawIndexMatches = migrationSql.match(/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)[a-zA-Z_.]+/gi);
      expect(rawIndexMatches).toBeNull();
    });

    it('enforces Row Level Security (RLS) on all configuration tables', () => {
      const requiredRlsTables = [
        'platform_features',
        'tenant_feature_overrides',
        'platform_settings',
        'configuration_snapshots',
      ];
      for (const table of requiredRlsTables) {
        expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      }
    });

    it('seeds all 19 functional domains discovered in Phase Zero audit', () => {
      const domainIds = [
        'executive_dashboard',
        'product_master',
        'opportunity_management',
        'task_management',
        'responsibility_engine',
        'workflow_engine',
        'market_intelligence',
        'customer_intelligence',
        'regulatory_intelligence',
        'production_feasibility',
        'cdmo_benchmarking',
        'rfq_management',
        'commercial_evaluation',
        'meeting_intelligence',
        'notification_system',
        'department_management',
        'role_security',
        'ai_orchestrator',
        'reports_and_exports',
      ];
      for (const domain of domainIds) {
        expect(migrationSql).toContain(`'${domain}'`);
      }
    });
  });

  describe('2. Zod Schema Validation Engine', () => {
    it('validates GeneralSettingsSchema with safe defaults', () => {
      const parsed = GeneralSettingsSchema.parse({});
      expect(parsed.platform_name).toBe('BDIQ Enterprise OS');
      expect(parsed.default_timezone).toBe('UTC');
      expect(parsed.currency).toBe('USD');
      expect(parsed.pagination_limit).toBe(20);
      expect(parsed.table_density).toBe('COMFORTABLE');
    });

    it('rejects invalid GeneralSettings values', () => {
      expect(() => {
        GeneralSettingsSchema.parse({ pagination_limit: 200 }); // Max is 100
      }).toThrow();

      expect(() => {
        GeneralSettingsSchema.parse({ table_density: 'ULTRA_COMPACT' }); // Invalid enum
      }).toThrow();
    });

    it('validates ProductMasterSettingsSchema dosage forms and duplicate rules', () => {
      const parsed = ProductMasterSettingsSchema.parse({});
      expect(parsed.allowed_dosage_forms).toContain('TABLET');
      expect(parsed.allowed_dosage_forms).toContain('CAPSULE');
      expect(parsed.auto_duplicate_detection).toBe(true);
    });

    it('validates TaskSettingsSchema immutable due date and SLA rules', () => {
      const parsed = TaskSettingsSchema.parse({});
      expect(parsed.immutable_original_due_date).toBe(true);
      expect(parsed.sla_calendar_type).toBe('BUSINESS_DAYS');
      expect(parsed.escalation_delay_hours).toBe(48);
    });

    it('validates MeetingSettingsSchema action items require explicit confirmation', () => {
      const parsed = MeetingSettingsSchema.parse({});
      expect(parsed.auto_create_tasks_from_action_points).toBe(false);
      expect(parsed.mini_notes_enabled).toBe(true);
    });
  });

  describe('3. SettingsService Precedence, Feature Registry & Lifecycle', () => {
    const mockSupabase: any = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    const testOrgId = 'test-org-12345';
    const testUserId = 'test-user-67890';
    let service: SettingsService;

    beforeEach(() => {
      service = new SettingsService(mockSupabase, testOrgId, testUserId);
    });

    it('resolves effective settings across all modules with platform defaults', async () => {
      const effective = await service.getEffectiveSettings();
      expect(effective.general).toBeDefined();
      expect(effective.product_master).toBeDefined();
      expect(effective.task_management).toBeDefined();
      expect(effective.market_intelligence).toBeDefined();
      expect(effective.general.platform_name).toBe('BDIQ Enterprise OS');
    });

    it('updates module settings and merges with defaults', async () => {
      const updated = await service.updateModuleSettings('general', {
        platform_name: 'PharmaCorp Global BDIQ',
        currency: 'EUR',
        table_density: 'COMPACT',
      });

      expect(updated.platform_name).toBe('PharmaCorp Global BDIQ');
      expect(updated.currency).toBe('EUR');
      expect(updated.table_density).toBe('COMPACT');

      const effectiveGeneral = await service.getEffectiveSettings('general');
      expect(effectiveGeneral.platform_name).toBe('PharmaCorp Global BDIQ');
      expect(effectiveGeneral.currency).toBe('EUR');
    });

    it('returns the feature registry with all 19 functional domains', async () => {
      const features = await service.getFeatures();
      expect(features.length).toBeGreaterThanOrEqual(19);

      const prodMaster = features.find(f => f.id === 'product_master');
      expect(prodMaster).toBeDefined();
      expect(prodMaster.tier).toBe('ESSENTIAL');

      const marketIntel = features.find(f => f.id === 'market_intelligence');
      expect(marketIntel).toBeDefined();
      expect(marketIntel.tier).toBe('OPTIONAL');
    });

    it('PROTECTS ESSENTIAL FEATURES: prevents deactivating core modules', async () => {
      await expect(service.toggleFeature('product_master', false)).rejects.toThrow(ValidationError);
      await expect(service.toggleFeature('task_management', false)).rejects.toThrow(ValidationError);
      await expect(service.toggleFeature('executive_dashboard', false)).rejects.toThrow(ValidationError);
    });

    it('DEPENDENCY PROTECTION: prevents disabling features when active features depend on them', async () => {
      // cdmo_benchmarking depends on production_feasibility
      await expect(service.toggleFeature('production_feasibility', false)).rejects.toThrow(ValidationError);
    });

    it('allows toggling optional standalone features safely without data deletion', async () => {
      const res = await service.toggleFeature('ai_orchestrator', false);
      expect(res.is_enabled).toBe(false);
      expect(res.message).toContain('All historical data remains preserved');

      // Re-enable
      const reEnable = await service.toggleFeature('ai_orchestrator', true);
      expect(reEnable.is_enabled).toBe(true);
    });

    it('publishes configuration snapshots with version increments and audit summary', async () => {
      const snap1 = await service.publishSnapshot('Initial tenant configuration baseline');
      expect(snap1.version).toBe(1);
      expect(snap1.change_summary).toBe('Initial tenant configuration baseline');
      expect(snap1.snapshot_json.settings).toBeDefined();

      const snap2 = await service.publishSnapshot('Updated market intelligence parameters');
      expect(snap2.version).toBe(2);

      const history = await service.getSnapshots();
      expect(history.length).toBe(2);
      expect(history[0].version).toBe(2);
      expect(history[1].version).toBe(1);
    });

    it('supports safe rollback to previous configuration versions', async () => {
      const rolledBack = await service.rollbackSnapshot(1);
      expect(rolledBack.version).toBe(3);
      expect(rolledBack.change_summary).toContain('Rollback to Version 1');
    });

    it('provides real platform health and diagnostics metrics', async () => {
      const health = await service.getPlatformHealth();
      expect(health.status).toBeDefined();
      expect(health.features.total).toBeGreaterThanOrEqual(19);
      expect(health.features.enabled).toBeGreaterThan(0);
      expect(health.database.provider).toBe('Supabase PostgreSQL');
      expect(health.integrations.iqvia_market_intelligence).toBeDefined();
    });
  });
});
