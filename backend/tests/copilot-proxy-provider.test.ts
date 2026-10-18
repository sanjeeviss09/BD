import * as fs from 'fs';
import * as path from 'path';
import { CopilotProxyService } from '../src/services/copilot-proxy.service';
import { AIProviderService } from '../src/services/ai-provider.service';
import { createSupabaseClientForUser } from '../src/db/supabase';

describe('BDIQ Phase 2: Copilot Proxy AI Provider Integration Test Suite', () => {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/030_copilot_proxy_ai_provider.sql');
  let migrationSql = '';

  const mockOrgId = 'a0000000-0000-0000-0000-000000000001';
  const mockUserId = 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed';
  const mockSupabase = createSupabaseClientForUser({} as any);

  const originalFetch = global.fetch;

  beforeAll(() => {
    migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('1. Migration 030 Safety & Governance Standards', () => {
    it('migration file exists and contains additive changes', () => {
      expect(migrationSql.length).toBeGreaterThan(200);
    });

    it('contains ZERO destructive DROP TABLE, TRUNCATE, or DROP SCHEMA commands', () => {
      const dangerousPatterns = [/DROP\s+TABLE/i, /TRUNCATE\s+/i, /DROP\s+SCHEMA/i];
      for (const pattern of dangerousPatterns) {
        expect(pattern.test(migrationSql)).toBe(false);
      }
    });

    it('adds COPILOT_PROXY to provider check constraint safely', () => {
      expect(migrationSql).toContain('COPILOT_PROXY');
      expect(migrationSql).toContain('ADD CONSTRAINT ai_provider_configurations_provider_name_check');
    });

    it('adds dynamic discovery and capability columns with IF NOT EXISTS', () => {
      expect(migrationSql).toContain('discovered_models');
      expect(migrationSql).toContain('verified_capabilities');
      expect(migrationSql).toContain('embedding_dimensions');
      expect(migrationSql).toContain('max_concurrency');
      expect(migrationSql).toContain('request_timeout_seconds');
      expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS');
    });
  });

  describe('2. Secret Redaction & Token Protection', () => {
    it('redacts GitHub user tokens (ghu_...) from messages and logs', () => {
      const raw = 'Failed to connect with token ghu_ABC123456789xyzSecretKey123 to proxy.';
      const redacted = CopilotProxyService.redactSecrets(raw);
      expect(redacted).not.toContain('ghu_ABC123456789xyzSecretKey123');
      expect(redacted).toContain('ghu_***[REDACTED]***');
    });

    it('redacts GitHub personal access tokens (ghp_...) from messages', () => {
      const raw = 'Authentication error using ghp_9876543210zyxwvutsrqponmlkjihgfedcba';
      const redacted = CopilotProxyService.redactSecrets(raw);
      expect(redacted).not.toContain('ghp_9876543210zyxwvutsrqponmlkjihgfedcba');
      expect(redacted).toContain('ghp_***[REDACTED]***');
    });

    it('redacts Bearer tokens and OpenAI style keys', () => {
      const raw = 'Bearer ghu_token_here with api key sk-1234567890abcdef123456';
      const redacted = CopilotProxyService.redactSecrets(raw);
      expect(redacted).not.toContain('ghu_token_here');
      expect(redacted).not.toContain('sk-1234567890abcdef123456');
    });

    it('handles empty or non-string inputs safely', () => {
      expect(CopilotProxyService.redactSecrets('')).toBe('');
      expect(CopilotProxyService.redactSecrets(null as any)).toBe('');
      expect(CopilotProxyService.redactSecrets(undefined as any)).toBe('');
    });
  });

  describe('3. Base URL Resolution & Endpoint Handling', () => {
    it('resolves default localhost:4141/v1 when no custom endpoint provided', () => {
      const url = CopilotProxyService.resolveBaseUrl();
      expect(url).toBe('http://127.0.0.1:4141/v1');
    });

    it('normalizes custom URLs by stripping trailing slashes and ensuring /v1 path', () => {
      expect(CopilotProxyService.resolveBaseUrl('http://proxy.internal:4141/')).toBe('http://proxy.internal:4141/v1');
      expect(CopilotProxyService.resolveBaseUrl('http://proxy.internal:4141/v1/')).toBe('http://proxy.internal:4141/v1');
      expect(CopilotProxyService.resolveBaseUrl('http://proxy.internal:4141')).toBe('http://proxy.internal:4141/v1');
    });
  });

  describe('4. Model Discovery (/v1/models)', () => {
    let service: CopilotProxyService;

    beforeEach(() => {
      service = new CopilotProxyService();
    });

    it('rejects discovery when API key is missing', async () => {
      const res = await service.discoverModels('');
      expect(res.success).toBe(false);
      expect(res.models).toEqual([]);
      expect(res.error).toContain('access token is required');
    });

    it('successfully parses models list from standard OpenAI-compatible response', async () => {
      const mockModelsResponse = {
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'github' },
          { id: 'claude-3-5-sonnet', object: 'model', owned_by: 'github' },
          { id: 'o1-preview', object: 'model', owned_by: 'github' },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockModelsResponse),
        json: async () => mockModelsResponse,
      }) as any;

      const res = await service.discoverModels('ghu_mock_token_12345678');
      expect(res.success).toBe(true);
      expect(res.models).toEqual(['claude-3-5-sonnet', 'gpt-4o', 'o1-preview']);
      expect(res.rawModels?.length).toBe(3);
    });

    it('handles connection refusal gracefully when proxy is offline', async () => {
      const connErr: any = new Error('fetch failed');
      connErr.code = 'ECONNREFUSED';

      global.fetch = jest.fn().mockRejectedValue(connErr) as any;

      const res = await service.discoverModels('ghu_mock_token_12345678');
      expect(res.success).toBe(false);
      expect(res.models).toEqual([]);
      expect(res.error).toContain('Copilot API proxy is unreachable');
    });

    it('handles discovery timeout (AbortError)', async () => {
      const abortErr: any = new Error('The operation was aborted');
      abortErr.name = 'AbortError';

      global.fetch = jest.fn().mockRejectedValue(abortErr) as any;

      const res = await service.discoverModels('ghu_mock_token_12345678');
      expect(res.success).toBe(false);
      expect(res.error).toContain('timed out');
    });
  });

  describe('5. Runtime Capability Verification (Chat, Structured Output & Embeddings)', () => {
    let service: CopilotProxyService;

    beforeEach(() => {
      service = new CopilotProxyService();
    });

    it('correctly detects verified chat, structured JSON and embeddings capabilities', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/chat/completions')) {
          const body = {
            choices: [{ message: { content: '{"ping": "pong", "verified": true}' } }],
            model: 'gpt-4o',
          };
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(body),
            json: async () => body,
          });
        }
        if (url.includes('/embeddings')) {
          const body = {
            data: [{ embedding: new Array(1536).fill(0.01) }],
          };
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(body),
            json: async () => body,
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }) as any;

      const probe = await service.verifyCapabilities('ghu_valid_key_12345678', 'gpt-4o');
      expect(probe.success).toBe(true);
      expect(probe.capabilities.chat).toBe(true);
      expect(probe.capabilities.structuredOutput).toBe(true);
      expect(probe.capabilities.embeddings).toBe(true);
      expect(probe.capabilities.embeddingDimensions).toBe(1536);
      expect(probe.message).toContain('OK');
    });

    it('tolerates unsupported embeddings gracefully without failing chat capability', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/chat/completions')) {
          const body = {
            choices: [{ message: { content: '{"status": "ok"}' } }],
            model: 'claude-3-5-sonnet',
          };
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(body),
            json: async () => body,
          });
        }
        if (url.includes('/embeddings')) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: async () => '{"error": {"message": "Not supported"}}',
            json: async () => ({ error: { message: 'Not supported' } }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      }) as any;

      const probe = await service.verifyCapabilities('ghu_valid_key_12345678', 'claude-3-5-sonnet');
      expect(probe.success).toBe(true);
      expect(probe.capabilities.chat).toBe(true);
      expect(probe.capabilities.structuredOutput).toBe(true);
      expect(probe.capabilities.embeddings).toBe(false);
      expect(probe.capabilities.embeddingDimensions).toBeUndefined();
      expect(probe.message).toContain('Embeddings: NOT_SUPPORTED');
    });
  });

  describe('6. Request Bounding, Transient Retries & Concurrency Controls', () => {
    let service: CopilotProxyService;

    beforeEach(() => {
      service = new CopilotProxyService();
    });

    it('rejects requests exceeding the 32KB payload size bound', async () => {
      const hugeContent = 'X'.repeat(35000); // 35KB
      await expect(
        service.chatCompletion('ghu_token', 'gpt-4o', [{ role: 'user', content: hugeContent }])
      ).rejects.toThrow('Request payload exceeds maximum allowed size');
    });

    it('retries once on transient 429 rate limit and succeeds on retry', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            text: async () => '{"error": {"message": "Rate limit exceeded"}}',
            json: async () => ({ error: { message: 'Rate limit exceeded' } }),
          });
        }
        const body = {
          choices: [{ message: { content: 'Recovered after backoff' } }],
          model: 'gpt-4o',
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify(body),
          json: async () => body,
        });
      }) as any;

      const res = await service.chatCompletion('ghu_token', 'gpt-4o', [{ role: 'user', content: 'Hello' }]);
      expect(callCount).toBe(2);
      expect(res.content).toBe('Recovered after backoff');
    });

    it('does NOT retry on permanent 400 Bad Request client errors', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          text: async () => '{"error": {"message": "Invalid model parameter"}}',
          json: async () => ({ error: { message: 'Invalid model parameter' } }),
        });
      }) as any;

      await expect(
        service.chatCompletion('ghu_token', 'gpt-4o', [{ role: 'user', content: 'Bad payload' }])
      ).rejects.toThrow('Invalid model parameter');
      expect(callCount).toBe(1);
    });

    it('supports object argument signature returning string content', async () => {
      const body = {
        choices: [{ message: { content: '{"answer": 42}' } }],
        model: 'gpt-4o',
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(body),
        json: async () => body,
      }) as any;

      const content = await service.chatCompletion({
        apiKey: 'ghu_token',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Calculate answer' }],
        response_format: { type: 'json_object' },
      });

      expect(typeof content).toBe('string');
      expect(content).toBe('{"answer": 42}');
    });
  });

  describe('7. Central AI Provider Orchestration Integration', () => {
    let aiService: AIProviderService;
    let mockSupabaseLocal: any;
    let storedConfig: any = null;

    beforeEach(() => {
      storedConfig = null;
      mockSupabaseLocal = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockImplementation(async () => ({ data: storedConfig, error: null })),
          single: jest.fn().mockImplementation(async () => ({ data: storedConfig, error: null })),
          upsert: jest.fn().mockImplementation((payload) => {
            storedConfig = {
              id: 'cfg-' + Math.random().toString(36).substring(7),
              ...payload,
              usage_count: 0,
            };
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: storedConfig, error: null }),
              }),
            };
          }),
          insert: jest.fn().mockImplementation((payload) => {
            storedConfig = {
              id: 'cfg-' + Math.random().toString(36).substring(7),
              ...payload,
              usage_count: 0,
            };
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: storedConfig, error: null }),
              }),
            };
          }),
          update: jest.fn().mockImplementation((updates) => {
            if (storedConfig) {
              Object.assign(storedConfig, updates);
            }
            return {
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: storedConfig, error: null }),
              }),
            };
          }),
        }),
      };

      aiService = new AIProviderService(mockSupabaseLocal as any, mockOrgId, mockUserId);
    });

    it('disables COPILOT_PROXY by default when saving new configuration without is_enabled flag', async () => {
      const saved = await aiService.saveConfig({
        provider_name: 'COPILOT_PROXY',
        provider_display_name: 'GitHub Copilot API Proxy',
        model_name: 'gpt-4o',
        api_endpoint: 'http://127.0.0.1:4141/v1',
      });

      expect(saved.provider_name).toBe('COPILOT_PROXY');
      expect(saved.is_enabled).toBe(false);
      expect(saved.last_test_status).toBe('NOT_TESTED');
    });

    it('masks server-side secret API keys in response output', async () => {
      const saved = await aiService.saveConfig({
        provider_name: 'COPILOT_PROXY',
        provider_display_name: 'GitHub Copilot API Proxy',
        api_key: 'ghu_super_secret_github_token_xyz999',
        model_name: 'gpt-4o',
      });

      expect(saved.api_key_masked).toBeDefined();
      expect(saved.api_key_masked).toMatch(/ghu\.\.\.z999/);
      expect(saved.api_key_masked).not.toContain('super_secret');
      expect((saved as any).api_key).toBeUndefined();
      expect((saved as any).api_key_ciphertext).toBeUndefined();
    });

    it('falls back to deterministic grounded synthesis when provider is disabled', async () => {
      // Configuration disabled
      await aiService.saveConfig({
        provider_name: 'COPILOT_PROXY',
        provider_display_name: 'GitHub Copilot API Proxy',
        is_enabled: false,
        model_name: 'gpt-4o',
      });

      const dummyPayload: any = {
        feasibilityCode: 'PF-TEST-001',
        productName: 'Amoxicillin 500mg Capsules',
        requiredQuantity: 100000,
        quantityUnit: 'Capsules',
        designatedFacility: 'Plant 1',
        batchPlan: { estimatedBatches: 2, batchSize: 50000 },
        capacityAnalysis: { isFeasible: true, utilizationPct: 45 },
        timelineAnalysis: { isTimelineFeasible: true, totalCustomerLeadTimeDays: 28 },
        materialSufficiency: { materialsWithGaps: 0, gaps: [] },
        commercialEconomics: { totalCost: 12500, grossMarginPct: 35.5 },
        qualityAndRegulatory: { isCompliant: true, identifiedGaps: [] },
      };

      const result = await aiService.runGroundedAnalysis(dummyPayload);
      expect(result).toBeDefined();
      expect(result.feasibilityConclusion).toBe('FEASIBLE');
      expect(result.commercialConclusion).toBe('COMMERCIALLY_ATTRACTIVE');
      expect(result.source).toBe('DETERMINISTIC_ENGINE');
    });
  });
});
