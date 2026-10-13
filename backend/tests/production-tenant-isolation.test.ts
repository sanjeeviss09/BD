import { ProductionFeasibilityService } from '../src/services/production-feasibility.service';
import { ProductionFacilityService } from '../src/services/production-facility.service';
import { NotFoundError } from '../src/utils/errors';

describe('Production Feasibility Tenant Isolation & Security Suite', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userA = 'user-org-a';

  it('ProductionFeasibilityService strictly enforces organization_id during retrieval', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'production_feasibility') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockImplementation((col: string, val: string) => {
                if (col === 'organization_id' && val !== orgA) {
                  return { single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }) };
                }
                return {
                  eq: jest.fn().mockImplementation((col2: string, val2: string) => {
                    if (col2 === 'organization_id' && val2 !== orgA) {
                      return { single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }) };
                    }
                    return {
                      single: jest.fn().mockResolvedValue({
                        data: {
                          id: 'pf-1',
                          feasibility_code: 'PF-2026-000001',
                          organization_id: orgA,
                        },
                        error: null,
                      }),
                    };
                  }),
                };
              }),
            }),
          };
        }
        return {};
      }),
    };

    const serviceA = new ProductionFeasibilityService(mockSupabase, orgA, userA);
    const result = await serviceA.getFeasibilityById('pf-1');
    expect(result.id).toBe('pf-1');
    expect(result.organization_id).toBe(orgA);

    const serviceB = new ProductionFeasibilityService(mockSupabase, orgB, 'user-org-b');
    await expect(serviceB.getFeasibilityById('pf-1')).rejects.toThrow(NotFoundError);
  });

  it('ProductionFacilityService strictly prevents cross-tenant access to facilities', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'production_facilities') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockImplementation((col: string, val: string) => {
                if (col === 'organization_id' && val !== orgA) {
                  return { single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }) };
                }
                return {
                  eq: jest.fn().mockImplementation((col2: string, val2: string) => {
                    if (col2 === 'organization_id' && val2 !== orgA) {
                      return { single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }) };
                    }
                    return {
                      single: jest.fn().mockResolvedValue({
                        data: {
                          id: 'fac-1',
                          facility_code: 'FAC-0001',
                          facility_name: 'Sri City Manufacturing Plant',
                          organization_id: orgA,
                        },
                        error: null,
                      }),
                    };
                  }),
                };
              }),
            }),
          };
        }
        return {};
      }),
    };

    const facServiceA = new ProductionFacilityService(mockSupabase, orgA, userA);
    const fac = await facServiceA.getFacilityById('fac-1');
    expect(fac.facility_name).toBe('Sri City Manufacturing Plant');

    const facServiceB = new ProductionFacilityService(mockSupabase, orgB, 'user-org-b');
    await expect(facServiceB.getFacilityById('fac-1')).rejects.toThrow(NotFoundError);
  });
});
