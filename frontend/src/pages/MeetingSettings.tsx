import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { meetingApi } from '@/services/meeting.api';
import type { MeetingConfiguration, MeetingTemplate } from '@/types/meeting';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  Settings,
  CheckCircle2,
  Save,
  Plus,
  Edit2,
  ArrowLeft,
  Bell,
  Globe,
  Send,
  BellRing,
} from 'lucide-react';

export default function MeetingSettings() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const {
    preferences,
    browserPermission,
    requestBrowserPermission,
    sendTestAlert,
    updatePreferences,
  } = useNotifications();

  const [configs, setConfigs] = useState<MeetingConfiguration[]>([]);
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'configs' | 'templates' | 'notifications'>('notifications');

  // Edit config state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editJsonValue, setEditJsonValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // New Template state
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateMeetingType, setTemplateMeetingType] = useState('Customer Meeting');
  const [templateAgenda, setTemplateAgenda] = useState('');
  const [templateDuration, setTemplateDuration] = useState(60);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const token = session?.access_token;
      const [cfgList, tplList] = await Promise.all([
        meetingApi.getConfigurations(token),
        meetingApi.listTemplates(token)
      ]);
      setConfigs(cfgList);
      setTemplates(tplList);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditConfig = (cfg: MeetingConfiguration) => {
    setEditingKey(cfg.config_key);
    setEditJsonValue(JSON.stringify(cfg.config_value, null, 2));
    setEditReason('');
    setSaveStatus(null);
  };

  const handleSaveConfig = async (key: string) => {
    try {
      const parsedValue = JSON.parse(editJsonValue);
      const updated = await meetingApi.updateConfiguration(
        key,
        parsedValue,
        editReason.trim() || 'Updated via configuration workbench',
        session?.access_token
      );
      setConfigs(prev => prev.map(c => c.config_key === key ? updated : c));
      setEditingKey(null);
      setSaveStatus('Setting updated successfully with audit history.');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      alert(`Invalid JSON or save error: ${err.message}`);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const agendaArray = templateAgenda
        .split('\n')
        .map(s => s.replace(/^[•\d.-]\s*/, '').trim())
        .filter(Boolean);

      const created = await meetingApi.createTemplate(
        {
          template_name: templateName.trim(),
          meeting_type: templateMeetingType,
          default_agenda: agendaArray,
          default_duration_minutes: templateDuration
        },
        session?.access_token
      );
      setTemplates(prev => [...prev, created]);
      setShowNewTemplateModal(false);
      setTemplateName('');
      setTemplateAgenda('');
    } catch (err: any) {
      alert(`Failed to create template: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/meetings')}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Meeting Intelligence
          </button>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-primary" />
            Meeting & Follow-up Configuration Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage organization-wide meeting policies, reminder offsets, SLA thresholds, and agenda templates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === 'templates' && (
            <button
              onClick={() => setShowNewTemplateModal(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Meeting Template
            </button>
          )}
        </div>
      </div>

      {saveStatus && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
        <button
          onClick={() => setActiveSection('configs')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
            activeSection === 'configs' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Policies & Configurations ({configs.length})
        </button>
        <button
          onClick={() => setActiveSection('templates')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
            activeSection === 'templates' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Agenda & Meeting Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveSection('notifications')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
            activeSection === 'notifications' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          Notification & Reminder Settings
        </button>
      </div>

      {/* SECTION 1: POLICIES & CONFIGURATIONS */}
      {activeSection === 'configs' && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-xs text-muted-foreground font-mono">Loading configuration rules...</p>
          ) : configs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No configurations found.</p>
          ) : (
            configs.map((cfg) => {
              const isEditing = editingKey === cfg.config_key;

              return (
                <div key={cfg.id} className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground">
                          {cfg.config_key}
                        </span>
                        <h3 className="text-sm font-bold text-foreground">{cfg.config_name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                          v{cfg.version}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{cfg.description}</p>
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => handleStartEditConfig(cfg)}
                        className="px-3 py-1 text-xs font-semibold rounded border border-border hover:bg-muted text-foreground flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Edit Setting
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 pt-2 border-t border-border/60">
                      <div>
                        <label className="block text-[11px] font-mono uppercase text-muted-foreground mb-1">
                          Edit Configuration Value (JSON)
                        </label>
                        <textarea
                          rows={6}
                          value={editJsonValue}
                          onChange={(e) => setEditJsonValue(e.target.value)}
                          className="w-full p-2.5 text-xs font-mono rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-1">
                          Reason for Change (recorded in audit logs)
                        </label>
                        <input
                          type="text"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          placeholder="e.g. Adjusted reminder offsets per management review"
                          className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                        />
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingKey(null)}
                          className="px-3 py-1.5 text-xs font-semibold rounded border border-border hover:bg-muted text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveConfig(cfg.config_key)}
                          className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                        >
                          <Save className="w-3.5 h-3.5" /> Save Configuration
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-muted/20 border border-border/80 font-mono text-xs whitespace-pre-wrap text-foreground max-h-40 overflow-y-auto">
                      {JSON.stringify(cfg.config_value, null, 2)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SECTION 2: TEMPLATES */}
      {activeSection === 'templates' && (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No templates configured yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => (
                <div key={tpl.id} className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                        {tpl.meeting_type}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {tpl.default_duration_minutes} min duration
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{tpl.template_name}</h3>
                    {tpl.description && <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>}
                  </div>

                  <div className="p-3 rounded-lg bg-muted/20 border border-border/60 text-xs font-mono space-y-1">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Default Agenda:</div>
                    {(tpl.default_agenda || []).map((ag, i) => (
                      <div key={i} className="text-foreground truncate">• {ag}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: NOTIFICATION & REMINDER SETTINGS */}
      {activeSection === 'notifications' && (
        <div className="space-y-5">
          {/* 1. Browser Notifications Banner */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center font-bold">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Browser Notifications API</h3>
                  <p className="text-xs text-muted-foreground">
                    Receive scheduled meeting countdowns and overdue task alerts even when BDIQ is in the background.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                    browserPermission === 'granted'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : browserPermission === 'denied'
                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  }`}
                >
                  {browserPermission === 'granted'
                    ? 'PERMISSION GRANTED'
                    : browserPermission === 'denied'
                    ? 'PERMISSION BLOCKED'
                    : 'NOT REQUESTED'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="text-xs text-muted-foreground">
                {browserPermission === 'granted' ? (
                  <span>Browser notifications are configured and active for this workstation.</span>
                ) : browserPermission === 'denied' ? (
                  <span className="text-red-500">
                    Notifications are blocked in your browser. Click the lock/site settings icon in your URL bar to allow notifications.
                  </span>
                ) : (
                  <span>Click below to allow BDIQ to show native system banners.</span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {browserPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={requestBrowserPermission}
                    className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>Enable Browser Notifications</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={sendTestAlert}
                  className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Send Test Alert</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Meeting Reminder Offsets Configuration */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
            <div className="pb-2 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Meeting Reminder Offsets</h3>
                <p className="text-xs text-muted-foreground">
                  Control which timing milestones trigger in-app toasts and browser notifications.
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">Server Scheduler (60s loop)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {[
                { label: '24 Hours Before Start', desc: 'Advance preparation reminder', offset: 1440 },
                { label: '1 Hour Before Start', desc: 'Pre-meeting readiness alert', offset: 60 },
                { label: '15 Minutes Before Start', desc: 'Join call preparation alert', offset: 15 },
                { label: '5 Minutes Before Start', desc: 'Final countdown alert with Teams link', offset: 5 },
              ].map(item => {
                const isChecked = (preferences?.meeting_offsets_minutes || []).includes(item.offset);
                return (
                  <label
                    key={item.offset}
                    className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
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
                      <div className="font-semibold text-foreground">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Pop-up Modals Toggles */}
            <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs border-t border-border">
              <label className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={preferences?.meeting_start_popup_enabled ?? true}
                  onChange={e => updatePreferences({ meeting_start_popup_enabled: e.target.checked })}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <div className="font-semibold text-foreground">Meeting-Start Pop-Up Prompt</div>
                  <div className="text-[11px] text-muted-foreground">
                    Display "Your meeting has started" modal at exact scheduled start time with Open Teams and Start Notes.
                  </div>
                </div>
              </label>

              <label className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={preferences?.meeting_end_popup_enabled ?? true}
                  onChange={e => updatePreferences({ meeting_end_popup_enabled: e.target.checked })}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <div className="font-semibold text-foreground">Scheduled-End Pop-Up Prompt</div>
                  <div className="text-[11px] text-muted-foreground">
                    Display "Meeting time has ended" modal prompting to review captured notes and create canonical tasks.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 3. Task & Follow-up Reminders */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
            <div className="pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">Task & Due-Date Reminders</h3>
              <p className="text-xs text-muted-foreground">
                Automated alerts for commitments due today, overdue tasks, and SLA escalations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <label className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={preferences?.task_due_reminders_enabled ?? true}
                  onChange={e => updatePreferences({ task_due_reminders_enabled: e.target.checked })}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <div className="font-semibold text-foreground">Due Today Reminders</div>
                  <div className="text-[11px] text-muted-foreground">
                    Alert assigned users when a task follow-up commitment is due on the current calendar date.
                  </div>
                </div>
              </label>

              <label className="p-3.5 rounded-lg border border-border bg-muted/20 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={preferences?.task_overdue_reminders_enabled ?? true}
                  onChange={e => updatePreferences({ task_overdue_reminders_enabled: e.target.checked })}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <div className="font-semibold text-foreground">Overdue Task Alerts</div>
                  <div className="text-[11px] text-muted-foreground">
                    Calculate delay strictly from original due date and dispatch alerts to assignees and watchers.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 4. Quiet Hours */}
          <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
            <div className="pb-2 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Quiet Hours Configuration</h3>
                <p className="text-xs text-muted-foreground">
                  Suppress non-critical notifications during designated quiet periods.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={preferences?.quiet_hours_enabled ?? false}
                  onChange={e => updatePreferences({ quiet_hours_enabled: e.target.checked })}
                  className="rounded border-border"
                />
                <span>Enable Quiet Hours</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Quiet Hours Start</label>
                <input
                  type="time"
                  value={preferences?.quiet_hours_start || '22:00'}
                  onChange={e => updatePreferences({ quiet_hours_start: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Quiet Hours End</label>
                <input
                  type="time"
                  value={preferences?.quiet_hours_end || '07:00'}
                  onChange={e => updatePreferences({ quiet_hours_end: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Template Modal */}
      {showNewTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Create Meeting Template</h3>
            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. Regulatory Filing Alignment"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Meeting Type</label>
                <select
                  value={templateMeetingType}
                  onChange={(e) => setTemplateMeetingType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground"
                >
                  <option value="Customer Meeting">Customer Meeting</option>
                  <option value="Internal BD Meeting">Internal BD Meeting</option>
                  <option value="R&D Discussion">R&D Discussion</option>
                  <option value="Regulatory Discussion">Regulatory Discussion</option>
                  <option value="Production Review">Production Review</option>
                  <option value="Commercial Discussion">Commercial Discussion</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={templateDuration}
                  onChange={(e) => setTemplateDuration(parseInt(e.target.value, 10) || 60)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Default Agenda Items (one per line)</label>
                <textarea
                  rows={4}
                  value={templateAgenda}
                  onChange={(e) => setTemplateAgenda(e.target.value)}
                  placeholder="Review previous actions&#10;Dossier status check&#10;Next submission date"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTemplateModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-border hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
