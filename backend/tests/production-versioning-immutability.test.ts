import { ProductionFeasibilityService } from '../src/services/production-feasibility.service';
import { ValidationError } from '../src/utils/errors';

describe('Production Feasibility Immutability & Versioning Suite', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = 'user-001';

  it('prevents direct mutation of finalized feasibility assessment', async () => {
    const finalizedRecord = {
      id: 'pf-finalized-1',
      feasibility_code: 'PF-2026-000001',
      organization_id: orgId,
      status: 'FINALIZED',
      is_finalized: true,
      version_number: 1,
    };

    const mockSupabase: any = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'production_feasibility') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: finalizedRecord,
                    error: null,
                  }),
                }),
              }),
            }),
            update: jest.fn(),
          };
        }
        return {};
      }),
    };

    const service = new ProductionFeasibilityService(mockSupabase, orgId, userId);

    await expect(
      service.updateFeasibility('pf-finalized-1', { annual_volume: 500000 })
    ).rejects.toThrow(ValidationError);

    await expect(
      service.updateFeasibility('pf-finalized-1', { annual_volume: 500000 })
    ).rejects.toThrow(/immutable/i);
  });
});
