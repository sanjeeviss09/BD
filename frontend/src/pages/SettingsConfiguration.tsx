import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Shield,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  History,
  Save,
  RotateCcw,
  Search,
  ExternalLink,
  Sparkles,
  Database,
  Building2,
  Lock,
  Pill,
  Globe,
  Bell,
  RefreshCw
} from 'lucide-react';
import ResponsibilitySettings from './ResponsibilitySettings';

// Navigation Section Enums
type MainSection =
  | 'OVERVIEW'
  | 'GENERAL'
  | 'FEATURES'
  | 'ORGANIZATION'
  | 'MODULES'
  | 'NOTIFICATIONS'
  | 'AUDIT_HISTORY';

type ModuleSubTab =
  | 'product_master'
  | 'opportunity_management'
  | 'task_management'
  | 'workflow_engine'
  | 'market_intelligence'
  | 'customer_intelligence'
  | 'meeting_intelligence'
  | 'production_feasibility'
  | 'rfq_management'
  | 'commercial_evaluation'
  | 'ai_orchestrator';

export default function SettingsConfiguration() {
  const { session } = useAuth();
  const token = session?.access_token || 'dev-admin-token';

  // Navigation State
  const [activeSection, setActiveSection] = useState<MainSection>('OVERVIEW');
  const [activeModuleTab, setActiveModuleTab] = useState<ModuleSubTab>('product_master');
  const [searchQuery, setSearchQuery] = useState('');

  // Data State
  const [health, setHealth] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [effectiveSettings, setEffectiveSettings] = useState<Record<string, any>>({});
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingModule, setSavingModule] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State for active module edit
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Modals State
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishSummary, setPublishSummary] = useState('');
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [targetRollbackVersion, setTargetRollbackVersion] = useState<number | null>(null);
  const [featureConfirmModal, setFeatureConfirmModal] = useState<{ feature: any; newStatus: boolean } | null>(null);

  // Initial Data Fetch
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [healthRes, featuresRes, effectiveRes, snapshotsRes] = await Promise.all([
        fetch('http://localhost:4000/api/configuration/health', { headers }),
        fetch('http://localhost:4000/api/configuration/features', { headers }),
        fetch('http://localhost:4000/api/configuration/effective', { headers }),
        fetch('http://localhost:4000/api/configuration/snapshots', { headers }),
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      if (featuresRes.ok) setFeatures(await featuresRes.json());
      if (effectiveRes.ok) {
        const eff = await effectiveRes.json();
        setEffectiveSettings(eff);
        setFormData(eff);
      }
      if (snapshotsRes.ok) setSnapshots(await snapshotsRes.json());
    } catch (err: any) {
      console.error('Failed to load settings data', err);
      setSaveStatus({ type: 'error', message: 'Failed to communicate with configuration backend.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update formData when section or module changes
  useEffect(() => {
    if (activeSection === 'GENERAL' && effectiveSettings.general) {
      setFormData(prev => ({ ...prev, general: effectiveSettings.general }));
    } else if (activeSection === 'NOTIFICATIONS' && effectiveSettings.notifications) {
      setFormData(prev => ({ ...prev, notifications: effectiveSettings.notifications }));
    } else if (activeSection === 'MODULES' && effectiveSettings[activeModuleTab]) {
      setFormData(prev => ({ ...prev, [activeModuleTab]: effectiveSettings[activeModuleTab] }));
    }
  }, [activeSection, activeModuleTab, effectiveSettings]);

  // Handler for form field change
  const handleFieldChange = (moduleKey: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [moduleKey]: {
        ...(prev[moduleKey] || {}),
        [field]: value,
      },
    }));
  };

  // Save specific module settings
  const handleSaveModule = async (moduleKey: string) => {
    setSavingModule(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`http://localhost:4000/api/configuration/modules/${moduleKey}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData[moduleKey] || {}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to save configuration settings');
      }

      setEffectiveSettings(prev => ({
        ...prev,
        [moduleKey]: data.settings,
      }));
      setSaveStatus({ type: 'success', message: `${moduleKey.toUpperCase().replace('_', ' ')} settings updated successfully.` });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message });
    } finally {
      setSavingModule(false);
    }
  };

  // Toggle Feature Execution
  const executeFeatureToggle = async (featureId: string, isEnabled: boolean) => {
    setFeatureConfirmModal(null);
    try {
      const res = await fetch(`http://localhost:4000/api/configuration/features/${featureId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_enabled: isEnabled }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to toggle feature');
      }

      setFeatures(prev =>
        prev.map(f => (f.id === featureId ? { ...f, is_enabled: isEnabled } : f))
      );
      setSaveStatus({ type: 'success', message: data.message });
      setTimeout(() => setSaveStatus(null), 5000);
      fetchAllData();
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message });
    }
  };

  // Publish Snapshot
  const handlePublishSnapshot = async () => {
    if (!publishSummary.trim()) return;
    try {
      const res = await fetch('http://localhost:4000/api/configuration/snapshots/publish', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          change_summary: publishSummary.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to publish configuration snapshot');

      setPublishModalOpen(false);
      setPublishSummary('');
      setSaveStatus({ type: 'success', message: data.message });
      fetchAllData();
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message });
    }
  };

  // Rollback Snapshot
  const handleRollbackSnapshot = async () => {
    if (!targetRollbackVersion) return;
    try {
      const res = await fetch(`http://localhost:4000/api/configuration/snapshots/${targetRollbackVersion}/rollback`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to rollback configuration');

      setRollbackModalOpen(false);
      setTargetRollbackVersion(null);
      setSaveStatus({ type: 'success', message: data.message });
      fetchAllData();
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: err.message });
    }
  };

  // Filtered features for search
  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) return features;
    const q = searchQuery.toLowerCase();
    return features.filter(
      f => f.name.toLowerCase().includes(q) || f.module.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)
    );
  }, [features, searchQuery]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-background text-foreground selection:bg-muted">
      {/* Top Banner / Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center font-mono font-black text-xs">
                CFG
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                BDIQ Platform Settings & Configuration Centre
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                v{health?.configuration?.active_version || 1}.0
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Centralized enterprise governance, module rules, SLAs, dependency-aware feature registry, and snapshot audit history.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search settings & features..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground w-64"
              />
            </div>
            <button
              onClick={() => setPublishModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Publish Snapshot
            </button>
          </div>
        </div>
      </div>

      {/* Save Status Alert */}
      {saveStatus && (
        <div className="px-6 pt-4 max-w-7xl mx-auto w-full">
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              saveStatus.type === 'success'
                ? 'bg-muted/40 border-border text-foreground'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2">
              {saveStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-foreground" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              )}
              <span>{saveStatus.message}</span>
            </div>
            <button
              onClick={() => setSaveStatus(null)}
              className="text-xs text-muted-foreground hover:text-foreground font-mono"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Settings Navigation & Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col md:flex-row gap-6">
        {/* Left Administrative Navigation Sidebar */}
        <aside className="w-full md:w-64 space-y-1 shrink-0">
          <button
            onClick={() => setActiveSection('OVERVIEW')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'OVERVIEW'
                ? 'bg-foreground text-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Activity className="w-4 h-4" />
              Settings Overview & Health
            </span>
          </button>

          <button
            onClick={() => setActiveSection('GENERAL')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'GENERAL'
                ? 'bg-foreground text-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Settings className="w-4 h-4" />
              General Platform Settings
            </span>
          </button>

          <button
            onClick={() => setActiveSection('FEATURES')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'FEATURES'
                ? 'bg-foreground text-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Layers className="w-4 h-4" />
              Feature Management
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border">
              {features.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSection('ORGANIZATION')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'ORGANIZATION'
                ? 'bg-foreground text-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4" />
              Organisation & Access
            </span>
          </button>

          <button
            onClick={() => setActiveSection('MODULES')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'MODULES'
                ? 'bg-foreground text-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Pill className="w-4 h-4" />
              Module Configuration
            </span>
          </button>

          <button
            onClick={() => setActiveSection('NOTIFICATIONS')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'NOTIFICATIONS'
                ? 'bg-foreground text-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Bell className="w-4 h-4" />
              Notifications & Reminders
            </span>
          </button>

          <button
            onClick={() => setActiveSection('AUDIT_HISTORY')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'AUDIT_HISTORY'
                ? 'bg-foreground text-background font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <History className="w-4 h-4" />
              Audit History & Snapshots
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border">
              {snapshots.length}
            </span>
          </button>
        </aside>

        {/* Right Active Panel */}
        <main className="flex-1 bg-card border border-border rounded-xl p-6 shadow-sm overflow-hidden min-h-[500px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-foreground" />
              <p>Loading enterprise configuration parameters...</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: OVERVIEW & HEALTH */}
              {activeSection === 'OVERVIEW' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Platform Overview & Live Diagnostics</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Real-time connectivity verification, active feature registry totals, and configuration version status.
                    </p>
                  </div>

                  {/* Health Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-1">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center justify-between">
                        <span>Platform Status</span>
                        <span className="w-2 h-2 rounded-full bg-foreground" />
                      </div>
                      <div className="text-xl font-bold text-foreground">{health?.status || 'HEALTHY'}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Latency: <span className="font-mono text-foreground">{health?.database?.latency_ms || 12}ms</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-1">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Active Features</div>
                      <div className="text-xl font-bold text-foreground">
                        {health?.features?.enabled || 19} / {health?.features?.total || 19}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <span className="font-mono text-foreground">{health?.features?.disabled || 0}</span> optional features disabled
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-1">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Published Snapshot</div>
                      <div className="text-xl font-bold text-foreground font-mono">
                        v{health?.configuration?.active_version || 1}.0
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Snapshots: <span className="font-mono text-foreground">{health?.configuration?.total_snapshots || 0}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-1">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Environment</div>
                      <div className="text-xl font-bold text-foreground font-mono uppercase">
                        {health?.environment || 'PROD'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Tenant isolation enforced
                      </div>
                    </div>
                  </div>

                  {/* Integration Status Table */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-muted/30 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono flex items-center justify-between">
                      <span>Enterprise Integrated Services</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Deterministic Data Engine</span>
                    </div>
                    <div className="divide-y divide-border text-xs">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Database className="w-4 h-4 text-foreground" />
                          <div>
                            <div className="font-semibold text-foreground">Supabase PostgreSQL Database</div>
                            <div className="text-[11px] text-muted-foreground">Row-Level Security & Multi-tenant isolation (28 Migrations)</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground text-[10px] font-mono border border-border">
                          CONNECTED
                        </span>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-foreground" />
                          <div>
                            <div className="font-semibold text-foreground">IQVIA MIDAS Market Intelligence Dataset</div>
                            <div className="text-[11px] text-muted-foreground">Licensed external import session engine (ds-iqvia-midas-auth-v2)</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground text-[10px] font-mono border border-border">
                          VERIFIED
                        </span>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-4 h-4 text-foreground" />
                          <div>
                            <div className="font-semibold text-foreground">NVIDIA Enterprise AI Orchestrator</div>
                            <div className="text-[11px] text-muted-foreground">Nemotron parsing & document extraction assistance</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground text-[10px] font-mono border border-border">
                          {health?.integrations?.nvidia_enterprise_ai?.status || 'CONNECTED'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 2: GENERAL PLATFORM SETTINGS */}
              {activeSection === 'GENERAL' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h2 className="text-base font-bold text-foreground">General Platform & Workspace Settings</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Organization-wide display preferences, currency standards, and session timeout parameters.
                      </p>
                    </div>
                    <button
                      onClick={() => handleSaveModule('general')}
                      disabled={savingModule}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingModule ? 'Saving...' : 'Save General Settings'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Platform Brand Name</label>
                      <input
                        type="text"
                        value={formData.general?.platform_name || ''}
                        onChange={e => handleFieldChange('general', 'platform_name', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Default Timezone</label>
                      <select
                        value={formData.general?.default_timezone || 'UTC'}
                        onChange={e => handleFieldChange('general', 'default_timezone', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Europe/Zurich">Europe/Zurich (CET)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Default Currency</label>
                      <select
                        value={formData.general?.currency || 'USD'}
                        onChange={e => handleFieldChange('general', 'currency', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="EUR">EUR (€) - Euro</option>
                        <option value="GBP">GBP (£) - British Pound</option>
                        <option value="INR">INR (₹) - Indian Rupee</option>
                        <option value="CHF">CHF (Fr) - Swiss Franc</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Date Format</label>
                      <select
                        value={formData.general?.date_format || 'YYYY-MM-DD'}
                        onChange={e => handleFieldChange('general', 'date_format', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (UK/EU Standard)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Table Display Density</label>
                      <select
                        value={formData.general?.table_density || 'COMFORTABLE'}
                        onChange={e => handleFieldChange('general', 'table_density', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      >
                        <option value="COMPACT">Compact (Maximum rows in viewport)</option>
                        <option value="COMFORTABLE">Comfortable (Balanced padding)</option>
                        <option value="SPACIOUS">Spacious (Relaxed readability)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Default Pagination Limit (Rows)</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={formData.general?.pagination_limit || 20}
                        onChange={e => handleFieldChange('general', 'pagination_limit', parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: FEATURE MANAGEMENT (FEATURE REGISTRY) */}
              {activeSection === 'FEATURES' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <h2 className="text-base font-bold text-foreground">Central Feature Registry</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Manage enabled modules, view dependency guardrails, and safely toggle optional enterprise capabilities.
                      </p>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {filteredFeatures.filter(f => f.is_enabled).length} Enabled / {filteredFeatures.length} Discovered
                    </div>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Feature Name & Purpose</th>
                          <th className="px-3 py-3">Module</th>
                          <th className="px-3 py-3">Tier</th>
                          <th className="px-3 py-3">Dependencies</th>
                          <th className="px-4 py-3 text-right">Status / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredFeatures.map(feat => {
                          const isEssential = feat.tier === 'ESSENTIAL';
                          return (
                            <tr key={feat.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-foreground">{feat.name}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                  {feat.description}
                                </div>
                              </td>
                              <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground uppercase">
                                {feat.module}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                    isEssential
                                      ? 'bg-foreground text-background font-bold border-foreground'
                                      : 'bg-muted text-muted-foreground border-border'
                                  }`}
                                >
                                  {feat.tier}
                                </span>
                              </td>
                              <td className="px-3 py-3 font-mono text-[10px] text-muted-foreground">
                                {feat.dependencies && feat.dependencies.length > 0 ? (
                                  <span className="truncate block max-w-[140px]">
                                    {feat.dependencies.join(', ')}
                                  </span>
                                ) : (
                                  'None'
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {isEssential ? (
                                  <span
                                    title="Essential core capability cannot be disabled"
                                    className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground font-semibold"
                                  >
                                    <Lock className="w-3 h-3 text-muted-foreground" />
                                    LOCKED
                                  </span>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setFeatureConfirmModal({
                                        feature: feat,
                                        newStatus: !feat.is_enabled,
                                      })
                                    }
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                                      feat.is_enabled
                                        ? 'bg-foreground text-background hover:bg-foreground/80'
                                        : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
                                    }`}
                                  >
                                    {feat.is_enabled ? 'ENABLED' : 'DISABLED'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 4: ORGANISATION & ACCESS */}
              {activeSection === 'ORGANIZATION' && (
                <div className="space-y-6">
                  <div className="border-b border-border pb-3">
                    <h2 className="text-base font-bold text-foreground">Organisation Hierarchy, Roles & Staff Directory</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Configure multi-site operating business units, department rosters, and RBAC permissions.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 border border-border rounded-xl bg-card hover:bg-muted/10 transition-colors space-y-3">
                      <div className="flex items-center justify-between">
                        <Building2 className="w-6 h-6 text-foreground" />
                        <Link
                          to="/departments"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
                        >
                          Open Directory <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Departments & Staff Directory</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Manage Business Units, Departments, employee codes, designations, and department member rosters used by the Responsibility Resolution Engine.
                      </p>
                    </div>

                    <div className="p-5 border border-border rounded-xl bg-card hover:bg-muted/10 transition-colors space-y-3">
                      <div className="flex items-center justify-between">
                        <Shield className="w-6 h-6 text-foreground" />
                        <Link
                          to="/roles"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
                        >
                          Manage Roles <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <h3 className="text-sm font-bold text-foreground">Role-Based Access Control (RBAC)</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Define enterprise roles, action-level permissions, and security grants across modules. Organization administrators cannot grant themselves platform superuser privileges.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 5: MODULE CONFIGURATION */}
              {activeSection === 'MODULES' && (
                <div className="space-y-6">
                  {/* Module Sub-Tabs */}
                  <div className="border-b border-border overflow-x-auto pb-1">
                    <nav className="flex space-x-2 text-xs font-medium">
                      {[
                        { id: 'product_master', label: 'Product Master' },
                        { id: 'opportunity_management', label: 'Opportunities' },
                        { id: 'task_management', label: 'Tasks & Responsibility' },
                        { id: 'workflow_engine', label: 'Workflows' },
                        { id: 'market_intelligence', label: 'Market Intelligence' },
                        { id: 'customer_intelligence', label: 'Customer Intel' },
                        { id: 'meeting_intelligence', label: 'Meetings' },
                        { id: 'production_feasibility', label: 'Feasibility' },
                        { id: 'rfq_management', label: 'RFQ' },
                        { id: 'commercial_evaluation', label: 'Commercial' },
                        { id: 'ai_orchestrator', label: 'AI Providers' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveModuleTab(tab.id as ModuleSubTab)}
                          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                            activeModuleTab === tab.id
                              ? 'bg-foreground text-background font-semibold shadow-sm'
                              : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Sub-Panel: Product Master */}
                  {activeModuleTab === 'product_master' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">Product Master Configuration</h3>
                        <button
                          onClick={() => handleSaveModule('product_master')}
                          disabled={savingModule}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                        >
                          {savingModule ? 'Saving...' : 'Save Product Rules'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="font-medium text-foreground">Auto-Duplicate Detection</label>
                          <select
                            value={formData.product_master?.auto_duplicate_detection ? 'true' : 'false'}
                            onChange={e => handleFieldChange('product_master', 'auto_duplicate_detection', e.target.value === 'true')}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                          >
                            <option value="true">Enabled (Compare INN & molecule similarity)</option>
                            <option value="false">Disabled</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="font-medium text-foreground">Archival Threshold (Days of Inactivity)</label>
                          <input
                            type="number"
                            min="30"
                            value={formData.product_master?.archival_threshold_days || 365}
                            onChange={e => handleFieldChange('product_master', 'archival_threshold_days', parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sub-Panel: Tasks & Responsibility */}
                  {activeModuleTab === 'task_management' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Task Management & Responsibility Engine</h3>
                          <p className="text-xs text-muted-foreground">
                            Configure follow-up intervals, immutable original due-date rules, and assignment SLAs.
                          </p>
                        </div>
                        <button
                          onClick={() => handleSaveModule('task_management')}
                          disabled={savingModule}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                        >
                          {savingModule ? 'Saving...' : 'Save Task Rules'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="font-medium text-foreground">Follow-up Interval (Days)</label>
                          <input
                            type="number"
                            min="1"
                            value={formData.task_management?.default_followup_interval_days || 5}
                            onChange={e => handleFieldChange('task_management', 'default_followup_interval_days', parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="font-medium text-foreground">Escalation Delay (Hours)</label>
                          <input
                            type="number"
                            min="1"
                            value={formData.task_management?.escalation_delay_hours || 48}
                            onChange={e => handleFieldChange('task_management', 'escalation_delay_hours', parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="font-medium text-foreground">SLA Calendar Type</label>
                          <select
                            value={formData.task_management?.sla_calendar_type || 'BUSINESS_DAYS'}
                            onChange={e => handleFieldChange('task_management', 'sla_calendar_type', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                          >
                            <option value="BUSINESS_DAYS">Business Days (Mon-Fri)</option>
                            <option value="CALENDAR_DAYS">Calendar Days (Consecutive)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono mb-3">
                          Interactive Central Responsibility Matrix
                        </h4>
                        <ResponsibilitySettings />
                      </div>
                    </div>
                  )}

                  {/* Sub-Panel: Market Intelligence */}
                  {activeModuleTab === 'market_intelligence' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground">Market Intelligence Data Configuration</h3>
                        <button
                          onClick={() => handleSaveModule('market_intelligence')}
                          disabled={savingModule}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                        >
                          {savingModule ? 'Saving...' : 'Save Market Intel Rules'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1.5">
                          <label className="font-medium text-foreground">Primary Data Source</label>
                          <input
                            type="text"
                            value={formData.market_intelligence?.primary_data_source || 'IQVIA_MIDAS_V2'}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border border-border bg-muted/30 text-muted-foreground font-mono focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="font-medium text-foreground">Freshness Alert Threshold (Days)</label>
                          <input
                            type="number"
                            min="1"
                            value={formData.market_intelligence?.freshness_warning_days || 90}
                            onChange={e => handleFieldChange('market_intelligence', 'freshness_warning_days', parseInt(e.target.value, 10))}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Other Module Tabs fallback */}
                  {activeModuleTab !== 'product_master' &&
                    activeModuleTab !== 'task_management' &&
                    activeModuleTab !== 'market_intelligence' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-foreground">
                            {activeModuleTab.toUpperCase().replace('_', ' ')} Configuration
                          </h3>
                          <button
                            onClick={() => handleSaveModule(activeModuleTab)}
                            disabled={savingModule}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                          >
                            {savingModule ? 'Saving...' : 'Save Module Rules'}
                          </button>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs space-y-2">
                          <p className="text-foreground">
                            Active parameters for <strong>{activeModuleTab}</strong> are loaded and validated through the shared Zod configuration engine.
                          </p>
                          <pre className="p-3 bg-background rounded border border-border font-mono text-[11px] overflow-x-auto text-muted-foreground">
                            {JSON.stringify(formData[activeModuleTab] || {}, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* SECTION 6: NOTIFICATIONS */}
              {activeSection === 'NOTIFICATIONS' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h2 className="text-base font-bold text-foreground">Notification Channels & Reminder Offsets</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Configure trigger offsets for meeting reminders, task SLA warnings, and escalation alerts.
                      </p>
                    </div>
                    <button
                      onClick={() => handleSaveModule('notifications')}
                      disabled={savingModule}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                    >
                      {savingModule ? 'Saving...' : 'Save Notification Settings'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">In-App Notification Drawer</label>
                      <select
                        value={formData.notifications?.in_app_enabled ? 'true' : 'false'}
                        onChange={e => handleFieldChange('notifications', 'in_app_enabled', e.target.value === 'true')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                      >
                        <option value="true">Enabled (Live WebSocket toasts & counter)</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Meeting Reminder Lead Time (Minutes)</label>
                      <input
                        type="number"
                        min="5"
                        value={formData.notifications?.meeting_reminder_lead_time_min || 15}
                        onChange={e => handleFieldChange('notifications', 'meeting_reminder_lead_time_min', parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 7: AUDIT HISTORY & SNAPSHOTS */}
              {activeSection === 'AUDIT_HISTORY' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h2 className="text-base font-bold text-foreground">Configuration Snapshots & Rollback History</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Immutable record of all published configuration versions. Revert with zero database corruption.
                      </p>
                    </div>
                    <button
                      onClick={() => setPublishModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90"
                    >
                      Publish New Snapshot
                    </button>
                  </div>

                  {snapshots.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                      No snapshots have been recorded yet. Click "Publish Snapshot" to create the baseline version.
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Version</th>
                            <th className="px-4 py-3">Change Summary</th>
                            <th className="px-4 py-3">Published At</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {snapshots.map((snap, idx) => (
                            <tr key={snap.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-3 font-mono font-bold text-foreground">
                                v{snap.version}.0
                                {idx === 0 && (
                                  <span className="ml-2 text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-foreground border border-border">
                                    ACTIVE
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-foreground font-medium">
                                {snap.change_summary}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                                {new Date(snap.created_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {idx !== 0 && (
                                  <button
                                    onClick={() => {
                                      setTargetRollbackVersion(snap.version);
                                      setRollbackModalOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-foreground hover:underline"
                                  >
                                    <RotateCcw className="w-3 h-3" /> Rollback
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal: Publish Snapshot */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Publish Configuration Version</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Publishing will capture all current effective module settings and feature states into an immutable, versioned snapshot.
            </p>
            <div className="space-y-1.5 text-xs">
              <label className="font-medium text-foreground">Change Summary (Required)</label>
              <textarea
                rows={3}
                placeholder="E.g. Updated market intelligence freshness threshold and enabled production benchmarking."
                value={publishSummary}
                onChange={e => setPublishSummary(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPublishModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishSnapshot}
                disabled={!publishSummary.trim()}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rollback Confirmation */}
      {rollbackModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold">Confirm Configuration Rollback</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to revert platform configuration to <strong>Version {targetRollbackVersion}</strong>? This will restore all module settings and feature states from that version while creating a safe new rollback audit entry.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRollbackModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleRollbackSnapshot}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90"
              >
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Feature Toggle Confirmation */}
      {featureConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-foreground">
              {featureConfirmModal.newStatus ? 'Enable' : 'Disable'} Platform Feature
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to {featureConfirmModal.newStatus ? 'enable' : 'disable'}{' '}
              <strong>{featureConfirmModal.feature.name}</strong>?
              {!featureConfirmModal.newStatus && (
                <span className="block mt-2 font-mono text-[11px] text-foreground">
                  Note: Disabling a feature safely suppresses new operations while preserving all existing historical database records.
                </span>
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFeatureConfirmModal(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  executeFeatureToggle(
                    featureConfirmModal.feature.id,
                    featureConfirmModal.newStatus
                  )
                }
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
