import { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errors';

export interface NotificationFilterOptions {
  category?: string;
  priority?: string;
  read?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateNotificationInput {
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  category?: 'MEETING' | 'TASK' | 'FOLLOWUP' | 'OVERDUE' | 'SYSTEM' | 'COMMERCIAL' | 'PRODUCTION';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

export interface UserNotificationPreferences {
  in_app_enabled: boolean;
  browser_notifications_enabled: boolean;
  meeting_reminders_enabled: boolean;
  meeting_offsets_minutes: number[];
  meeting_start_popup_enabled: boolean;
  meeting_end_popup_enabled: boolean;
  task_due_reminders_enabled: boolean;
  task_overdue_reminders_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  categories_filter: Record<string, boolean>;
}

const DEFAULT_PREFERENCES: UserNotificationPreferences = {
  in_app_enabled: true,
  browser_notifications_enabled: false,
  meeting_reminders_enabled: true,
  meeting_offsets_minutes: [1440, 60, 15, 5, 0],
  meeting_start_popup_enabled: true,
  meeting_end_popup_enabled: true,
  task_due_reminders_enabled: true,
  task_overdue_reminders_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '07:00:00',
  categories_filter: {
    MEETING: true,
    TASK: true,
    FOLLOWUP: true,
    OVERDUE: true,
    SYSTEM: true,
  },
};

export class NotificationService {
  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId: string
  ) {}

  /**
   * Retrieves paginated notifications with filters
   */
  async getNotifications(filters: NotificationFilterOptions = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('organization_id', this.orgId)
      .eq('recipient_id', this.userId)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false });

    if (filters.category && filters.category !== 'ALL') {
      if (filters.category === 'UNREAD') {
        query = query.is('read_at', null);
      } else {
        query = query.eq('category', filters.category);
      }
    }

    if (filters.priority && filters.priority !== 'ALL') {
      query = query.eq('priority', filters.priority);
    }

    if (filters.read === true) {
      query = query.not('read_at', 'is', null);
    } else if (filters.read === false) {
      query = query.is('read_at', null);
    }

    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim()}%`;
      query = query.or(`title.ilike.${term},message.ilike.${term}`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      throw new AppError(`Failed to fetch notifications: ${error.message}`, 500);
    }

    // Get unread count
    const unreadCount = await this.getUnreadCount();

    return {
      notifications: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
      unreadCount,
    };
  }

  /**
   * Retrieves unread metrics broken down by category & priority
   */
  async getUnreadCount() {
    const { data, error } = await this.supabase
      .from('notifications')
      .select('category, priority')
      .eq('organization_id', this.orgId)
      .eq('recipient_id', this.userId)
      .is('read_at', null)
      .is('dismissed_at', null);

    if (error) {
      return { total: 0, critical: 0, high: 0, meeting: 0, task: 0 };
    }

    const items = data || [];
    return {
      total: items.length,
      critical: items.filter(i => i.priority === 'CRITICAL').length,
      high: items.filter(i => i.priority === 'HIGH').length,
      meeting: items.filter(i => i.category === 'MEETING').length,
      task: items.filter(i => i.category === 'TASK' || i.category === 'OVERDUE').length,
    };
  }

  /**
   * Marks a single notification as read
   */
  async markAsRead(notificationId: string) {
    const { data, error } = await this.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('organization_id', this.orgId)
      .eq('recipient_id', this.userId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to mark notification as read: ${error.message}`, 500);
    }
    return data;
  }

  /**
   * Marks a single notification as unread
   */
  async markAsUnread(notificationId: string) {
    const { data, error } = await this.supabase
      .from('notifications')
      .update({ read_at: null })
      .eq('id', notificationId)
      .eq('organization_id', this.orgId)
      .eq('recipient_id', this.userId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to mark notification as unread: ${error.message}`, 500);
    }
    return data;
  }

  /**
   * Marks all matching notifications as read
   */
  async markAllAsRead(category?: string) {
    let query = this.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('organization_id', this.orgId)
      .eq('recipient_id', this.userId)
      .is('read_at', null);

    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }

    const { error } = await query;
    if (error) {
      throw new AppError(`Failed to mark all notifications as read: ${error.message}`, 500);
    }
    return { success: true };
  }

  /**
   * Dismisses a notification (hides from view without deleting historical record)
   */
  async dismiss(notificationId: string) {
    const { data, error } = await this.supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('organization_id', this.orgId)
      .eq('recipient_id', this.userId)
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to dismiss notification: ${error.message}`, 500);
    }
    return data;
  }

  /**
   * Gets user notification preferences
   */
  async getUserPreferences(): Promise<UserNotificationPreferences> {
    const { data, error } = await this.supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('organization_id', this.orgId)
      .eq('user_id', this.userId)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_PREFERENCES;
    }

    return {
      in_app_enabled: data.in_app_enabled ?? true,
      browser_notifications_enabled: data.browser_notifications_enabled ?? false,
      meeting_reminders_enabled: data.meeting_reminders_enabled ?? true,
      meeting_offsets_minutes: data.meeting_offsets_minutes || DEFAULT_PREFERENCES.meeting_offsets_minutes,
      meeting_start_popup_enabled: data.meeting_start_popup_enabled ?? true,
      meeting_end_popup_enabled: data.meeting_end_popup_enabled ?? true,
      task_due_reminders_enabled: data.task_due_reminders_enabled ?? true,
      task_overdue_reminders_enabled: data.task_overdue_reminders_enabled ?? true,
      quiet_hours_enabled: data.quiet_hours_enabled ?? false,
      quiet_hours_start: data.quiet_hours_start || '22:00:00',
      quiet_hours_end: data.quiet_hours_end || '07:00:00',
      categories_filter: data.categories_filter || DEFAULT_PREFERENCES.categories_filter,
    };
  }

  /**
   * Updates user notification preferences
   */
  async updateUserPreferences(input: Partial<UserNotificationPreferences>) {
    const current = await this.getUserPreferences();
    const updated = {
      ...current,
      ...input,
      organization_id: this.orgId,
      user_id: this.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('user_notification_preferences')
      .upsert(updated, { onConflict: 'organization_id,user_id' })
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to save notification preferences: ${error.message}`, 500);
    }

    return data;
  }

  /**
   * Dispatches a notification to a user with quiet hours & delivery logging
   */
  async createNotification(input: CreateNotificationInput) {
    const category = input.category || 'SYSTEM';
    const priority = input.priority || 'MEDIUM';

    // Check recipient quiet hours
    let isSuppressed = false;
    try {
      const { data: prefs } = await this.supabase
        .from('user_notification_preferences')
        .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end')
        .eq('organization_id', this.orgId)
        .eq('user_id', input.recipient_id)
        .maybeSingle();

      if (prefs?.quiet_hours_enabled && prefs.quiet_hours_start && prefs.quiet_hours_end) {
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
        if (prefs.quiet_hours_start > prefs.quiet_hours_end) {
          // Crosses midnight, e.g. 22:00 to 07:00
          if (currentTime >= prefs.quiet_hours_start || currentTime <= prefs.quiet_hours_end) {
            isSuppressed = true;
          }
        } else {
          if (currentTime >= prefs.quiet_hours_start && currentTime <= prefs.quiet_hours_end) {
            isSuppressed = true;
          }
        }
      }
    } catch {
      // Non-blocking
    }

    const { data, error } = await this.supabase
      .from('notifications')
      .insert({
        organization_id: this.orgId,
        recipient_id: input.recipient_id,
        type: input.type,
        title: input.title,
        message: input.message,
        category,
        priority,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action_url: input.action_url,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) {
      throw new AppError(`Failed to insert notification: ${error.message}`, 500);
    }

    // Delivery log
    try {
      await this.supabase.from('notification_delivery_logs').insert({
        organization_id: this.orgId,
        notification_id: data.id,
        recipient_user_id: input.recipient_id,
        channel: 'IN_APP',
        status: isSuppressed ? 'SUPPRESSED_QUIET_HOURS' : 'DELIVERED',
        details: { priority, category },
      });
    } catch {
      // Non-blocking audit log
    }

    return data;
  }

  /**
   * Evaluates active meeting prompts (Meeting-Start and Scheduled-End) for the current user
   */
  async getActiveMeetingPrompts() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Fetch user's scheduled/in_progress meetings for today
    const { data: meetings, error } = await this.supabase
      .from('meetings')
      .select(`
        id,
        title,
        meeting_date,
        meeting_time,
        end_time,
        status,
        location_or_link,
        objective,
        expected_outcomes,
        meeting_type,
        organizer_id,
        previous_meeting_id
      `)
      .eq('organization_id', this.orgId)
      .eq('meeting_date', today)
      .in('status', ['SCHEDULED', 'IN_PROGRESS']);

    if (error || !meetings || meetings.length === 0) {
      return { startPrompt: null, endPrompt: null };
    }

    let startPrompt: any = null;
    let endPrompt: any = null;

    for (const m of meetings) {
      if (!m.meeting_time) continue;

      // Parse start and end times in local timestamp
      const [startH, startM] = m.meeting_time.split(':').map(Number);
      const startTime = new Date(now);
      startTime.setHours(startH, startM, 0, 0);

      const endTime = new Date(startTime);
      if (m.end_time) {
        const [endH, endM] = m.end_time.split(':').map(Number);
        endTime.setHours(endH, endM, 0, 0);
      } else {
        endTime.setHours(startH + 1, startM, 0, 0); // Default 1h duration
      }

      const diffStartMinutes = (now.getTime() - startTime.getTime()) / (60 * 1000);
      const diffEndMinutes = (now.getTime() - endTime.getTime()) / (60 * 1000);

      // 1. Meeting Start Prompt condition:
      // Meeting start is within [-2 minutes, +30 minutes] of now and status is SCHEDULED or IN_PROGRESS
      if (diffStartMinutes >= -2 && diffStartMinutes <= 30 && !startPrompt) {
        // Fetch previous meeting context if linked
        let previousContext = null;
        if (m.previous_meeting_id) {
          const { data: prev } = await this.supabase
            .from('meetings')
            .select('id, title, meeting_date, closure_summary')
            .eq('id', m.previous_meeting_id)
            .maybeSingle();
          previousContext = prev;
        }

        // Fetch unresolved points from previous meeting or this meeting
        const { data: openPoints } = await this.supabase
          .from('meeting_points')
          .select('id, point_code, title, category, priority, status')
          .eq('organization_id', this.orgId)
          .eq('meeting_id', m.previous_meeting_id || m.id)
          .neq('status', 'RESOLVED')
          .limit(5);

        startPrompt = {
          meetingId: m.id,
          title: m.title,
          scheduledTime: `${m.meeting_time}${m.end_time ? ' - ' + m.end_time : ''}`,
          externalLink: m.location_or_link || '',
          objective: m.objective,
          previousMeeting: previousContext,
          openPoints: openPoints || [],
        };
      }

      // 2. Scheduled End Prompt condition:
      // Meeting end is within [0 minutes, +45 minutes] of now
      if (diffEndMinutes >= 0 && diffEndMinutes <= 45 && !endPrompt) {
        // Fetch current live notes count or items
        const { data: notes } = await this.supabase
          .from('meeting_notes')
          .select('id, content, note_type')
          .eq('meeting_id', m.id)
          .limit(10);

        endPrompt = {
          meetingId: m.id,
          title: m.title,
          endTime: m.end_time || 'Scheduled End',
          notesCount: notes?.length || 0,
          hasDraftNotes: (notes && notes.length > 0) || false,
        };
      }
    }

    return { startPrompt, endPrompt };
  }
}
