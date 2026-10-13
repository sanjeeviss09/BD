import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Clock,
  Layers,
  Eye,
  RefreshCw,
  Kanban,
  Table as TableIcon,
  X,
  Pill,
} from 'lucide-react';

interface OpportunityItem {
  id: string;
  opportunity_code: string;
  title: string;
  description?: string;
  opportunity_type: string;
  source: string;
  stage: string;
  status: string;
  priority: string;
  probability: number;
  estimated_value?: number;
  currency?: string;
  weighted_pipeline_value: number;
  opportunity_age_days: number;
  next_action?: string;
  next_action_date?: string;
  next_action_delay_days: number;
  health: 'HEALTHY' | 'ATTENTION' | 'AT_RISK' | 'CRITICAL';
  health_reasons?: string[];
  created_at: string;
  products?: { id: string; product_code: string; product_name: string };
  owner?: { id: string; email: string };
}

export default function Opportunities() {
  const { session } = useAuth();
  const { hasPermission } = usePermission();
  const navigate = useNavigate();

  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  // View state: 'table' vs 'kanban'
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Reference Catalogs
  const [stages, setStages] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [newType, setNewType] = useState('NEW_PRODUCT_DEVELOPMENT');
  const [newSource, setNewSource] = useState('CUSTOMER');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newStage, setNewStage] = useState('IDENTIFIED');
  const [newEstimatedValue, setNewEstimatedValue] = useState<number | ''>('');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [newProbability, setNewProbability] = useState<number>(10);
  const [newDecisionDate, setNewDecisionDate] = useState('');
  const [newLaunchDate, setNewLaunchDate] = useState('');
  const [newNextAction, setNewNextAction] = useState('');
  const [newNextActionDate, setNewNextActionDate] = useState('');

  // Fetch Reference Data & Stages
  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    const loadReferences = async () => {
      try {
        const [stagesRes, prodRes] = await Promise.all([
          fetch('http://localhost:4000/api/opportunities/references/stages', { headers }),
          fetch('http://localhost:4000/api/products?limit=100', { headers }),
        ]);

        if (stagesRes.ok) setStages((await stagesRes.json()).data || []);
        if (prodRes.ok) setProductsList((await prodRes.json()).products || []);
      } catch (err) {
        console.error('Failed to load references:', err);
      }
    };

    loadReferences();
  }, [session?.access_token]);

  // Fetch Opportunities & Analytics
  const fetchOpportunities = async () => {
    if (!session?.access_token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (stageFilter !== 'ALL') params.append('stage', stageFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (typeFilter !== 'ALL') params.append('opportunity_type', typeFilter);
      if (overdueOnly) params.append('overdue_next_action', 'true');

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [oppRes, anaRes] = await Promise.all([
        fetch(`http://localhost:4000/api/opportunities?${params.toString()}`, { headers }),
        fetch('http://localhost:4000/api/opportunities/analytics', { headers }),
      ]);

      if (oppRes.ok) {
        const data = await oppRes.json();
        setOpportunities(data.opportunities || []);
      }
      if (anaRes.ok) {
        const data = await anaRes.json();
        setAnalytics(data.data || null);
      }
    } catch (err) {
      console.error('Failed to fetch opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [searchTerm, stageFilter, statusFilter, priorityFilter, typeFilter, overdueOnly, session?.access_token]);

  const handleCreateOpportunity = async () => {
    if (!newTitle.trim()) {
      alert('Opportunity title is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        product_id: newProductId || undefined,
        opportunity_type: newType,
        source: newSource,
        priority: newPriority,
        stage: newStage,
        estimated_value: typeof newEstimatedValue === 'number' ? newEstimatedValue : undefined,
        currency: newCurrency,
        probability: newProbability,
        expected_decision_date: newDecisionDate || undefined,
        target_launch_date: newLaunchDate || undefined,
        next_action: newNextAction.trim() || undefined,
        next_action_date: newNextActionDate || undefined,
      };

      const res = await fetch('http://localhost:4000/api/opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create opportunity');
        setSubmitting(false);
        return;
      }

      setShowCreateModal(false);
      resetForm();
      fetchOpportunities();
    } catch (err: any) {
      alert(`Error creating opportunity: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewProductId('');
    setNewType('NEW_PRODUCT_DEVELOPMENT');
    setNewSource('CUSTOMER');
    setNewPriority('MEDIUM');
    setNewStage('IDENTIFIED');
    setNewEstimatedValue('');
    setNewCurrency('USD');
    setNewProbability(10);
    setNewDecisionDate('');
    setNewLaunchDate('');
    setNewNextAction('');
    setNewNextActionDate('');
  };

  const handleExportCSV = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('http://localhost:4000/api/opportunities/export', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `opportunities_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Group opportunities by stage for Kanban view
  const kanbanColumns = [
    { key: 'IDENTIFIED', label: 'Identified' },
    { key: 'INITIAL_SCREENING', label: 'Screening' },
    { key: 'QUALIFICATION', label: 'Qualification' },
    { key: 'TECHNICAL_EVALUATION', label: 'Technical Eval' },
    { key: 'COMMERCIAL_EVALUATION', label: 'Commercial Eval' },
    { key: 'NEGOTIATION', label: 'Negotiation' },
    { key: 'APPROVAL', label: 'Approval' },
    { key: 'WON', label: 'Won' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Opportunity Management</h1>
          <p className="text-sm text-gray-500">
            Commercial pipeline, multi-product qualification, revenue weighting, and BD decision tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium ${
                viewMode === 'kanban' ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Pipeline Board
            </button>
          </div>

          {hasPermission('opportunities.export') && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              <Download className="w-4 h-4 text-gray-500" />
              Export
            </button>
          )}

          {hasPermission('opportunities.create') && (
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Opportunity
            </button>
          )}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase font-mono">
            <span>Pipeline Value</span>
            <DollarSign className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2 font-mono">
            ${(analytics?.totalPipelineValue ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Total Unweighted Value</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase font-mono">
            <span>Weighted Pipeline</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            ${(analytics?.weightedPipelineValue ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Probability-Adjusted</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase font-mono">
            <span>Active Deals</span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-2 font-mono">
            {analytics?.activeOpportunities ?? 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Total: {analytics?.totalOpportunities ?? 0} Deals</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase font-mono">
            <span>Won / Contracted</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2 font-mono">
            {analytics?.wonOpportunities ?? 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Closed Deals</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase font-mono">
            <span>Delayed Actions</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-mono">
            {analytics?.overdueNextActionsCount ?? 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Pending Follow-ups</div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by opportunity code, title, product, or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-700"
            >
              <option value="ALL">All Stages</option>
              {stages.map(s => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open / Active</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-700"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-700"
            >
              <option value="ALL">All Types</option>
              <option value="NEW_PRODUCT_DEVELOPMENT">New Product Dev</option>
              <option value="CUSTOMER_REQUEST">Customer Request</option>
              <option value="MARKET_ENTRY">Market Entry</option>
              <option value="PRODUCT_EXTENSION">Product Extension</option>
              <option value="TECHNICAL_TRANSFER">Technical Transfer</option>
              <option value="CONTRACT_MANUFACTURING">Contract Mfg</option>
              <option value="CDMO_OPPORTUNITY">CDMO</option>
              <option value="IN_LICENSE">In-License</option>
              <option value="OUT_LICENSE">Out-License</option>
              <option value="PARTNERSHIP">Partnership</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={e => setOverdueOnly(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              Delayed Actions Only
            </label>
          </div>
        </div>
      </div>

      {/* Main View: Table vs Kanban */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 dark:text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
              Loading Opportunities...
            </div>
          ) : opportunities.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-slate-400">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-slate-600" />
              No commercial opportunities matching the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-left text-sm">
                <thead className="bg-gray-50 dark:bg-slate-950 text-gray-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-mono">Code</th>
                    <th className="px-6 py-3">Title & Primary Product</th>
                    <th className="px-6 py-3">Stage</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Probability</th>
                    <th className="px-6 py-3">Value (Est. / Wtd.)</th>
                    <th className="px-6 py-3">Next Action & Delay</th>
                    <th className="px-6 py-3">Health</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {opportunities.map(opp => (
                    <tr
                      key={opp.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-semibold text-indigo-600">
                        {opp.opportunity_code}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{opp.title}</div>
                        {opp.products && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Pill className="w-3 h-3 text-indigo-500" />
                            {opp.products.product_name}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {opp.stage.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            opp.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-800'
                              : opp.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : opp.priority === 'MEDIUM'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {opp.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-700">
                        {opp.probability}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          ${(opp.estimated_value || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-emerald-600 font-mono">
                          Wtd: ${(opp.weighted_pipeline_value || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-800">{opp.next_action || '—'}</div>
                        {opp.next_action_delay_days > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 mt-1">
                            <Clock className="w-3 h-3" />
                            Delayed {opp.next_action_delay_days}d
                          </span>
                        ) : opp.next_action_date ? (
                          <div className="text-[11px] text-gray-400 font-mono">
                            Due: {opp.next_action_date}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            opp.health === 'HEALTHY'
                              ? 'bg-emerald-100 text-emerald-800'
                              : opp.health === 'ATTENTION'
                              ? 'bg-yellow-100 text-yellow-800'
                              : opp.health === 'AT_RISK'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {opp.health}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/opportunities/${opp.id}`);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 font-medium inline-flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Kanban Pipeline View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map(col => {
            const colOpps = opportunities.filter(o => o.stage === col.key);
            const colVal = colOpps.reduce((sum, o) => sum + (o.estimated_value || 0), 0);

            return (
              <div
                key={col.key}
                className="w-72 flex-shrink-0 bg-gray-100 dark:bg-slate-900/90 rounded-xl p-3 flex flex-col max-h-[75vh] border border-gray-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-slate-800">
                  <div className="font-semibold text-xs text-gray-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                    {col.label} ({colOpps.length})
                  </div>
                  <div className="text-xs font-mono text-gray-500 dark:text-slate-400">
                    ${(colVal / 1000).toFixed(0)}k
                  </div>
                </div>

                <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                  {colOpps.map(opp => (
                    <div
                      key={opp.id}
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                      className="bg-white dark:bg-slate-950 p-3.5 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 hover:border-cyan-500/60 cursor-pointer space-y-2 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                          {opp.opportunity_code}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            opp.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-800'
                              : opp.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {opp.priority}
                        </span>
                      </div>

                      <div className="font-medium text-xs text-gray-900 line-clamp-2">
                        {opp.title}
                      </div>

                      {opp.products && (
                        <div className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                          <Pill className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                          {opp.products.product_name}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                        <span className="font-semibold text-gray-900">
                          ${(opp.estimated_value || 0).toLocaleString()}
                        </span>
                        <span className="text-[11px] text-emerald-600 font-mono">
                          {opp.probability}%
                        </span>
                      </div>

                      {opp.next_action_delay_days > 0 && (
                        <div className="text-[10px] text-red-600 font-bold bg-red-50 p-1 rounded border border-red-200">
                          Delayed {opp.next_action_delay_days}d
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Opportunity Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Create Business Opportunity</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Opportunity Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Atorvastatin 20mg Commercial Launch in Germany"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Primary Product (Product Master)
                  </label>
                  <select
                    value={newProductId}
                    onChange={e => setNewProductId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="">Select Product...</option>
                    {productsList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.product_code} — {p.product_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Opportunity Type
                  </label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="NEW_PRODUCT_DEVELOPMENT">New Product Development</option>
                    <option value="CUSTOMER_REQUEST">Customer Request</option>
                    <option value="MARKET_ENTRY">Market Entry</option>
                    <option value="CONTRACT_MANUFACTURING">Contract Manufacturing / CDMO</option>
                    <option value="IN_LICENSE">In-Licensing</option>
                    <option value="OUT_LICENSE">Out-Licensing</option>
                    <option value="PORTFOLIO_EXTENSION">Portfolio Extension</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Source</label>
                  <select
                    value={newSource}
                    onChange={e => setNewSource(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="CUSTOMER">Customer Direct</option>
                    <option value="MARKET_RESEARCH">Market Research</option>
                    <option value="CONFERENCE">Exhibition / CPHI</option>
                    <option value="PARTNER">Partner / Distributor</option>
                    <option value="INTERNAL_IDEA">Internal Strategy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Estimated Value ($)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 500000"
                    value={newEstimatedValue}
                    onChange={e =>
                      setNewEstimatedValue(e.target.value ? parseFloat(e.target.value) : '')
                    }
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Win Probability (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newProbability}
                    onChange={e => setNewProbability(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Target Launch Date
                  </label>
                  <input
                    type="date"
                    value={newLaunchDate}
                    onChange={e => setNewLaunchDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Expected Decision Date
                  </label>
                  <input
                    type="date"
                    value={newDecisionDate}
                    onChange={e => setNewDecisionDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Next Action Description
                </label>
                <input
                  type="text"
                  placeholder="e.g., Request API sample and execute formulation feasibility check"
                  value={newNextAction}
                  onChange={e => setNewNextAction(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Next Action Due Date
                </label>
                <input
                  type="date"
                  value={newNextActionDate}
                  onChange={e => setNewNextActionDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Strategic background, buyer requirements, and commercial overview..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOpportunity}
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Opportunity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
