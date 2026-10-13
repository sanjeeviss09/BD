export type NotificationCategory =
  | 'MEETING'
  | 'TASK'
  | 'FOLLOWUP'
  | 'OVERDUE'
  | 'SYSTEM'
  | 'COMMERCIAL'
  | 'PRODUCTION';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AppNotification {
  id: string;
  organization_id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  read_at?: string | null;
  dismissed_at?: string | null;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface NotificationUnreadMetrics {
  total: number;
  critical: number;
  high: number;
  meeting: number;
  task: number;
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

export interface MeetingStartPrompt {
  meetingId: string;
  title: string;
  scheduledTime: string;
  externalLink: string;
  objective?: string;
  previousMeeting?: {
    id: string;
    title: string;
    meeting_date: string;
    closure_summary?: string;
  };
  openPoints?: Array<{
    id: string;
    point_code: string;
    title: string;
    category: string;
    priority: string;
    status: string;
  }>;
}

export interface MeetingEndPrompt {
  meetingId: string;
  title: string;
  endTime: string;
  notesCount: number;
  hasDraftNotes: boolean;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  category?: NotificationCategory;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: number;
}
