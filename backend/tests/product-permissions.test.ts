import { ProductService } from '../src/services/product.service';

describe('ProductService - Concurrency, Archive & Business Workflows', () => {
  const orgId = '11111111-1111-1111-1111-111111111111';
  const userId = 'user-001';

  it('enforces optimistic concurrency control and rejects stale version edits', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'prod-100',
                  product_code: 'PROD-2026-000100',
                  product_name: 'Apixaban 5mg Tablets',
                  version: 3, // Database is currently at version 3
                  organization_id: orgId,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const productService = new ProductService(mockSupabase, orgId, userId);

    // Client passes version 2 (stale edit)
    await expect(
      productService.updateProduct('prod-100', {
        product_name: 'Apixaban 5mg Film-Coated Tablets',
        version: 2,
      })
    ).rejects.toThrow('Concurrent modification error: Product has been modified by another user.');
  });

  it('correctly executes soft-archive and logs archive reason', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'prod-100',
                is_archived: true,
                lifecycle_status: 'ARCHIVED',
                archive_reason: 'Discontinued due to low commercial viability',
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const mockSupabase: any = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'products') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      id: 'prod-100',
                      version: 1,
                      organization_id: orgId,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'tasks') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: jest.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
    };

    const productService = new ProductService(mockSupabase, orgId, userId);
    const result = await productService.archiveProduct(
      'prod-100',
      'Discontinued due to low commercial viability'
    );

    expect(result.is_archived).toBe(true);
    expect(result.lifecycle_status).toBe('ARCHIVED');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_archived: true,
        lifecycle_status: 'ARCHIVED',
        archive_reason: 'Discontinued due to low commercial viability',
      })
    );
  });
});
