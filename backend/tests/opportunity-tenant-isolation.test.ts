import { OpportunityService } from '../src/services/opportunity.service';

describe('Opportunity Tenant Isolation & Cross-Org Security', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userA = 'user-org-a';

  it('OpportunityService strictly enforces organization_id during creation', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'opp-1',
            opportunity_code: 'OPP-2026-000001',
            title: 'EU Biosimilar Commercial Expansion',
            organization_id: orgA,
          },
          error: null,
        }),
      }),
    });

    const mockSupabase: any = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'opportunities') {
          return { insert: mockInsert };
        }
        if (table === 'opportunity_timeline') {
          return { insert: jest.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
      rpc: jest.fn().mockResolvedValue({ data: 'OPP-2026-000001', error: null }),
    };

    const oppServiceA = new OpportunityService(mockSupabase, orgA, userA);
    const result = await oppServiceA.createOpportunity({
      title: 'EU Biosimilar Commercial Expansion',
      estimated_value: 500000,
    });

    expect(result.id).toBe('opp-1');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: orgA,
        title: 'EU Biosimilar Commercial Expansion',
      })
    );
  });

  it('Organization A cannot access Organization B opportunity records', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((col: string, val: string) => {
            return {
              eq: jest.fn().mockImplementation((col2: string, val2: string) => {
                return {
                  single: jest.fn().mockImplementation(async () => {
                    if (val === 'opp-org-b' && val2 === orgA) {
                      return { data: null, error: { message: 'Row not found' } };
                    }
                    return { data: { id: 'opp-org-b', organization_id: orgB }, error: null };
                  }),
                };
              }),
            };
          }),
        }),
      }),
    };

    const oppServiceA = new OpportunityService(mockSupabase, orgA, userA);
    await expect(oppServiceA.getOpportunityById('opp-org-b')).rejects.toThrow(
      'Opportunity not found or access denied'
    );
  });
});
