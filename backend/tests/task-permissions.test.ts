import { TaskService } from '../src/services/task.service';

describe('Task Security, Immutability & Permission Enforcement', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const userA = 'aaaa1111-1111-1111-1111-111111111111';

  it('Immutability: updateTask does NOT allow direct tampering of original_due_date', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'task-1', title: 'New Title', original_due_date: '2026-10-05', version: 2 },
              error: null,
            }),
          }),
        }),
      }),
    });

    const mockSupabase: any = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'task-1', title: 'Old Title', original_due_date: '2026-10-05', version: 1 },
                error: null,
              }),
            }),
          }),
        }),
        update: mockUpdate,
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    const service = new TaskService(mockSupabase, orgA, userA);

    // Attempt to pass original_due_date into general update
    const result = await service.updateTask('task-1', {
      title: 'New Title',
      // @ts-ignore
      original_due_date: '2026-12-31', // Should not be accepted or passed to update
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({
        original_due_date: '2026-12-31',
      })
    );
  });

  it('Concurrency: Rejects task updates with version mismatch', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'task-1', title: 'Task', version: 5 },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const service = new TaskService(mockSupabase, orgA, userA);

    // Provide stale expected_version 4 when DB has 5
    await expect(
      service.updateTask('task-1', {
        title: 'New Title',
        expected_version: 4,
      })
    ).rejects.toThrow('Concurrent modification detected');
  });

  it('Hierarchy Validation: Rejects assignment to user from different organization', async () => {
    const mockSupabase: any = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null }), // Not in org
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    const service = new TaskService(mockSupabase, orgA, userA);

    await expect(
      service.createTask({
        title: 'Task Title',
        task_type: 'GENERAL',
        priority: 'MEDIUM',
        original_due_date: '2026-10-15',
        assigned_user_id: 'cross-org-user-id',
      })
    ).rejects.toThrow('Assigned user does not belong to your organization');
  });
});
