import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus,
  Search,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  Copy,
  History,
  Edit,
  Trash2,
  X,
  FileSpreadsheet,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';

interface Rule {
  id: string;
  rule_code: string;
  rule_name: string;
  description?: string;
  task_type?: string;
  business_area?: string;
  product_type?: string;
  product_id?: string;
  product?: { id: string; product_name: string; product_code: string };
  unit_id?: string;
  department_id?: string;
  responsible_department_id: string;
  responsible_department?: { id: string; name: string; code: string };
  primary_member_id?: string;
  primary_member?: { id: string; full_name: string; email: string; designation?: string; status?: string };
  backup_member_id?: string;
  backup_member?: { id: string; full_name: string; email: string; designation?: string };
  escalation_manager_id?: string;
  escalation_manager?: { id: string; full_name: string; email: string; designation?: string };
  response_sla_days: number;
  completion_sla_days: number;
  followup_interval_days: number;
  escalation_delay_days: number;
  sla_calendar_type: 'BUSINESS_DAYS' | 'CALENDAR_DAYS';
  assignment_mode: 'AUTO_ASSIGN' | 'SUGGEST' | 'MANUAL';
  priority_score: number;
  effective_from: string;
  effective_to?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  version: number;
  updated_at?: string;
}

export default function ResponsibilitySettings() {
  const { session } = useAuth();

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterTaskType, setFilterTaskType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterMode, setFilterMode] = useState('ALL');

  // Lookups
  const [departments, setDepartments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [deptMembers, setDeptMembers] = useState<any[]>([]);

  // Modals & Drawers
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [matrixModalOpen, setMatrixModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedRuleHistory, setSelectedRuleHistory] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [showConflictsModal, setShowConflictsModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({
    rule_name: '',
    description: '',
    task_type: 'REGULATORY_ASSESSMENT',
    business_area: 'REGULATORY',
    product_type: '',
    product_id: '',
    responsible_department_id: '',
    primary_member_id: '',
    backup_member_id: '',
    escalation_manager_id: '',
    response_sla_days: 2,
    completion_sla_days: 5,
    followup_interval_days: 2,
    escalation_delay_days: 2,
    sla_calendar_type: 'BUSINESS_DAYS',
    assignment_mode: 'SUGGEST',
    priority_score: 100,
    effective_from: new Date().toISOString().split('T')[0],
    effective_to: '',
    status: 'ACTIVE',
    change_reason: '',
  });

  // Simulator / Test Tool State
  const [testContext, setTestContext] = useState({
    taskType: 'INFORMATION_REQUEST',
    businessArea: 'SUPPLY_CHAIN',
    productId: '',
    departmentId: '',
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  // Quick Notification
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:4000/api/responsibility/rules', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (err) {
      console.error('Failed to fetch rules', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [deptRes, prodRes, confRes] = await Promise.all([
        fetch('http://localhost:4000/api/departments', { headers: { Authorization: `Bearer ${session?.access_token}` } }).catch(() => null),
        fetch('http://localhost:4000/api/products', { headers: { Authorization: `Bearer ${session?.access_token}` } }).catch(() => null),
        fetch('http://localhost:4000/api/responsibility/conflicts', { headers: { Authorization: `Bearer ${session?.access_token}` } }).catch(() => null),
      ]);

      if (deptRes && deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(Array.isArray(data) ? data : data.data || []);
      }
      if (prodRes && prodRes.ok) {
        const data = await prodRes.json();
        setProducts(Array.isArray(data) ? data : data.data || []);
      }
      if (confRes && confRes.ok) {
        const data = await confRes.json();
        setConflicts(data || []);
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchRules();
      fetchLookups();
    }
  }, [session]);

  // Load department members whenever responsible_department_id changes in form
  useEffect(() => {
    if (formData.responsible_department_id) {
      fetch(`http://localhost:4000/api/responsibility/departments/${formData.responsible_department_id}/members`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
        .then(r => r.json())
        .then(members => setDeptMembers(Array.isArray(members) ? members : []))
        .catch(() => setDeptMembers([]));
    } else {
      setDeptMembers([]);
    }
  }, [formData.responsible_department_id]);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData({
      rule_name: '',
      description: '',
      task_type: 'INFORMATION_REQUEST',
      business_area: 'SUPPLY_CHAIN',
      product_type: '',
      product_id: '',
      responsible_department_id: departments[0]?.id || '',
      primary_member_id: '',
      backup_member_id: '',
      escalation_manager_id: '',
      response_sla_days: 2,
      completion_sla_days: 5,
      followup_interval_days: 2,
      escalation_delay_days: 2,
      sla_calendar_type: 'BUSINESS_DAYS',
      assignment_mode: 'SUGGEST',
      priority_score: 100,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: '',
      status: 'ACTIVE',
      change_reason: 'New responsibility rule created',
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      description: rule.description || '',
      task_type: rule.task_type || '',
      business_area: rule.business_area || '',
      product_type: rule.product_type || '',
      product_id: rule.product_id || '',
      responsible_department_id: rule.responsible_department_id,
      primary_member_id: rule.primary_member_id || '',
      backup_member_id: rule.backup_member_id || '',
      escalation_manager_id: rule.escalation_manager_id || '',
      response_sla_days: rule.response_sla_days,
      completion_sla_days: rule.completion_sla_days,
      followup_interval_days: rule.followup_interval_days,
      escalation_delay_days: rule.escalation_delay_days,
      sla_calendar_type: rule.sla_calendar_type,
      assignment_mode: rule.assignment_mode,
      priority_score: rule.priority_score,
      effective_from: rule.effective_from,
      effective_to: rule.effective_to || '',
      status: rule.status,
      change_reason: '',
    });
    setDrawerOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRule
        ? `http://localhost:4000/api/responsibility/rules/${editingRule.id}`
        : 'http://localhost:4000/api/responsibility/rules';
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setDrawerOpen(false);
        setBannerNotice(`Responsibility rule ${editingRule ? 'updated' : 'created'} successfully.`);
        fetchRules();
        fetchLookups();
        setTimeout(() => setBannerNotice(null), 4000);
      } else {
        const errData = await res.json();
        alert(errData.error?.message || 'Failed to save rule');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving rule');
    }
  };

  const handleDuplicate = async (ruleId: string) => {
    if (!confirm('Duplicate this responsibility rule?')) return;
    try {
      const res = await fetch(`http://localhost:4000/api/responsibility/rules/${ruleId}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        setBannerNotice('Rule duplicated as draft successfully.');
        fetchRules();
        setTimeout(() => setBannerNotice(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeactivate = async (ruleId: string) => {
    const reason = prompt('Please provide reason for deactivating this rule:');
    if (reason === null) return;
    try {
      const res = await fetch(`http://localhost:4000/api/responsibility/rules/${ruleId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setBannerNotice('Rule deactivated.');
        fetchRules();
        setTimeout(() => setBannerNotice(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewHistory = async (ruleId: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/responsibility/rules/${ruleId}/history`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRuleHistory(data);
        setHistoryModalOpen(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runSimulatorTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('http://localhost:4000/api/responsibility/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(testContext),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/responsibility/export', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Responsibility_Rules_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to export rules');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', importFile);
      const res = await fetch('http://localhost:4000/api/responsibility/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: form,
      });
      const data = await res.json();
      setImportResult(data);
      fetchRules();
      fetchLookups();
    } catch (err) {
      console.error(err);
      alert('Import failed');
    } finally {
      setImporting(false);
    }
  };

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        r.rule_name.toLowerCase().includes(q) ||
        r.rule_code.toLowerCase().includes(q) ||
        (r.task_type && r.task_type.toLowerCase().includes(q)) ||
        (r.responsible_department && r.responsible_department.name.toLowerCase().includes(q)) ||
        (r.primary_member && r.primary_member.full_name.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filterDept !== 'ALL' && r.responsible_department_id !== filterDept) return false;
    if (filterTaskType !== 'ALL' && r.task_type !== filterTaskType) return false;
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterMode !== 'ALL' && r.assignment_mode !== filterMode) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Banner Notice */}
      {bannerNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 text-sm shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{bannerNotice}</span>
          </div>
          <button onClick={() => setBannerNotice(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Configuration Conflict Banner */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-amber-900 text-sm shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">CONFIGURATION CONFLICT DETECTED:</span>{' '}
              {conflicts.length} overlapping rule conflict(s) detected. Divergent responsibility or equal priority scopes exist.
            </div>
          </div>
          <button
            onClick={() => setShowConflictsModal(true)}
            className="px-3 py-1.5 bg-amber-600 text-white font-medium rounded text-xs hover:bg-amber-700 shadow-sm"
          >
            Review Conflicts ({conflicts.length})
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-md uppercase tracking-wider">
              Central Settings
            </span>
            <span className="text-xs text-muted-foreground font-mono">BDIQ Governance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Task & Update Responsibility
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which department and member is responsible for providing updates, SLAs, and escalations across all platform workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setTestModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Test Rule
          </button>

          <button
            onClick={() => setMatrixModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            Matrix View
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            Import
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            Export
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Responsibility Rule
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search rule name, code, department, member..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="ALL">All Responsible Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Task Type Filter */}
          <div>
            <select
              value={filterTaskType}
              onChange={e => setFilterTaskType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="ALL">All Task Types</option>
              <option value="INFORMATION_REQUEST">Information Request</option>
              <option value="REGULATORY_ASSESSMENT">Regulatory Assessment</option>
              <option value="API_QUOTATION">API Quotation</option>
              <option value="FORMULATION_FEASIBILITY">Formulation Feasibility</option>
              <option value="ANALYTICAL_FEASIBILITY">Analytical Feasibility</option>
              <option value="PACKAGING_FEASIBILITY">Packaging Feasibility</option>
              <option value="COMMERCIAL_EVALUATION">Commercial Evaluation</option>
              <option value="CUSTOMER_TECHNICAL_QUERY">Customer Technical Query</option>
            </select>
          </div>

          {/* Assignment Mode Filter */}
          <div>
            <select
              value={filterMode}
              onChange={e => setFilterMode(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="ALL">All Assignment Modes</option>
              <option value="SUGGEST">Suggest Only</option>
              <option value="AUTO_ASSIGN">Auto-Assign</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rules Data Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-mono tracking-wider text-[11px]">
                <th className="py-3 px-4">Rule</th>
                <th className="py-3 px-4">Requirement / Scope</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Primary Member</th>
                <th className="py-3 px-4">Backup</th>
                <th className="py-3 px-4">SLA (Biz Days)</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Escalation</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-primary" />
                    Loading responsibility configuration...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <Building2 className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-medium text-foreground">No responsibility rules found</p>
                    <p className="text-xs text-muted-foreground mt-1">Create a new rule to configure automated updates and SLAs.</p>
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => (
                  <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                    {/* Rule Code & Name */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-primary font-semibold">{rule.rule_code}</div>
                      <div className="font-medium text-foreground truncate max-w-[180px]">{rule.rule_name}</div>
                    </td>

                    {/* Scope */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">
                        {rule.task_type ? rule.task_type.replace(/_/g, ' ') : (rule.business_area || 'Universal Scope')}
                      </div>
                      {rule.product && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Product: {rule.product.product_name}
                        </div>
                      )}
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-foreground">
                        {rule.responsible_department?.name || 'Unassigned'}
                      </span>
                      {rule.responsible_department?.code && (
                        <span className="ml-1 text-[10px] font-mono text-muted-foreground">
                          ({rule.responsible_department.code})
                        </span>
                      )}
                    </td>

                    {/* Primary Member */}
                    <td className="py-3 px-4">
                      {rule.primary_member ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                            {rule.primary_member.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{rule.primary_member.full_name}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{rule.primary_member.email}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-mono">
                          Pending Assignment
                        </span>
                      )}
                    </td>

                    {/* Backup */}
                    <td className="py-3 px-4">
                      {rule.backup_member ? (
                        <span className="text-muted-foreground">{rule.backup_member.full_name}</span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>

                    {/* SLA */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-mono text-foreground font-semibold">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {rule.completion_sla_days}d
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        Resp: {rule.response_sla_days}d • F/up: {rule.followup_interval_days}d
                      </div>
                    </td>

                    {/* Mode */}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider font-mono uppercase ${
                          rule.assignment_mode === 'AUTO_ASSIGN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rule.assignment_mode === 'SUGGEST'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rule.assignment_mode}
                      </span>
                    </td>

                    {/* Escalation */}
                    <td className="py-3 px-4">
                      {rule.escalation_manager ? (
                        <div>
                          <div className="font-medium text-foreground">{rule.escalation_manager.full_name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">After {rule.escalation_delay_days}d overdue</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase ${
                          rule.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {rule.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewHistory(rule.id)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          title="Audit History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(rule.id)}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                          title="Duplicate Rule"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(rule)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded"
                          title="Edit Rule"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {rule.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleDeactivate(rule.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-muted rounded"
                            title="Deactivate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT RULE DRAWER (Side Drawer)                                      */}
      {/* ========================================================================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-card h-full shadow-2xl flex flex-col border-l border-border animate-slide-left">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {editingRule ? `Edit Rule: ${editingRule.rule_code}` : 'Add Responsibility Rule'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Configure requirement dimensions, department responsibility, members, and SLAs.
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Form Body */}
            <form onSubmit={handleSaveRule} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* SECTION 1: Rule Information */}
              <div className="space-y-3 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    Rule Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Rule Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.rule_name}
                      onChange={e => setFormData({ ...formData, rule_name: e.target.value })}
                      placeholder="e.g. Regulatory Affairs - Active Substance Assessment"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Purpose of this responsibility rule..."
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="DRAFT">DRAFT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Priority Precedence Score</label>
                    <input
                      type="number"
                      value={formData.priority_score}
                      onChange={e => setFormData({ ...formData, priority_score: parseInt(e.target.value, 10) || 100 })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Scope Dimensions */}
              <div className="space-y-3 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    Scope Matching Criteria
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Task Type</label>
                    <select
                      value={formData.task_type}
                      onChange={e => setFormData({ ...formData, task_type: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">(Universal / Any Task Type)</option>
                      <option value="INFORMATION_REQUEST">Information Request</option>
                      <option value="REGULATORY_ASSESSMENT">Regulatory Assessment</option>
                      <option value="API_QUOTATION">API Quotation</option>
                      <option value="FORMULATION_FEASIBILITY">Formulation Feasibility</option>
                      <option value="ANALYTICAL_FEASIBILITY">Analytical Feasibility</option>
                      <option value="PACKAGING_FEASIBILITY">Packaging Feasibility</option>
                      <option value="COMMERCIAL_EVALUATION">Commercial Evaluation</option>
                      <option value="CUSTOMER_TECHNICAL_QUERY">Customer Technical Query</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Business Area</label>
                    <select
                      value={formData.business_area}
                      onChange={e => setFormData({ ...formData, business_area: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">(Any Business Area)</option>
                      <option value="SUPPLY_CHAIN">Supply Chain & Sourcing</option>
                      <option value="REGULATORY">Regulatory Affairs</option>
                      <option value="R_AND_D">Research & Development</option>
                      <option value="COMMERCIAL">Commercial & BD</option>
                      <option value="QUALITY">Quality & Compliance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Specific Product (Optional)</label>
                    <select
                      value={formData.product_id}
                      onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">(Applies to All Products)</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.product_name} ({p.product_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Opportunity Type (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. IN_LICENSING, OUT_LICENSING"
                      value={formData.opportunity_type}
                      onChange={e => setFormData({ ...formData, opportunity_type: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Responsibility */}
              <div className="space-y-3 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    Responsibility & Ownership
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Responsible Department *
                    </label>
                    <select
                      required
                      value={formData.responsible_department_id}
                      onChange={e => {
                        setFormData({
                          ...formData,
                          responsible_department_id: e.target.value,
                          primary_member_id: '',
                          backup_member_id: '',
                        });
                      }}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Responsible Department</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Member filtered by department */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Primary Responsible Member
                    </label>
                    <select
                      value={formData.primary_member_id}
                      onChange={e => setFormData({ ...formData, primary_member_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">(Pending Assignment / Department Queue)</option>
                      {deptMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.designation || m.email})
                        </option>
                      ))}
                    </select>
                    {deptMembers.length === 0 && formData.responsible_department_id && (
                      <p className="text-[10px] text-amber-600 mt-1">
                        No active members directly registered in this department. Task will route as 'Pending Assignment'.
                      </p>
                    )}
                  </div>

                  {/* Backup Member */}
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Backup Member (Optional)
                    </label>
                    <select
                      value={formData.backup_member_id}
                      onChange={e => setFormData({ ...formData, backup_member_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">(None)</option>
                      {deptMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Escalation Manager */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Escalation Manager / Dept Head
                    </label>
                    <select
                      value={formData.escalation_manager_id}
                      onChange={e => setFormData({ ...formData, escalation_manager_id: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">(None)</option>
                      {deptMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.designation || 'Manager'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Timing & SLAs */}
              <div className="space-y-3 pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">4</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    SLA & Timing Rules
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Response SLA</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.response_sla_days}
                      onChange={e => setFormData({ ...formData, response_sla_days: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">days</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Completion SLA</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.completion_sla_days}
                      onChange={e => setFormData({ ...formData, completion_sla_days: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">days</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Follow-up Interval</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.followup_interval_days}
                      onChange={e => setFormData({ ...formData, followup_interval_days: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">days</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Escalation Delay</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.escalation_delay_days}
                      onChange={e => setFormData({ ...formData, escalation_delay_days: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">days</span>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">SLA Calendar Type</label>
                    <select
                      value={formData.sla_calendar_type}
                      onChange={e => setFormData({ ...formData, sla_calendar_type: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    >
                      <option value="BUSINESS_DAYS">Business Days (Skips Weekends)</option>
                      <option value="CALENDAR_DAYS">Calendar Days (Consecutive)</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">Assignment Mode</label>
                    <select
                      value={formData.assignment_mode}
                      onChange={e => setFormData({ ...formData, assignment_mode: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    >
                      <option value="SUGGEST">SUGGEST (Recommended: Human Confirmation)</option>
                      <option value="AUTO_ASSIGN">AUTO_ASSIGN (Direct Automated Ownership)</option>
                      <option value="MANUAL">MANUAL (Requires Manual Selection)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Effective Period & Audit */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">5</span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    Effective Period & Change Audit
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Effective From *</label>
                    <input
                      type="date"
                      required
                      value={formData.effective_from}
                      onChange={e => setFormData({ ...formData, effective_from: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Effective To (Optional)</label>
                    <input
                      type="date"
                      value={formData.effective_to}
                      onChange={e => setFormData({ ...formData, effective_to: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Reason for Change (Audited)
                    </label>
                    <input
                      type="text"
                      value={formData.change_reason}
                      onChange={e => setFormData({ ...formData, change_reason: e.target.value })}
                      placeholder="e.g. Employee responsibility reassigned per Q4 reorganization"
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 text-xs font-medium bg-card border border-border rounded-lg text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-sm"
                >
                  {editingRule ? 'Save Changes' : 'Create & Activate Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIMULATOR: TEST RESPONSIBILITY RULE MODAL                                */}
      {/* ========================================================================= */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card rounded-xl border border-border shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Test Responsibility Rule Engine</h3>
              </div>
              <button onClick={() => setTestModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Simulate how the platform evaluates responsibility rules for any combination of Task Type, Product, and Department.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-4 rounded-lg border border-border">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Task Type</label>
                <select
                  value={testContext.taskType}
                  onChange={e => setTestContext({ ...testContext, taskType: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg"
                >
                  <option value="INFORMATION_REQUEST">Information Request</option>
                  <option value="REGULATORY_ASSESSMENT">Regulatory Assessment</option>
                  <option value="API_QUOTATION">API Quotation</option>
                  <option value="FORMULATION_FEASIBILITY">Formulation Feasibility</option>
                  <option value="ANALYTICAL_FEASIBILITY">Analytical Feasibility</option>
                  <option value="PACKAGING_FEASIBILITY">Packaging Feasibility</option>
                  <option value="COMMERCIAL_EVALUATION">Commercial Evaluation</option>
                  <option value="CUSTOMER_TECHNICAL_QUERY">Customer Technical Query</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Product (Optional)</label>
                <select
                  value={testContext.productId}
                  onChange={e => setTestContext({ ...testContext, productId: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg"
                >
                  <option value="">(None / General)</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={runSimulatorTest}
              disabled={testing}
              className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Evaluate Matching Rule
            </button>

            {/* Test Results Output */}
            {testResult && (
              <div className="space-y-3 pt-3 border-t border-border">
                {testResult.hasConflict && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Warning: Configuration conflict detected! Multiple rules share identical precedence.</span>
                  </div>
                )}

                <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-primary">
                      {testResult.matchedRule?.rule_code || 'NO MATCH'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-primary/10 text-primary">
                      Mode: {testResult.assignmentMode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Responsible Department:</span>
                      <span className="font-semibold text-foreground">
                        {testResult.responsibleDepartment?.name || 'Unassigned / Not Determined'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Suggested Member:</span>
                      <span className="font-semibold text-foreground">
                        {testResult.suggestedMember?.full_name || 'Pending Assignment'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Backup Member:</span>
                      <span className="font-semibold text-foreground">
                        {testResult.backupMember?.full_name || 'None'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[11px]">Calculated Due Date (SLA):</span>
                      <span className="font-mono font-semibold text-foreground">
                        {testResult.sla?.calculated_due_date} ({testResult.sla?.completion_sla_days} business days)
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-background border border-border rounded-lg text-xs text-muted-foreground flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{testResult.explanation}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MATRIX VIEW MODAL                                                         */}
      {/* ========================================================================= */}
      {matrixModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-card rounded-xl border border-border shadow-2xl p-6 space-y-4 animate-scale-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-foreground">Responsibility Matrix Overview</h3>
              </div>
              <button onClick={() => setMatrixModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground shrink-0">
              High-level mapping of business requirements, responsible departments, primary/backup owners, and turnaround SLAs.
            </p>

            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/50 border-b border-border font-mono text-[11px] text-muted-foreground uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Business Requirement</th>
                    <th className="p-3">Department</th>
                    <th className="p-3">Primary Member</th>
                    <th className="p-3">Backup Member</th>
                    <th className="p-3">SLA</th>
                    <th className="p-3">Escalation Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.filter(r => r.status === 'ACTIVE').map(r => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="p-3 font-semibold text-foreground">
                        {r.task_type ? r.task_type.replace(/_/g, ' ') : r.rule_name}
                      </td>
                      <td className="p-3 text-foreground">{r.responsible_department?.name || 'Unassigned'}</td>
                      <td className="p-3 font-medium text-foreground">{r.primary_member?.full_name || 'Pending Assignment'}</td>
                      <td className="p-3 text-muted-foreground">{r.backup_member?.full_name || '—'}</td>
                      <td className="p-3 font-mono font-medium">{r.completion_sla_days}d ({r.sla_calendar_type === 'BUSINESS_DAYS' ? 'Biz' : 'Cal'})</td>
                      <td className="p-3 text-muted-foreground">{r.escalation_manager?.full_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUDIT HISTORY MODAL                                                       */}
      {/* ========================================================================= */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-card rounded-xl border border-border shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">Rule Audit History</h3>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selectedRuleHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No historical mutations logged.</p>
              ) : (
                selectedRuleHistory.map(h => (
                  <div key={h.id} className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-semibold text-primary">Version {h.version} ({h.change_type})</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-foreground">{h.change_reason || 'Configuration updated'}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Actor: {h.changer?.full_name || 'Administrator'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPORT EXCEL MODAL                                                        */}
      {/* ========================================================================= */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-foreground">Import Responsibility Rules</h3>
              </div>
              <button onClick={() => setImportModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Upload an Excel (.xlsx) file containing responsibility rules. Email addresses and department codes must match existing organization records.
            </p>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <input
                  type="file"
                  accept=".xlsx"
                  required
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>

              {importResult && (
                <div className="p-3 bg-muted/40 border border-border rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-foreground">Import Summary:</div>
                  <div className="text-emerald-700">Created: {importResult.created} rules</div>
                  <div className="text-blue-700">Updated: {importResult.updated} rules</div>
                  {importResult.errors?.length > 0 && (
                    <div className="text-red-600 mt-2">
                      <div className="font-semibold">Validation Errors:</div>
                      {importResult.errors.map((err: string, i: number) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {importing ? 'Processing Import...' : 'Import Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFLICTS REVIEW MODAL                                                    */}
      {/* ========================================================================= */}
      {showConflictsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card rounded-xl border border-border shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-foreground">Rule Conflict Resolution</h3>
              </div>
              <button onClick={() => setShowConflictsModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              The following rules have identical scopes or equal precedence scores but specify different departments or owners. Edit or deactivate one of the rules to resolve the conflict.
            </p>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {conflicts.map((c, i) => (
                <div key={i} className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg text-xs space-y-2">
                  <div className="font-semibold text-amber-900">{c.reason}</div>
                  <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded border border-amber-200 font-mono text-[11px]">
                    <div>
                      <span className="font-bold text-foreground">Rule A: {c.ruleA.rule_code}</span>
                      <div>Dept: {c.ruleA.responsible_department?.name || c.ruleA.responsible_department_id}</div>
                      <div>Primary: {c.ruleA.primary_member?.full_name || 'Unassigned'}</div>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">Rule B: {c.ruleB.rule_code}</span>
                      <div>Dept: {c.ruleB.responsible_department?.name || c.ruleB.responsible_department_id}</div>
                      <div>Primary: {c.ruleB.primary_member?.full_name || 'Unassigned'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowConflictsModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
