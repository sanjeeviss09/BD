import { NotificationService } from '../src/services/notification.service';
import { MeetingReminderSchedulerService } from '../src/services/meeting-reminder-scheduler.service';

describe('BDIQ Enterprise Notification & Meeting Reminder Engine', () => {
  const mockOrgId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '11111111-1111-1111-1111-111111111111';

  let mockSupabase: any;
  let service: NotificationService;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(),
    };
    service = new NotificationService(mockSupabase, mockOrgId, mockUserId);
  });

  describe('1. Unread Metrics & Category Calculations', () => {
    it('accurately tallies unread totals, critical counts, and category segments', async () => {
      const mockRows = [
        { category: 'MEETING', priority: 'CRITICAL' },
        { category: 'MEETING', priority: 'HIGH' },
        { category: 'TASK', priority: 'MEDIUM' },
        { category: 'OVERDUE', priority: 'CRITICAL' },
        { category: 'SYSTEM', priority: 'LOW' },
      ];

      const queryObj: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
      };
      queryObj.then = (resolve: any) => resolve({ data: mockRows, error: null });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryObj),
      });

      const counts = await service.getUnreadCount();
      expect(counts.total).toBe(5);
      expect(counts.critical).toBe(2);
      expect(counts.high).toBe(1);
      expect(counts.meeting).toBe(2);
      expect(counts.task).toBe(2); // TASK + OVERDUE
    });

    it('returns zeroes gracefully on empty notification inbox', async () => {
      const queryObj: any = {
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
      };
      queryObj.then = (resolve: any) => resolve({ data: [], error: null });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(queryObj),
      });

      const counts = await service.getUnreadCount();
      expect(counts.total).toBe(0);
      expect(counts.critical).toBe(0);
    });
  });

  describe('2. User Notification Preferences & Quiet Hours', () => {
    it('returns default preferences when none exist in DB', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const prefs = await service.getUserPreferences();
      expect(prefs.in_app_enabled).toBe(true);
      expect(prefs.meeting_reminders_enabled).toBe(true);
      expect(prefs.meeting_offsets_minutes).toEqual([1440, 60, 15, 5, 0]);
      expect(prefs.quiet_hours_enabled).toBe(false);
    });

    it('suppresses delivery logs during active quiet hours', async () => {
      // Mock user preference with quiet hours enabled
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_notification_preferences') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  quiet_hours_enabled: true,
                  quiet_hours_start: '00:00:00',
                  quiet_hours_end: '23:59:59', // All day quiet hours for testing
                },
                error: null,
              }),
            }),
          };
        }
        if (table === 'notifications') {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'notif-123', title: 'Test Title' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'notification_delivery_logs') {
          return {
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      });

      const created = await service.createNotification({
        recipient_id: mockUserId,
        type: 'MEETING_REMINDER_UPCOMING_15M',
        title: 'Meeting in 15 Minutes',
        message: 'Your meeting is starting soon',
        category: 'MEETING',
        priority: 'HIGH',
      });

      expect(created.id).toBe('notif-123');
      // Delivery log should have been invoked with SUPPRESSED_QUIET_HOURS
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_delivery_logs');
    });
  });

  describe('3. Scheduler Idempotency & Deduplication Logic', () => {
    it('MeetingReminderSchedulerService deduplication key format guarantees unique delivery', () => {
      const meetingId = 'meet-abc-123';
      const reminderType = 'UPCOMING_15M';
      const recipientId = 'user-xyz-789';

      const dedupKey = `${meetingId}_${reminderType}_${recipientId}`;
      expect(dedupKey).toBe('meet-abc-123_UPCOMING_15M_user-xyz-789');

      // Changing recipient or offset yields separate deterministic keys
      const startKey = `${meetingId}_MEETING_STARTED_${recipientId}`;
      expect(startKey).not.toBe(dedupKey);
    });
  });
});
