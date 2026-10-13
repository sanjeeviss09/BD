import { ProductService } from '../src/services/product.service';

describe('Product Tenant Isolation & Cross-Org Security', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userA = 'user-org-a';

  it('ProductService strictly enforces organization_id during creation', async () => {
    const mockInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'prod-org-a-1',
            product_code: 'PROD-2026-000001',
            product_name: 'Dapagliflozin 10mg Tablets',
            organization_id: orgA,
          },
          error: null,
        }),
      }),
    });

    const mockSupabase: any = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'products') {
          return {
            insert: mockInsert,
            select: jest.fn().mockImplementation(() => {
              const builder: any = {
                eq: jest.fn().mockImplementation(() => builder),
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              };
              return builder;
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: jest.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
      rpc: jest.fn().mockResolvedValue({ data: 'PROD-2026-000001', error: null }),
    };

    const productServiceA = new ProductService(mockSupabase, orgA, userA);
    const result = await productServiceA.createProduct({
      product_name: 'Dapagliflozin 10mg Tablets',
    });

    expect(result.product).toBeDefined();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: orgA,
        product_name: 'Dapagliflozin 10mg Tablets',
      })
    );
  });

  it('Organization A cannot access Organization B product details', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((col: string, val: string) => {
            return {
              eq: jest.fn().mockImplementation((col2: string, val2: string) => {
                return {
                  single: jest.fn().mockImplementation(async () => {
                    // If asking for org B product using org A credentials, return not found
                    if (val === 'prod-org-b' && val2 === orgA) {
                      return { data: null, error: { message: 'Row not found' } };
                    }
                    return { data: { id: 'prod-org-b', organization_id: orgB }, error: null };
                  }),
                };
              }),
            };
          }),
        }),
      }),
    };

    const productServiceA = new ProductService(mockSupabase, orgA, userA);
    await expect(productServiceA.getProductById('prod-org-b')).rejects.toThrow(
      'Product not found or access denied'
    );
  });
});
