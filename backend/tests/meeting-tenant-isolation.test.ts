import { MeetingService } from '../src/services/meeting.service';

describe('Meeting Intelligence Multi-Tenant Isolation & Security Tests', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';
  const userA = 'aaaa1111-1111-1111-1111-111111111111';

  it('MeetingService strictly enforces organization_id in all queries', async () => {
    const mockFrom = jest.fn();
    const mockSelect = jest.fn();
    const mockEq = jest.fn();
    const mockOrder = jest.fn();
    const mockInsert = jest.fn();
    const mockUpdate = jest.fn();
    const mockDelete = jest.fn();

    const queryBuilder: any = {
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    };

    mockSelect.mockReturnValue(queryBuilder);
    mockEq.mockReturnValue(queryBuilder);
    mockOrder.mockReturnValue(queryBuilder);

    mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'meet-1', organization_id: orgA },
          error: null,
        }),
      }),
    });

    mockFrom.mockReturnValue(queryBuilder);

    const mockSupabase: any = {
      from: mockFrom,
    };

    const meetingServiceA = new MeetingService(mockSupabase, orgA, userA);

    await meetingServiceA.listMeetings();

    expect(mockFrom).toHaveBeenCalledWith('meetings');
    expect(mockEq).toHaveBeenCalledWith('organization_id', orgA);
    expect(mockEq).not.toHaveBeenCalledWith('organization_id', orgB);
  });

  it('Meeting points and live notes are strictly partitioned by organization_id', async () => {
    const mockFrom = jest.fn();
    const mockSelect = jest.fn();
    const mockEq = jest.fn();
    const mockOrder = jest.fn();

    const queryBuilder: any = {
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    };

    mockSelect.mockReturnValue(queryBuilder);
    mockEq.mockReturnValue(queryBuilder);
    mockOrder.mockReturnValue(queryBuilder);

    mockFrom.mockReturnValue(queryBuilder);

    const mockSupabase: any = {
      from: mockFrom,
    };

    const service = new MeetingService(mockSupabase, orgA, userA);
    await service.getNotes('meet-123');

    expect(mockFrom).toHaveBeenCalledWith('meeting_notes');
    expect(mockEq).toHaveBeenCalledWith('organization_id', orgA);
    expect(mockEq).toHaveBeenCalledWith('meeting_id', 'meet-123');
  });
});
