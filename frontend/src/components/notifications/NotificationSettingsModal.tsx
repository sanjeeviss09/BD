import { useState } from 'react';
import {
  X,
  Bell,
  BellRing,
  Globe,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  ExternalLink,
  Sliders,
  Moon
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { Link } from 'react-router-dom';
import { ModernTimePicker } from '@/components/ui/ModernTimePicker';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const {
    preferences,
    browserPermission,
    requestBrowserPermission,
    sendTestAlert,
    updatePreferences,
  } = useNotifications();

  const [testSent, setTestSent] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'meetings' | 'tasks' | 'quiet'>('general');

  if (!isOpen) return null;

  const handleSendTest = async () => {
    await sendTestAlert();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Enterprise Notification Settings</h3>
              <p className="text-[11px] text-muted-foreground">
                In-app alerts, browser notifications, scheduled meeting reminders & quiet hours
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-border flex items-center gap-2 text-xs font-medium bg-muted/10 overflow-x-auto">
          {[
            { id: 'general', label: 'Browser & In-App', icon: Globe },
            { id: 'meetings', label: 'Meeting Reminders', icon: Clock },
            { id: 'tasks', label: 'Tasks & SLAs', icon: CheckCircle2 },
            { id: 'quiet', label: 'Quiet Hours', icon: Moon },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-foreground text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* TAB 1: Browser & In-App */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Browser Permission Card */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-foreground" />
                    <div>
                      <h4 className="font-semibold text-foreground text-xs">Browser Push & System Alerts</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Receive desktop alerts even when BDIQ is in a background tab
                      </p>
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      browserPermission === 'granted'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : browserPermission === 'denied'
                        ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    Status: {browserPermission}
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  {browserPermission === 'granted' ? (
                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Browser notifications are permitted and active on this workstation.
                    </span>
                  ) : browserPermission === 'denied' ? (
                    <span className="text-red-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Notifications are blocked in your browser settings. Please click the site settings icon in your URL bar to allow.
                    </span>
                  ) : (
                    <span>Click below to allow BDIQ to display native background notifications.</span>
                  )}
                </div>

                <div className="pt-1 flex items-center gap-2">
                  {browserPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={requestBrowserPermission}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1.5"
                    >
                      <BellRing className="w-3.5 h-3.5" />
                      <span>Enable Browser Notifications</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSendTest}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3 text-muted-foreground" />
                    <span>Send Test Notification</span>
                  </button>
                  {testSent && (
                    <span className="text-[11px] text-emerald-600 font-medium">Test alert dispatched!</span>
                  )}
                </div>
              </div>

              {/* In-App Toggle */}
              <label className="p-3.5 rounded-lg border border-border bg-card flex items-start gap-3 cursor-pointer hover:bg-muted/20 transition-colors">
                <input
                  type="checkbox"
                  checked={preferences?.in_app_enabled ?? true}
                  onChange={e => updatePreferences({ in_app_enabled: e.target.checked })}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <div className="font-semibold text-foreground">Global In-App Notification Bell</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Maintain real-time unread badges and drop-down inbox in the application header.
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* TAB 2: Meeting Reminders */}
          {activeTab === 'meetings' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-foreground text-xs mb-1">Automated Meeting Milestones</h4>
                <p className="text-[11px] text-muted-foreground mb-3">
                  The backend scheduler evaluates upcoming meetings every 60 seconds against your chosen timing offsets.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: '24 Hours Prior', desc: 'Advance preparation reminder', offset: 1440 },
                    { label: '1 Hour Prior', desc: 'Pre-meeting readiness alert', offset: 60 },
                    { label: '15 Minutes Prior', desc: 'Join call readiness alert', offset: 15 },
                    { label: '5 Minutes Prior', desc: 'Final countdown alert with meeting link', offset: 5 },
                  ].map(item => {
                    const isChecked = (preferences?.meeting_offsets_minutes || []).includes(item.offset);
                    return (
                      <label
                        key={item.offset}
                        className="p-3 rounded-lg border border-border bg-card flex items-start gap-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const current = preferences?.meeting_offsets_minutes || [1440, 60, 15, 5, 0];
                            const updated = e.target.checked
                              ? [...current, item.offset]
                              : current.filter(x => x !== item.offset);
                            updatePreferences({ meeting_offsets_minutes: updated });
                          }}
                          className="mt-0.5 rounded border-border"
                        />
                        <div>
                          <div className="font-semibold text-foreground text-xs">{item.label}</div>
                          <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Pop-up Modals */}
              <div className="pt-2 border-t border-border space-y-2">
                <h4 className="font-semibold text-foreground text-xs mb-1">Interactive Meeting Modals</h4>
                <label className="p-3 rounded-lg border border-border bg-card flex items-start gap-2.5 cursor-pointer hover:bg-muted/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={preferences?.meeting_start_popup_enabled ?? true}
                    onChange={e => updatePreferences({ meeting_start_popup_enabled: e.target.checked })}
                    className="mt-0.5 rounded border-border"
                  />
                  <div>
                    <div className="font-semibold text-foreground">Meeting-Start Pop-Up</div>
                    <div className="text-[10px] text-muted-foreground">
                      Display modal at scheduled start time with Open Teams, Start Notes, and agenda items.
                    </div>
                  </div>
                </label>

                <label className="p-3 rounded-lg border border-border bg-card flex items-start gap-2.5 cursor-pointer hover:bg-muted/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={preferences?.meeting_end_popup_enabled ?? true}
                    onChange={e => updatePreferences({ meeting_end_popup_enabled: e.target.checked })}
                    className="mt-0.5 rounded border-border"
                  />
                  <div>
                    <div className="font-semibold text-foreground">Scheduled-End Pop-Up</div>
                    <div className="text-[10px] text-muted-foreground">
                      Display modal when scheduled end time arrives to prompt review of notes and task creation.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Tasks & SLAs */}
          {activeTab === 'tasks' && (
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground text-xs">Task Due Dates & Follow-Ups</h4>
              <p className="text-[11px] text-muted-foreground mb-3">
                Calculates delay strictly from the original due date, ensuring immutable accountability.
              </p>

              <label className="p-3.5 rounded-lg border border-border bg-card flex items-start gap-3 cursor-pointer hover:bg-muted/20 transition-colors">
                <input
                  type="checkbox"
                  checked={preferences?.task_due_reminders_enabled ?? true}
                  onChange={e => updatePreferences({ task_due_reminders_enabled: e.target.checked })}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <div className="font-semibold text-foreground">Task Due-Date Reminders</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Trigger reminders in the morning for tasks reaching their SLA due date today.
                  </div>
                </div>
              </label>

              <label className="p-3.5 rounded-lg border border-border bg-card flex items-start gap-3 cursor-pointer hover:bg-muted/20 transition-colors">
                <input
                  type="checkbox"
                  checked={preferences?.task_overdue_reminders_enabled ?? true}
                  onChange={e => updatePreferences({ task_overdue_reminders_enabled: e.target.checked })}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <div className="font-semibold text-foreground">Overdue Task & SLA Escalation Alerts</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Flag critical overdue commitments to responsible assignees, backups, and department leads.
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* TAB 4: Quiet Hours */}
          {activeTab === 'quiet' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-foreground" />
                    <div>
                      <h4 className="font-semibold text-foreground text-xs">Do Not Disturb / Quiet Hours</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Suppress audio alerts and intrusive toasts during designated rest periods
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences?.quiet_hours_enabled ?? false}
                      onChange={e => updatePreferences({ quiet_hours_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-foreground"></div>
                  </label>
                </div>

                {preferences?.quiet_hours_enabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-foreground mb-1">
                        Quiet Hours Start
                      </label>
                      <ModernTimePicker
                        value={preferences?.quiet_hours_start || '22:00'}
                        onChange={val => updatePreferences({ quiet_hours_start: val })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-foreground mb-1">
                        Quiet Hours End
                      </label>
                      <ModernTimePicker
                        value={preferences?.quiet_hours_end || '07:00'}
                        onChange={val => updatePreferences({ quiet_hours_end: val })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
          <Link
            to="/meetings/settings"
            onClick={onClose}
            className="text-[11px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-1"
          >
            <Sliders className="w-3 h-3" />
            <span>Advanced Configuration & Audit Logs</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </Link>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
