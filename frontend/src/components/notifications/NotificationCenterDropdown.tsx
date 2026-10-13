import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  AlertTriangle,
  Clock,
  Calendar,
  CheckSquare,
  Settings,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import type { NotificationCategory, NotificationPriority, AppNotification } from '@/types/notification';

interface NotificationCenterDropdownProps {
  onOpenSettings?: () => void;
}

export default function NotificationCenterDropdown({ onOpenSettings }: NotificationCenterDropdownProps) {
  const {
    notifications,
    unreadMetrics,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    dismissNotification,
  } = useNotifications();

  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Refetch when category filter changes
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    fetchNotifications(cat);
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read_at) {
      await markAsRead(n.id);
    }
    setIsOpen(false);
    if (n.action_url) {
      navigate(n.action_url);
    } else if (n.entity_type === 'meeting' && n.entity_id) {
      navigate(`/meetings/${n.entity_id}`);
    } else if (n.entity_type === 'task' && n.entity_id) {
      navigate(`/tasks/${n.entity_id}`);
    } else if (n.entity_type === 'rfq' && n.entity_id) {
      navigate(`/rfqs/${n.entity_id}`);
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-red-500/10 text-red-600 border border-red-500/20 flex items-center gap-1">
            <ShieldAlert className="w-2.5 h-2.5" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-muted-foreground bg-muted border border-border">
            LOW
          </span>
        );
    }
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'MEETING':
        return <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case 'TASK':
      case 'OVERDUE':
        return <CheckSquare className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDay < 7) return `${diffDay}d ago`;
      return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(selectedCategory);
        }}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors focus:outline-none"
        title="BDIQ Enterprise Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadMetrics.total > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center text-background ${
              unreadMetrics.critical > 0
                ? 'bg-red-600 animate-pulse'
                : 'bg-foreground'
            }`}
          >
            {unreadMetrics.total > 99 ? '99+' : unreadMetrics.total}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 rounded-xl border border-border bg-card shadow-2xl z-50 animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground tracking-tight">
                Notification Center
              </span>
              {unreadMetrics.total > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-foreground text-background font-semibold">
                  {unreadMetrics.total} UNREAD
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadMetrics.total > 0 && (
                <button
                  onClick={() => markAllAsRead(selectedCategory)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium hover:underline"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              {onOpenSettings ? (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings();
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Notification Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              ) : (
                <Link
                  to="/meetings/settings"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Notification Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="px-3 py-2 border-b border-border flex items-center gap-1 overflow-x-auto text-[11px] no-scrollbar">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'UNREAD', label: `Unread (${unreadMetrics.total})` },
              { key: 'MEETING', label: `Meetings (${unreadMetrics.meeting})` },
              { key: 'TASK', label: `Tasks (${unreadMetrics.task})` },
              { key: 'OVERDUE', label: 'Overdue' },
              { key: 'SYSTEM', label: 'Alerts' },
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => handleCategoryChange(cat.key)}
                className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === cat.key
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Notification Items List */}
          <div className="overflow-y-auto flex-1 divide-y divide-border">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-t-foreground border-r-transparent rounded-full animate-spin" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1">
                <CheckSquare className="w-6 h-6 text-muted-foreground/40 mb-1" />
                <span className="font-medium text-foreground">All caught up!</span>
                <span>No notifications in this category.</span>
              </div>
            ) : (
              notifications.map(n => {
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    className={`p-3 transition-colors relative group hover:bg-muted/30 ${
                      isUnread ? 'bg-muted/10' : 'opacity-85'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        onClick={() => handleNotificationClick(n)}
                        className="flex-1 cursor-pointer flex items-start gap-2.5"
                      >
                        <div className="mt-0.5">{getCategoryIcon(n.category)}</div>
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs ${
                                isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
                              }`}
                            >
                              {n.title}
                            </span>
                            {getPriorityBadge(n.priority)}
                            {isUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-muted-foreground">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{formatRelativeTime(n.created_at)}</span>
                            {n.action_url && (
                              <span className="text-foreground hover:underline flex items-center gap-0.5">
                                View record <ChevronRight className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Icons */}
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => (isUnread ? markAsRead(n.id) : markAsUnread(n.id))}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title={isUnread ? 'Mark as read' : 'Mark as unread'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => dismissNotification(n.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Dismiss notification"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-border bg-muted/20 flex items-center justify-between text-[11px]">
            <Link
              to="/tasks"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
            >
              <span>View Tasks Pipeline</span>
              <ExternalLink className="w-3 h-3" />
            </Link>

            <Link
              to="/meetings"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
            >
              <span>Meetings Calendar</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
