import { WorkflowEngineService } from '../src/services/workflow-engine.service';
import { OpportunityWorkflowService, OPPORTUNITY_STAGES } from '../src/services/opportunity-workflow.service';

describe('Step 10: Operational Workflow Engine Tests', () => {
  const mockOrgId = 'a0000000-0000-0000-0000-000000000001';
  const mockUserId = 'b0000000-0000-0000-0000-000000000001';
  const mockOppId = 'd0000000-0000-0000-0000-000000000001';
  const mockDefId = 'e0000000-0000-0000-0000-000000000001';
  const mockVerId = 'f0000000-0000-0000-0000-000000000001';

  let mockSupabase: any;
  let service: WorkflowEngineService;

  beforeEach(() => {
    // Reset mock supabase client
    mockSupabase = {
      from: jest.fn(),
      rpc: jest.fn(),
    };
    service = new WorkflowEngineService(mockSupabase, mockOrgId, mockUserId);
  });

  describe('1. Canonical Operational Workflow Architecture', () => {
    it('contains strictly 10 operational stages and 2 terminal states without management approval', () => {
      const stages = OpportunityWorkflowService.getStages();
      const stageKeys = stages.map(s => s.key);

      expect(stageKeys).toContain('OPPORTUNITY_CREATED');
      expect(stageKeys).toContain('QUALIFICATION');
      expect(stageKeys).toContain('MARKET_INTELLIGENCE');
      expect(stageKeys).toContain('TECHNICAL_EVALUATION');
      expect(stageKeys).toContain('REGULATORY_EVALUATION');
      expect(stageKeys).toContain('PRODUCTION_FEASIBILITY');
      expect(stageKeys).toContain('COMMERCIAL_EVALUATION');
      expect(stageKeys).toContain('RFQ_CUSTOMER_ENGAGEMENT');
      expect(stageKeys).toContain('OPPORTUNITY_DECISION');
      expect(stageKeys).toContain('WON');
      expect(stageKeys).toContain('LOST');
      expect(stageKeys).toContain('ON_HOLD');

      // EXPLICIT ARCHITECTURAL CHECK: No Management Approval
      expect(stageKeys).not.toContain('MANAGEMENT_REVIEW');
      expect(stageKeys).not.toContain('APPROVAL');
    });

    it('validates sequential forward progression rules', () => {
      // 1. Moving past qualification requires qualification
      const unqualRes = OpportunityWorkflowService.validateTransition(
        'QUALIFICATION',
        'TECHNICAL_EVALUATION',
        { qualification_status: 'NOT_EVALUATED' }
      );
      expect(unqualRes.isValid).toBe(false);
      expect(unqualRes.error).toContain('without completing qualification');

      // 2. Advancing to technical evaluation with qualification succeeds
      const qualRes = OpportunityWorkflowService.validateTransition(
        'QUALIFICATION',
        'MARKET_INTELLIGENCE',
        { qualification_status: 'QUALIFIED' }
      );
      expect(qualRes.isValid).toBe(true);
      expect(qualRes.suggestedProbability).toBe(40);

      // 3. Advancing to commercial stages requires product association
      const noProdRes = OpportunityWorkflowService.validateTransition(
        'PRODUCTION_FEASIBILITY',
        'COMMERCIAL_EVALUATION',
        { qualification_status: 'QUALIFIED', products_count: 0 }
      );
      expect(noProdRes.isValid).toBe(false);
      expect(noProdRes.error).toContain('at least one product');

      // 4. Transition to LOST requires closure justification
      const lostNoReason = OpportunityWorkflowService.validateTransition(
        'OPPORTUNITY_DECISION',
        'LOST',
        { qualification_status: 'QUALIFIED' }
      );
      expect(lostNoReason.isValid).toBe(false);
      expect(lostNoReason.error).toContain('closure reason is mandatory');
    });
  });

  describe('2. Workflow Version Graph Structural Validation', () => {
    it('detects missing START stage in workflow version', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockVerId,
                  stages: [
                    { id: 's1', stage_code: 'PROC1', stage_name: 'Proc', stage_type: 'PROCESS' },
                    { id: 's2', stage_code: 'WON', stage_name: 'Won', stage_type: 'TERMINAL' },
                  ],
                  transitions: [{ id: 't1', transition_code: 'T1', from_stage_id: 's1', to_stage_id: 's2' }],
                },
                error: null,
              }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await service.validateVersionGraph(mockVerId);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workflow version is missing a START stage.');
    });

    it('detects missing TERMINAL stage in workflow version', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockVerId,
                  stages: [
                    { id: 's1', stage_code: 'START', stage_name: 'Start', stage_type: 'START' },
                    { id: 's2', stage_code: 'PROC1', stage_name: 'Proc', stage_type: 'PROCESS' },
                  ],
                  transitions: [{ id: 't1', transition_code: 'T1', from_stage_id: 's1', to_stage_id: 's2' }],
                },
                error: null,
              }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await service.validateVersionGraph(mockVerId);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Workflow version is missing at least one TERMINAL stage (e.g. WON, LOST).');
    });

    it('passes validation for complete operational workflow graph', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockVerId,
                  stages: [
                    { id: 's1', stage_code: 'START', stage_name: 'Start', stage_type: 'START' },
                    { id: 's2', stage_code: 'QUAL', stage_name: 'Qual', stage_type: 'PROCESS' },
                    { id: 's3', stage_code: 'WON', stage_name: 'Won', stage_type: 'TERMINAL' },
                  ],
                  transitions: [
                    { id: 't1', transition_code: 'T_START_QUAL', from_stage_id: 's1', to_stage_id: 's2' },
                    { id: 't2', transition_code: 'T_QUAL_WON', from_stage_id: 's2', to_stage_id: 's3' },
                  ],
                },
                error: null,
              }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const result = await service.validateVersionGraph(mockVerId);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('3. Concurrency Protection & Race Condition Safety', () => {
    it('rejects stage transition when optimistic lock version mismatch occurs', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workflow_instances') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'wi-1',
                      version: 2, // Current database version is 2
                      status: 'ACTIVE',
                      current_stage_id: 's1',
                      current_stage: { stage_name: 'Start' },
                      stage_started_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      // User submitted request with expected_version = 1 (stale)
      await expect(
        service.executeTransition(mockOppId, {
          target_stage_code: 'QUALIFICATION',
          expected_version: 1,
        })
      ).rejects.toThrow('CONCURRENT_UPDATE: The opportunity workflow was updated by another user.');
    });
  });

  describe('4. Transition Validation Engine', () => {
    it('blocks stage advancement if mandatory evaluation tasks are incomplete', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'workflow_instances') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'wi-1',
                      current_stage_id: 's-qual',
                      version: 1,
                      status: 'ACTIVE',
                      stage_started_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'workflow_transitions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 't-1',
                      transition_code: 'T_QUAL_MKT',
                      transition_name: 'Advance to Market Intel',
                      from_stage_id: 's-qual',
                      to_stage_id: 's-mkt',
                      to_stage: { stage_code: 'MARKET_INTELLIGENCE', stage_name: 'Market Intelligence' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'opportunities') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: mockOppId,
                    qualification_status: 'QUALIFIED',
                    opportunity_products: [{ id: 'op-1' }],
                    // Outstanding mandatory task!
                    tasks: [{ id: 'task-1', is_mandatory: true, status: 'IN_PROGRESS' }],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.executeTransition(mockOppId, {
          target_stage_code: 'MARKET_INTELLIGENCE',
        })
      ).rejects.toThrow('REQUIRED_TASK_INCOMPLETE: 1 mandatory task(s) must be completed before advancing.');
    });
  });

  describe('5. SLA Engine Calculations', () => {
    it('dynamically marks overdue stages when current time exceeds stage_due_at', async () => {
      const pastDueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
      const startDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(); // 12 days ago

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'wi-1',
                  status: 'ACTIVE',
                  stage_started_at: startDate,
                  stage_due_at: pastDueDate,
                  current_stage: { sla_days: 7, warning_days: 2 },
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const instance = await service.getOrCreateInstanceForOpportunity(mockOppId);
      expect(instance.sla_status).toBe('OVERDUE');
      expect(instance.is_overdue).toBe(true);
      expect(instance.days_in_stage).toBeGreaterThanOrEqual(11);
    });
  });
});
