import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search,
  Plus,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle2,
  CheckSquare,
  X,
  Sparkles,
  UserCheck,
  Building2,
  ShieldAlert,
  Info,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/contexts/PermissionContext';

import { getApiBaseUrl } from '@/lib/api';

const formatTaskType = (type?: string) => {
  if (!type) return 'General';
  return type
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const getPriorityBadge = (priority?: string) => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return {
        dot: 'bg-white',
        bg: 'bg-muted text-foreground border-foreground/40 font-semibold',
        label: 'Critical'
      };
    case 'URGENT':
      return {
        dot: 'bg-zinc-200',
        bg: 'bg-muted text-foreground border-border font-medium',
        label: 'Urgent'
      };
    case 'HIGH':
      return {
        dot: 'bg-zinc-300',
        bg: 'bg-muted text-foreground border-border',
        label: 'High'
      };
    case 'MEDIUM':
      return {
        dot: 'bg-zinc-400',
        bg: 'bg-muted text-muted-foreground border-border',
        label: 'Medium'
      };
    default:
      return {
        dot: 'bg-zinc-500',
        bg: 'bg-muted text-muted-foreground border-border',
        label: priority || 'Low'
      };
  }
};

const getStatusBadge = (status?: string) => {
  switch (status?.toUpperCase()) {
    case 'COMPLETED':
      return {
        dot: 'bg-white',
        bg: 'bg-muted text-foreground border-foreground/30 font-medium',
        label: 'Completed'
      };
    case 'IN_PROGRESS':
      return {
        dot: 'bg-zinc-300 animate-pulse',
        bg: 'bg-muted text-foreground border-border',
        label: 'In Progress'
      };
    case 'WAITING_FOR_UPDATE':
      return {
        dot: 'bg-zinc-400',
        bg: 'bg-muted text-muted-foreground border-border',
        label: 'Waiting Update'
      };
    case 'ON_HOLD':
      return {
        dot: 'bg-zinc-500',
        bg: 'bg-muted text-muted-foreground border-border',
        label: 'On Hold'
      };
    case 'CANCELLED':
      return {
        dot: 'bg-zinc-600',
        bg: 'bg-muted text-muted-foreground border-border',
        label: 'Cancelled'
      };
    default:
      return {
        dot: 'bg-zinc-400',
        bg: 'bg-muted text-foreground border-border',
        label: status ? status.replace(/_/g, ' ') : 'Pending'
      };
  }
};

const DEFAULT_DEPARTMENTS = [
  { id: 'd1000000-0000-0000-0000-000000000001', name: 'Regulatory Affairs', code: 'RA-01' },
  { id: 'd1000000-0000-0000-0000-000000000002', name: 'Formulation & Pre-formulation R&D', code: 'FORM-01' },
  { id: 'd1000000-0000-0000-0000-000000000003', name: 'Quality Assurance', code: 'QA-01' },
  { id: 'd1000000-0000-0000-0000-000000000004', name: 'Analytical Development & QC', code: 'QC-01' },
  { id: 'd1000000-0000-0000-0000-000000000005', name: 'Production & Manufacturing', code: 'PROD-01' },
  { id: 'd1000000-0000-0000-0000-000000000006', name: 'Business Development & Licensing', code: 'BD-01' },
  { id: 'd1000000-0000-0000-0000-000000000007', name: 'Supply Chain & Procurement', code: 'SCM-01' },
  { id: 'd1000000-0000-0000-0000-000000000008', name: 'Engineering & Maintenance', code: 'ENG-01' },
];

const DEFAULT_DEPARTMENT_MEMBERS: Record<string, any[]> = {
  'd1000000-0000-0000-0000-000000000001': [
    { id: 'b1000000-0000-0000-0000-000000000001', full_name: 'Dr. Sarah Jenkins', designation: 'VP Regulatory Affairs & Global Strategy' }
  ],
  'd1000000-0000-0000-0000-000000000002': [
    { id: 'b1000000-0000-0000-0000-000000000002', full_name: 'Dr. Marcus Vance', designation: 'Head of Pre-formulation & R&D Scale-up' }
  ],
  'd1000000-0000-0000-0000-000000000003': [
    { id: 'b1000000-0000-0000-0000-000000000003', full_name: 'Elena Rostova', designation: 'Head of Global Quality Assurance & Compliance' }
  ],
  'd1000000-0000-0000-0000-000000000004': [
    { id: 'b1000000-0000-0000-0000-000000000004', full_name: 'Dr. Rajesh Patel', designation: 'QC Laboratory Director' }
  ],
  'd1000000-0000-0000-0000-000000000005': [
    { id: 'b1000000-0000-0000-0000-000000000005', full_name: 'Carlos Mendez', designation: 'Director of Commercial Drug Product Manufacturing' }
  ],
  'd1000000-0000-0000-0000-000000000006': [
    { id: 'b1000000-0000-0000-0000-000000000006', full_name: 'David Sterling', designation: 'VP Business Development & Client Proposals' }
  ],
  'd1000000-0000-0000-0000-000000000007': [
    { id: 'b1000000-0000-0000-0000-000000000007', full_name: 'Amira Al-Mansoor', designation: 'Head of Strategic API Sourcing & Cold-Chain' }
  ],
  'd1000000-0000-0000-0000-000000000008': [
    { id: 'b1000000-0000-0000-0000-000000000008', full_name: 'Liam O’Connor', designation: 'Director of Pharmaceutical Engineering & Cleanroom Systems' }
  ],
};

export default function Tasks() {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTaskType, setNewTaskType] = useState('INFORMATION_REQUEST');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [assignedDeptId, setAssignedDeptId] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Responsibility Auto-resolution State
  const [respSuggestion, setRespSuggestion] = useState<any>(null);
  const [resolvingResp, setResolvingResp] = useState(false);

  // Lookups
  const [departments, setDepartments] = useState<any[]>(DEFAULT_DEPARTMENTS);
  const [products, setProducts] = useState<any[]>([]);
  const [deptMembers, setDeptMembers] = useState<any[]>([]);

  // "Who is Responsible?" Quick Lookup state
  const [quickLookupOpen, setQuickLookupOpen] = useState(false);
  const [lookupTaskType, setLookupTaskType] = useState('INFORMATION_REQUEST');
  const [lookupProductId, setLookupProductId] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  const getAuthToken = () => {
    return session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
  };

  const fetchTasks = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filter === 'MY_TASKS') queryParams.append('my_tasks', 'true');
      if (filter === 'OVERDUE') queryParams.append('overdue', 'true');
      if (filter === 'DUE_TODAY') queryParams.append('due_today', 'true');
      if (filter === 'NO_UPDATE') queryParams.append('no_update', 'true');
      if (filter === 'COMPLETED') queryParams.append('status', 'COMPLETED');
      if (filter === 'IN_PROGRESS') queryParams.append('status', 'IN_PROGRESS');
      if (priorityFilter !== 'ALL') queryParams.append('priority', priorityFilter);
      if (searchTerm) queryParams.append('search', searchTerm);

      const token = getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/tasks?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const resData = await response.json();
        const items = Array.isArray(resData) ? resData : (resData.data || []);
        setTasks(items);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/tasks/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setAnalytics(await response.json());
      }
    } catch {
      // analytics optional
    }
  };

  const fetchLookups = async () => {
    try {
      const token = getAuthToken();
      const [deptRes, prodRes] = await Promise.all([
        fetch(`${getApiBaseUrl()}/departments`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`${getApiBaseUrl()}/products`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      if (deptRes && deptRes.ok) {
        const data = await deptRes.json();
        const list = Array.isArray(data) ? data : data.data || [];
        if (list.length > 0) {
          setDepartments(list);
        } else {
          setDepartments(DEFAULT_DEPARTMENTS);
        }
      } else {
        setDepartments(DEFAULT_DEPARTMENTS);
      }
      if (prodRes && prodRes.ok) {
        const data = await prodRes.json();
        setProducts(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
      setDepartments(DEFAULT_DEPARTMENTS);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchAnalytics();
    fetchLookups();
  }, [session, filter, priorityFilter, searchTerm]);

  // Load department members whenever assignedDeptId changes
  useEffect(() => {
    if (assignedDeptId) {
      const token = getAuthToken();
      fetch(`${getApiBaseUrl()}/responsibility/departments/${assignedDeptId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(m => {
          const list = Array.isArray(m) ? m : [];
          if (list.length > 0) {
            setDeptMembers(list);
          } else {
            setDeptMembers(DEFAULT_DEPARTMENT_MEMBERS[assignedDeptId] || []);
          }
        })
        .catch(() => {
          setDeptMembers(DEFAULT_DEPARTMENT_MEMBERS[assignedDeptId] || []);
        });
    } else {
      setDeptMembers([]);
    }
  }, [assignedDeptId, session]);

  // Automatically trigger Responsibility Resolution whenever task type or product changes in form
  const evaluateResponsibility = async (taskType: string, productId: string) => {
    setResolvingResp(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/responsibility/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taskType,
          productId: productId || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRespSuggestion(data);

        // If mode is AUTO_ASSIGN, prefill immediately
        if (data.assignmentMode === 'AUTO_ASSIGN' && data.responsibleDepartment) {
          setAssignedDeptId(data.responsibleDepartment.id);
          if (data.suggestedMember) setAssignedUserId(data.suggestedMember.id);
          if (data.sla?.calculated_due_date) setNewDueDate(data.sla.calculated_due_date);
        }
      }
    } catch (err) {
      console.error('Responsibility evaluation failed', err);
    } finally {
      setResolvingResp(false);
    }
  };

  const handleOpenCreateModal = () => {
    setNewTitle('');
    setNewDescription('');
    setNewTaskType('INFORMATION_REQUEST');
    setNewPriority('MEDIUM');
    setSelectedProductId('');
    setAssignedDeptId('');
    setAssignedUserId('');
    setOverrideReason('');
    setRespSuggestion(null);
    if (!departments || departments.length === 0) {
      setDepartments(DEFAULT_DEPARTMENTS);
    }
    fetchLookups();
    setShowCreateModal(true);
    evaluateResponsibility('INFORMATION_REQUEST', '');
  };

  const handleApplySuggestion = () => {
    if (!respSuggestion) return;
    if (respSuggestion.responsibleDepartment) {
      setAssignedDeptId(respSuggestion.responsibleDepartment.id);
    }
    if (respSuggestion.suggestedMember) {
      setAssignedUserId(respSuggestion.suggestedMember.id);
    } else {
      setAssignedUserId('');
    }
    if (respSuggestion.sla?.calculated_due_date) {
      setNewDueDate(respSuggestion.sla.calculated_due_date);
    }
    setOverrideReason('');
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isOverridden = Boolean(
        respSuggestion?.suggestedMember &&
        assignedUserId &&
        respSuggestion.suggestedMember.id !== assignedUserId
      );

      const token = getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          task_type: newTaskType,
          priority: newPriority,
          original_due_date: newDueDate,
          product_id: selectedProductId || null,
          assigned_department_id: assignedDeptId || null,
          assigned_user_id: assignedUserId || null,
          responsibility_rule_id: respSuggestion?.matchedRule?.id || null,
          is_responsibility_overridden: isOverridden,
          override_reason: isOverridden ? overrideReason : null,
          suggested_department_id: respSuggestion?.responsibleDepartment?.id || null,
          suggested_user_id: respSuggestion?.suggestedMember?.id || null,
          responsibility_explanation: respSuggestion?.explanation || null,
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        fetchTasks();
        fetchAnalytics();
      } else {
        const err = await response.json().catch(() => ({}));
        const details = err.error?.details
          ? (Array.isArray(err.error.details)
              ? err.error.details.map((d: any) => `${d.path ? d.path.join('.') + ': ' : ''}${d.message || JSON.stringify(d)}`).join('\n')
              : JSON.stringify(err.error.details))
          : '';
        alert(err.error?.message ? `${err.error.message}${details ? ':\n' + details : ''}` : 'Failed to create task');
      }
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const runQuickLookup = async () => {
    setLookingUp(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${getApiBaseUrl()}/responsibility/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taskType: lookupTaskType,
          productId: lookupProductId || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLookupResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-primary" />
            Task Tracking & Follow-up Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enterprise workflow for tracking task commitments, department follow-ups, and delay analytics
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { setQuickLookupOpen(true); runQuickLookup(); }}
            className="flex items-center px-3.5 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-muted font-medium text-xs shadow-xs transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />
            Who is Responsible?
          </button>

          {hasPermission('tasks.create') && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold text-xs shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Analytics KPI Ribbon - Interactive & Monochrome B&W Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Open */}
        <div
          onClick={() => { setFilter('ALL'); setPriorityFilter('ALL'); }}
          className={`bg-card/90 backdrop-blur-xs p-4 rounded-xl border transition-all shadow-xs cursor-pointer select-none hover:-translate-y-0.5 ${
            filter === 'ALL' ? 'border-foreground/80 ring-1 ring-foreground/20' : 'border-border hover:border-foreground/30'
          }`}
          title="Click to view all tasks"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Open Tasks</span>
            <div className="p-2 rounded-lg bg-muted border border-border text-foreground">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {analytics && analytics.totalTasks > 0
                ? analytics.totalOpen
                : tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length}
            </p>
            <span className="text-[11px] text-muted-foreground font-mono">Active pipeline</span>
          </div>
        </div>

        {/* Overdue */}
        <div
          onClick={() => setFilter(filter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          className={`bg-card/90 backdrop-blur-xs p-4 rounded-xl border transition-all shadow-xs cursor-pointer select-none hover:-translate-y-0.5 ${
            filter === 'OVERDUE' ? 'border-foreground/80 ring-1 ring-foreground/20' : 'border-border hover:border-foreground/30'
          }`}
          title="Click to filter overdue tasks"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Overdue Tasks</span>
            <div className="p-2 rounded-lg bg-muted border border-border text-foreground">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {analytics && analytics.totalTasks > 0
                ? analytics.overdue
                : tasks.filter(t => t.isOverdue || (t.delayDays && t.delayDays > 0)).length}
            </p>
            <span className="text-[11px] text-muted-foreground font-mono">Filter Overdue</span>
          </div>
        </div>

        {/* Due Today */}
        <div
          onClick={() => setFilter(filter === 'DUE_TODAY' ? 'ALL' : 'DUE_TODAY')}
          className={`bg-card/90 backdrop-blur-xs p-4 rounded-xl border transition-all shadow-xs cursor-pointer select-none hover:-translate-y-0.5 ${
            filter === 'DUE_TODAY' ? 'border-foreground/80 ring-1 ring-foreground/20' : 'border-border hover:border-foreground/30'
          }`}
          title="Click to filter tasks due today"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Due Today</span>
            <div className="p-2 rounded-lg bg-muted border border-border text-foreground">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {analytics && analytics.totalTasks > 0
                ? analytics.dueToday
                : tasks.filter(t => t.dueToday || (t.original_due_date && t.original_due_date.startsWith(new Date().toISOString().slice(0, 10)))).length}
            </p>
            <span className="text-[11px] text-muted-foreground font-mono">Filter Today</span>
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => setFilter(filter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          className={`bg-card/90 backdrop-blur-xs p-4 rounded-xl border transition-all shadow-xs cursor-pointer select-none hover:-translate-y-0.5 ${
            filter === 'COMPLETED' ? 'border-foreground/80 ring-1 ring-foreground/20' : 'border-border hover:border-foreground/30'
          }`}
          title="Click to filter completed tasks"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Completed</span>
            <div className="p-2 rounded-lg bg-muted border border-border text-foreground">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {analytics && analytics.totalTasks > 0
                ? analytics.completed
                : tasks.filter(t => t.status === 'COMPLETED').length}
            </p>
            <span className="text-[11px] text-muted-foreground font-mono">Filter Closed</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
        <div className="p-3 border-b border-border/60 flex flex-wrap gap-2.5 items-center justify-between bg-muted/20">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              className="block w-full pl-9 pr-8 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              placeholder="Search by code, title, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-2.5 my-auto text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 text-xs">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <select
                className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="MY_TASKS">Assigned to Me</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="DUE_TODAY">Due Today</option>
                <option value="COMPLETED">Completed Only</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="NO_UPDATE">Waiting for Update</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 text-xs">
              <select
                className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {(filter !== 'ALL' || priorityFilter !== 'ALL' || searchTerm) && (
              <button
                type="button"
                onClick={() => { setFilter('ALL'); setPriorityFilter('ALL'); setSearchTerm(''); }}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="p-16 text-center text-muted-foreground text-xs font-mono flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-primary" />
            Loading task commitments...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground text-xs space-y-2">
            <CheckSquare className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-foreground">No tasks found</p>
            <p className="text-muted-foreground text-[11px]">No task records match your active search and filter criteria.</p>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[13%]" />
                <col className="w-[20%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">
                  <th className="py-2.5 px-3">Task ID & Title</th>
                  <th className="py-2.5 px-2">Type</th>
                  <th className="py-2.5 px-2">Department & Owner</th>
                  <th className="py-2.5 px-2">Priority</th>
                  <th className="py-2.5 px-2">Original Due</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2">Delay</th>
                  <th className="py-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tasks.map((task) => {
                  const pBadge = getPriorityBadge(task.priority);
                  const sBadge = getStatusBadge(task.status);
                  const code = task.task_code || `TASK-${task.id?.slice(0, 8)}`;
                  const userInitial = task.assigned_user?.full_name ? task.assigned_user.full_name.charAt(0).toUpperCase() : '?';

                  return (
                    <tr key={task.id} className="hover:bg-muted/20 transition-colors group">
                      {/* Task ID & Title */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[10px] font-bold text-foreground flex items-center gap-1.5">
                          <span className="text-primary truncate">{code}</span>
                        </div>
                        <div className="text-xs text-foreground/90 font-medium mt-0.5 truncate group-hover:text-primary transition-colors" title={task.title}>
                          {task.title}
                        </div>
                      </td>

                      {/* Task Type */}
                      <td className="py-2.5 px-2">
                        <span className="inline-block truncate max-w-full px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border" title={formatTaskType(task.task_type)}>
                          {formatTaskType(task.task_type)}
                        </span>
                      </td>

                      {/* Department & Owner */}
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                            {userInitial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground text-xs leading-tight truncate" title={task.assigned_user?.full_name || 'Pending Assignment'}>
                              {task.assigned_user?.full_name || 'Pending Assignment'}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate" title={task.assigned_department?.name || 'Assigned Department'}>
                              <Building2 className="w-3 h-3 shrink-0 text-muted-foreground/70" />
                              <span className="truncate">{task.assigned_department?.name || 'Assigned Department'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${pBadge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pBadge.dot}`} />
                          <span className="truncate">{pBadge.label}</span>
                        </span>
                      </td>

                      {/* Original Due Date */}
                      <td className="py-2.5 px-2 font-mono text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1 truncate">
                          <Calendar className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                          <span className="truncate">{task.original_due_date || task.due_date || '—'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${sBadge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sBadge.dot}`} />
                          <span className="truncate">{sBadge.label}</span>
                        </span>
                      </td>

                      {/* Delay / SLA Track */}
                      <td className="py-2.5 px-2">
                        {task.delayDays > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            +{task.delayDays}d
                          </span>
                        ) : task.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                            Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium text-muted-foreground bg-muted/60 border border-border/60">
                            On Track
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-2 text-right">
                        <button
                          onClick={() => navigate(`/tasks/${task.id}`)}
                          className="inline-flex items-center justify-center gap-0.5 px-2 py-1 text-[11px] rounded border border-border bg-background hover:bg-muted text-foreground transition-all font-medium shadow-2xs group-hover:border-primary/40 cursor-pointer"
                          title={`View details for ${code}`}
                        >
                          <span>View</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* NEW BUSINESS TASK MODAL WITH CENTRAL RESPONSIBILITY INTEGRATION           */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto text-foreground">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-foreground">Create New Business Task</h2>
                <p className="text-xs text-muted-foreground">Integrated with central platform responsibility rules & SLAs</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Obtain API quotation for Atorvastatin 20mg"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Details of the requirement or opportunity follow-up..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Task Type *</label>
                  <select
                    value={newTaskType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTaskType(val);
                      evaluateResponsibility(val, selectedProductId);
                    }}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
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
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Product (Optional)</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedProductId(val);
                      evaluateResponsibility(newTaskType, val);
                    }}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">(None / General)</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.product_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* RESPONSIBILITY SUGGESTION BANNER */}
              {resolvingResp ? (
                <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-xs text-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Evaluating responsibility configuration rules...</span>
                </div>
              ) : respSuggestion && respSuggestion.matchedRule ? (
                <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary flex items-center gap-1.5 font-mono text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      Rule Match: {respSuggestion.matchedRule.rule_code}
                    </span>
                    <span className="font-mono text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-semibold uppercase">
                      Mode: {respSuggestion.assignmentMode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-foreground">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Responsible Department:</span>
                      <span className="font-bold">{respSuggestion.responsibleDepartment?.name || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Suggested Member:</span>
                      <span className="font-bold">{respSuggestion.suggestedMember?.full_name || 'Pending Assignment'}</span>
                    </div>
                  </div>

                  <div className="text-muted-foreground text-[11px] font-mono">
                    SLA: {respSuggestion.sla?.completion_sla_days} Business Days • Calculated Due Date: {respSuggestion.sla?.calculated_due_date}
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-border">
                    <span className="text-[10px] text-muted-foreground italic truncate max-w-[280px]">
                      {respSuggestion.explanation}
                    </span>
                    <button
                      type="button"
                      onClick={handleApplySuggestion}
                      className="px-2.5 py-1 bg-primary text-primary-foreground rounded text-[11px] font-semibold hover:bg-primary/90 shadow-xs"
                    >
                      Apply Suggested
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>No specific responsibility rule matched. Responsibility will be manual.</span>
                </div>
              )}

              {/* Department & Member Assignment */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Responsible Department</label>
                  <select
                    value={assignedDeptId}
                    onChange={(e) => {
                      const deptId = e.target.value;
                      setAssignedDeptId(deptId);
                      const members = DEFAULT_DEPARTMENT_MEMBERS[deptId] || [];
                      setDeptMembers(members);
                      setAssignedUserId(members[0]?.id || '');
                    }}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select Department</option>
                    {(departments && departments.length > 0 ? departments : DEFAULT_DEPARTMENTS).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Responsible Member</label>
                  <select
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">(Pending Assignment)</option>
                    {(deptMembers && deptMembers.length > 0 ? deptMembers : (DEFAULT_DEPARTMENT_MEMBERS[assignedDeptId] || [])).map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.designation || 'Member'})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Override Reason Prompt if differing from suggestion */}
              {respSuggestion?.suggestedMember && assignedUserId && respSuggestion.suggestedMember.id !== assignedUserId && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    Responsibility Override Detected
                  </div>
                  <p className="text-[11px] text-amber-300">
                    Assigned member differs from suggested rule owner ({respSuggestion.suggestedMember.full_name}). Please provide an audited reason.
                  </p>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Employee A on leave; assigned to backup"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full bg-background border border-amber-500/50 rounded-lg p-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-amber-400 mt-1"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Original Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-xs"
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* "WHO IS RESPONSIBLE?" QUICK LOOKUP MODAL                                  */}
      {/* ========================================================================= */}
      {quickLookupOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-scale-up text-foreground">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Who is Responsible?</h2>
              </div>
              <button onClick={() => setQuickLookupOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Instantly resolve which department and team member owns updates for any business requirement or molecule.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-lg border border-border">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Requirement / Task Type</label>
                <select
                  value={lookupTaskType}
                  onChange={(e) => setLookupTaskType(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
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
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Product (Optional)</label>
                <select
                  value={lookupProductId}
                  onChange={(e) => setLookupProductId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  <option value="">(Universal)</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={runQuickLookup}
              disabled={lookingUp}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              {lookingUp ? 'Checking Configuration...' : 'Query Responsibility'}
            </button>

            {lookupResult && (
              <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary">
                    {lookupResult.matchedRule?.rule_code || 'DEFAULT PLATFORM'}
                  </span>
                  <span className="font-mono text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-semibold">
                    {lookupResult.assignmentMode}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-foreground">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Department:</span>
                    <span className="font-bold">{lookupResult.responsibleDepartment?.name || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Primary Member:</span>
                    <span className="font-bold">{lookupResult.suggestedMember?.full_name || 'Pending Assignment'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Backup Member:</span>
                    <span className="text-muted-foreground">{lookupResult.backupMember?.full_name || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">SLA Target:</span>
                    <span className="font-mono font-semibold text-foreground">{lookupResult.sla?.completion_sla_days} Business Days</span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                  {lookupResult.explanation}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
