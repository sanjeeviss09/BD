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
  Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/contexts/PermissionContext';

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
  const [departments, setDepartments] = useState<any[]>([]);
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

  const fetchTasks = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filter === 'MY_TASKS') queryParams.append('my_tasks', 'true');
      if (filter === 'OVERDUE') queryParams.append('overdue', 'true');
      if (filter === 'DUE_TODAY') queryParams.append('due_today', 'true');
      if (filter === 'NO_UPDATE') queryParams.append('no_update', 'true');
      if (priorityFilter !== 'ALL') queryParams.append('priority', priorityFilter);
      if (searchTerm) queryParams.append('search', searchTerm);

      const response = await fetch(`http://localhost:4000/api/tasks?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
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
      const response = await fetch(`http://localhost:4000/api/tasks/analytics`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
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
      const [deptRes, prodRes] = await Promise.all([
        fetch('http://localhost:4000/api/departments', { headers: { Authorization: `Bearer ${session?.access_token}` } }).catch(() => null),
        fetch('http://localhost:4000/api/products', { headers: { Authorization: `Bearer ${session?.access_token}` } }).catch(() => null),
      ]);
      if (deptRes && deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(Array.isArray(data) ? data : data.data || []);
      }
      if (prodRes && prodRes.ok) {
        const data = await prodRes.json();
        setProducts(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Failed to load lookups', err);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTasks();
      fetchAnalytics();
      fetchLookups();
    }
  }, [session, filter, priorityFilter, searchTerm]);

  // Load department members whenever assignedDeptId changes
  useEffect(() => {
    if (assignedDeptId) {
      fetch(`http://localhost:4000/api/responsibility/departments/${assignedDeptId}/members`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
        .then(r => r.json())
        .then(m => setDeptMembers(Array.isArray(m) ? m : []))
        .catch(() => setDeptMembers([]));
    } else {
      setDeptMembers([]);
    }
  }, [assignedDeptId]);

  // Automatically trigger Responsibility Resolution whenever task type or product changes in form
  const evaluateResponsibility = async (taskType: string, productId: string) => {
    setResolvingResp(true);
    try {
      const res = await fetch('http://localhost:4000/api/responsibility/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
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

      const response = await fetch('http://localhost:4000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
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
        const err = await response.json();
        alert(err.error?.message || 'Failed to create task');
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
      const res = await fetch('http://localhost:4000/api/responsibility/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
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

      {/* Analytics KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-xl shadow-xs border border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Total Open</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">
            {analytics ? analytics.totalOpen : tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length}
          </p>
        </div>

        <div className="bg-card p-4 rounded-xl shadow-xs border border-red-500/30 bg-red-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-red-400">Overdue Tasks</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black text-red-400 mt-2">
            {analytics ? analytics.overdue : tasks.filter(t => t.isOverdue).length}
          </p>
        </div>

        <div className="bg-card p-4 rounded-xl shadow-xs border border-orange-500/30 bg-orange-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-orange-400">Due Today</span>
            <Calendar className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-2xl font-black text-orange-400 mt-2">
            {analytics ? analytics.dueToday : tasks.filter(t => t.dueToday).length}
          </p>
        </div>

        <div className="bg-card p-4 rounded-xl shadow-xs border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">
            {analytics ? analytics.completed : tasks.filter(t => t.status === 'COMPLETED').length}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card rounded-xl shadow-xs border border-border overflow-hidden">
        <div className="p-3 border-b border-border flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute inset-y-0 left-3 my-auto h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search by code, title, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="bg-background border border-border rounded-lg py-1.5 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="MY_TASKS">Assigned to Me</option>
            <option value="OVERDUE">Overdue Only</option>
            <option value="DUE_TODAY">Due Today</option>
            <option value="NO_UPDATE">Waiting for Update</option>
          </select>

          <select
            className="bg-background border border-border rounded-lg py-1.5 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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

        {/* Data Table */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-xs font-mono">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs">
            No tasks found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Task ID & Title</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Department & Owner</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Original Due</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Delay</th>
                  <th className="px-6 py-3 text-right font-mono text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground font-mono">{task.task_code || `TASK-${task.id.slice(0, 8)}`}</div>
                      <div className="text-muted-foreground line-clamp-1">{task.title}</div>
                    </td>

                    <td className="px-6 py-4 text-muted-foreground">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-foreground border border-border">
                        {task.task_type}
                      </span>
                    </td>

                    {/* Department & Owner */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">
                        {task.assigned_user?.full_name || 'Pending Assignment'}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {task.assigned_department?.name || 'Assigned Department'}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                        task.priority === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        task.priority === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        task.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {task.priority}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-mono text-muted-foreground text-xs">
                      {task.original_due_date || task.due_date}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                        task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        task.status === 'WAITING_FOR_UPDATE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {task.status}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {task.delayDays > 0 ? (
                        <span className="font-mono font-bold text-red-400 text-xs">
                          +{task.delayDays}d Delay
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">On Track</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
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
                      setAssignedDeptId(e.target.value);
                      setAssignedUserId('');
                    }}
                    className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
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
                    {deptMembers.map(m => (
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
