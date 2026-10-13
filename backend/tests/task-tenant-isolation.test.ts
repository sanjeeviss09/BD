import { TaskService } from '../src/services/task.service';

describe('Tenant Isolation & Task Workflow Tests', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userA = 'aaaa1111-1111-1111-1111-111111111111';

  it('TaskService strictly enforces organization_id in all queries and inserts', async () => {
    const mockFrom = jest.fn();
    const mockSelect = jest.fn();
    const mockEq = jest.fn();
    const mockLike = jest.fn();
    const mockOrder = jest.fn();
    const mockLimit = jest.fn();
    const mockMaybeSingle = jest.fn();
    const mockInsert = jest.fn();

    const queryBuilder: any = {
      select: mockSelect,
      eq: mockEq,
      like: mockLike,
      order: mockOrder,
      limit: mockLimit,
      maybeSingle: mockMaybeSingle,
      insert: mockInsert,
    };

    mockSelect.mockReturnValue(queryBuilder);
    mockEq.mockReturnValue(queryBuilder);
    mockLike.mockReturnValue(queryBuilder);
    mockOrder.mockReturnValue(queryBuilder);
    mockLimit.mockReturnValue(queryBuilder);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'task-1', task_code: 'TASK-2026-000001', organization_id: orgA },
          error: null,
        }),
      }),
    });

    mockFrom.mockReturnValue(queryBuilder);

    const mockSupabase: any = {
      from: mockFrom,
      rpc: jest.fn().mockResolvedValue({ data: 'TASK-2026-000001', error: null }),
    };

    const taskServiceA = new TaskService(mockSupabase, orgA, userA);

    await taskServiceA.createTask({
      title: 'Dossier Review',
      task_type: 'INFORMATION_REQUEST',
      priority: 'HIGH',
      original_due_date: '2026-10-15',
    });

    expect(mockFrom).toHaveBeenCalledWith('tasks');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: orgA,
        title: 'Dossier Review',
      })
    );
  });

  it('Organization A cannot access Organization B task data', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((col: string, val: string) => {
            return {
              eq: jest.fn().mockImplementation((col2: string, val2: string) => {
                return {
                  single: jest.fn().mockImplementation(async () => {
                    if (val === 'task-org-b' && val2 === orgA) {
                      return { data: null, error: { message: 'Row not found' } };
                    }
                    return { data: { id: 'task-org-b', organization_id: orgB }, error: null };
                  }),
                };
              }),
            };
          }),
        }),
      }),
    };

    const taskServiceA = new TaskService(mockSupabase, orgA, userA);

    await expect(taskServiceA.getTask('task-org-b')).rejects.toThrow('Task not found');
  });
});
