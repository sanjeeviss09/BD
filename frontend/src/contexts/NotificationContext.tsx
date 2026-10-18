import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import type {
  AppNotification,
  NotificationUnreadMetrics,
  UserNotificationPreferences,
  MeetingStartPrompt,
  MeetingEndPrompt,
  ToastItem,
} from '@/types/notification';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadMetrics: NotificationUnreadMetrics;
  activeToasts: ToastItem[];
  meetingStartPrompt: MeetingStartPrompt | null;
  meetingEndPrompt: MeetingEndPrompt | null;
  preferences: UserNotificationPreferences | null;
  browserPermission: NotificationPermission | 'unsupported';
  isLoading: boolean;
  activeMeetingNotesId: string | null;
  activeReviewMeetingId: string | null;
  isSettingsOpen: boolean;

  // Actions
  openSettings: () => void;
  closeSettings: () => void;
  fetchNotifications: (category?: string, search?: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: (category?: string) => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  requestBrowserPermission: () => Promise<boolean>;
  sendTestAlert: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserNotificationPreferences>) => Promise<void>;
  dismissMeetingStartPrompt: () => void;
  dismissMeetingEndPrompt: () => void;
  deferMeetingEndPrompt: (minutes?: number) => void;
  openLiveNotes: (meetingId: string) => void;
  closeLiveNotes: () => void;
  openReviewAndTasks: (meetingId: string) => void;
  closeReviewAndTasks: () => void;
  removeToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadMetrics, setUnreadMetrics] = useState<NotificationUnreadMetrics>({
    total: 0,
    critical: 0,
    high: 0,
    meeting: 0,
    task: 0,
  });
  const [activeToasts, setActiveToasts] = useState<ToastItem[]>([]);
  const [meetingStartPrompt, setMeetingStartPrompt] = useState<MeetingStartPrompt | null>(null);
  const [meetingEndPrompt, setMeetingEndPrompt] = useState<MeetingEndPrompt | null>(null);
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Active Modals
  const [activeMeetingNotesId, setActiveMeetingNotesId] = useState<string | null>(null);
  const [activeReviewMeetingId, setActiveReviewMeetingId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  // Browser Permission
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Track dismissed/deferred prompt keys in memory to prevent repeat popping
  const dismissedStartPromptIds = useRef<Set<string>>(new Set());
  const deferredEndPromptMap = useRef<Map<string, number>>(new Map()); // meetingId -> resumeTimestamp
  const prevUnreadCountRef = useRef<number>(0);

  const getHeaders = useCallback(() => {
    const token = session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [session]);

  // Check browser Notification API availability
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPermission(Notification.permission);
    } else {
      setBrowserPermission('unsupported');
    }
  }, []);

  // Fetch Unread Metrics & Active Prompts
  const pollMetricsAndAlerts = useCallback(async () => {
    if (!user) return;
    try {
      const headers = getHeaders();
      const [countRes, alertsRes] = await Promise.all([
        fetch('http://localhost:4000/api/notifications/unread-count', { headers }),
        fetch('http://localhost:4000/api/notifications/meeting-alerts', { headers }),
      ]);

      if (countRes.ok) {
        const metrics: NotificationUnreadMetrics = await countRes.json();
        setUnreadMetrics(metrics);

        // If new unread notifications arrived
        if (metrics.total > prevUnreadCountRef.current && prevUnreadCountRef.current > 0) {
          // If window is backgrounded, dispatch browser notification
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            !document.hasFocus()
          ) {
            new Notification('BDIQ Enterprise Alert', {
              body: `You have ${metrics.total} unread notification(s) requiring attention.`,
              icon: '/favicon.ico',
            });
          }
        }
        prevUnreadCountRef.current = metrics.total;
      }

      if (alertsRes.ok) {
        const alerts = await alertsRes.json();
        const now = Date.now();

        // 1. Meeting Start Prompt
        if (alerts.startPrompt && !dismissedStartPromptIds.current.has(alerts.startPrompt.meetingId)) {
          setMeetingStartPrompt(alerts.startPrompt);

          // If unfocused and browser notification enabled, show browser alert
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            !document.hasFocus()
          ) {
            new Notification(`Meeting Started: ${alerts.startPrompt.title}`, {
              body: `Scheduled time: ${alerts.startPrompt.scheduledTime}. Click to join.`,
              icon: '/favicon.ico',
            });
          }
        } else {
          setMeetingStartPrompt(null);
        }

        // 2. Meeting End Prompt
        if (alerts.endPrompt) {
          const deferredUntil = deferredEndPromptMap.current.get(alerts.endPrompt.meetingId);
          if (!deferredUntil || now >= deferredUntil) {
            setMeetingEndPrompt(alerts.endPrompt);
          } else {
            setMeetingEndPrompt(null);
          }
        } else {
          setMeetingEndPrompt(null);
        }
      }
    } catch (err) {
      // Non-blocking background sync error
    }
  }, [user, getHeaders]);

  // Fetch full notifications list
  const fetchNotifications = useCallback(
    async (category?: string, search?: string) => {
      if (!user) return;
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (category && category !== 'ALL') params.set('category', category);
        if (search) params.set('search', search);
        params.set('limit', '25');

        const res = await fetch(`http://localhost:4000/api/notifications?${params.toString()}`, {
          headers: getHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          if (data.unreadCount) {
            setUnreadMetrics(data.unreadCount);
          }
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [user, getHeaders]
  );

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('http://localhost:4000/api/notifications/preferences', {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch {
      // Non-blocking
    }
  }, [user, getHeaders]);

  // Initial load & 30-second polling ticker
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    pollMetricsAndAlerts();
    fetchPreferences();

    const interval = setInterval(() => {
      pollMetricsAndAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, fetchNotifications, pollMetricsAndAlerts, fetchPreferences]);

  // Actions: Mark as Read
  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadMetrics(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));

      await fetch(`http://localhost:4000/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // Actions: Mark as Unread
  const markAsUnread = async (id: string) => {
    try {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read_at: null } : n))
      );
      setUnreadMetrics(prev => ({ ...prev, total: prev.total + 1 }));

      await fetch(`http://localhost:4000/api/notifications/${id}/unread`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
    } catch (err) {
      console.error('Failed to mark unread:', err);
    }
  };

  // Actions: Mark All as Read
  const markAllAsRead = async (category?: string) => {
    try {
      setNotifications(prev =>
        prev.map(n =>
          !category || category === 'ALL' || n.category === category
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadMetrics(prev => ({ ...prev, total: 0, critical: 0, high: 0 }));

      await fetch('http://localhost:4000/api/notifications/mark-all-read', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ category }),
      });
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Actions: Dismiss
  const dismissNotification = async (id: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      await fetch(`http://localhost:4000/api/notifications/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  // Actions: Request Browser Notification Permission
  const requestBrowserPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Browser notifications are not supported on this browser or platform.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);

      if (permission === 'granted') {
        await updatePreferences({ browser_notifications_enabled: true });
        new Notification('BDIQ Enterprise Notifications Enabled', {
          body: 'You will now receive meeting reminders and critical alerts even when BDIQ is in the background.',
          icon: '/favicon.ico',
        });
        return true;
      } else {
        await updatePreferences({ browser_notifications_enabled: false });
        return false;
      }
    } catch (err) {
      console.error('Permission request failed:', err);
      return false;
    }
  };

  // Actions: Send Test Alert
  const sendTestAlert = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/notifications/test-alert', {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) {
        const { notification } = await res.json();
        // Add toast
        addToast({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          priority: 'MEDIUM',
          category: 'SYSTEM',
          createdAt: Date.now(),
        });
        // If browser permission is granted and unfocused, fire Notification
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
          });
        }
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to send test alert:', err);
    }
  };

  // Actions: Update Preferences
  const updatePreferences = async (newPrefs: Partial<UserNotificationPreferences>) => {
    try {
      const res = await fetch('http://localhost:4000/api/notifications/preferences', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(newPrefs),
      });
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch (err) {
      console.error('Failed to update preferences:', err);
    }
  };

  // Prompt Dismissal Handlers
  const dismissMeetingStartPrompt = () => {
    if (meetingStartPrompt) {
      dismissedStartPromptIds.current.add(meetingStartPrompt.meetingId);
      setMeetingStartPrompt(null);
    }
  };

  const dismissMeetingEndPrompt = () => {
    if (meetingEndPrompt) {
      // Defer infinitely for this session (24 hours)
      deferredEndPromptMap.current.set(meetingEndPrompt.meetingId, Date.now() + 24 * 60 * 60 * 1000);
      setMeetingEndPrompt(null);
    }
  };

  const deferMeetingEndPrompt = (minutes = 10) => {
    if (meetingEndPrompt) {
      const resumeAt = Date.now() + minutes * 60 * 1000;
      deferredEndPromptMap.current.set(meetingEndPrompt.meetingId, resumeAt);
      setMeetingEndPrompt(null);
      addToast({
        id: `defer-${Date.now()}`,
        title: 'Reminder Deferred',
        message: `Meeting review prompt will remind you again in ${minutes} minutes.`,
        priority: 'LOW',
        category: 'MEETING',
        createdAt: Date.now(),
      });
    }
  };

  // Live Notes Modal Handlers
  const openLiveNotes = (meetingId: string) => {
    setActiveMeetingNotesId(meetingId);
    if (meetingStartPrompt?.meetingId === meetingId) {
      dismissMeetingStartPrompt();
    }
  };

  const closeLiveNotes = () => {
    setActiveMeetingNotesId(null);
  };

  // Review & Tasks Modal Handlers
  const openReviewAndTasks = (meetingId: string) => {
    setActiveReviewMeetingId(meetingId);
    if (meetingEndPrompt?.meetingId === meetingId) {
      setMeetingEndPrompt(null);
    }
  };

  const closeReviewAndTasks = () => {
    setActiveReviewMeetingId(null);
  };

  // Toast Helpers
  const addToast = (toast: ToastItem) => {
    setActiveToasts(prev => [toast, ...prev.slice(0, 4)]);
    setTimeout(() => {
      removeToast(toast.id);
    }, 6000);
  };

  const removeToast = (id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadMetrics,
        activeToasts,
        meetingStartPrompt,
        meetingEndPrompt,
        preferences,
        browserPermission,
        isLoading,
        activeMeetingNotesId,
        activeReviewMeetingId,
        isSettingsOpen,
        openSettings,
        closeSettings,
        fetchNotifications,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        dismissNotification,
        requestBrowserPermission,
        sendTestAlert,
        updatePreferences,
        dismissMeetingStartPrompt,
        dismissMeetingEndPrompt,
        deferMeetingEndPrompt,
        openLiveNotes,
        closeLiveNotes,
        openReviewAndTasks,
        closeReviewAndTasks,
        removeToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
