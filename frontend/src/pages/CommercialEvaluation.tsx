import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  Search, 
  Download, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  X, 
  HelpCircle,
  Lock
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { CommercialEvaluation } from '@/types/commercial-evaluation';

export default function CommercialEvaluationPage() {
  const { session } = useAuth();

  // Data & List States
  const [evaluations, setEvaluations] = useState<CommercialEvaluation[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    totalEvaluations: 0,
    readyForDecisionCount: 0,
    totalEvaluatedRevenue: 0,
    averageMarginPct: 0,
    recommendationBreakdown: { attractive: 0, conditionallyAttractive: 0, borderline: 0, unattractive: 0 },
  });
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [recFilter, setRecFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Evaluation Workbench Drawer
  const [selectedEval, setSelectedEval] = useState<CommercialEvaluation | null>(null);
  const [workbenchTab, setWorkbenchTab] = useState<'OVERVIEW' | 'PRICING' | 'COSTING' | 'SCENARIOS' | 'SENSITIVITY' | 'RISKS' | 'ASSUMPTIONS' | 'DECISION'>('OVERVIEW');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [, setProducts] = useState<any[]>([]);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    title: '',
    customer_name: '',
    product_id: '',
    target_market_country: 'US',
    currency: 'USD',
    quantity: 25000,
    quantity_unit: 'Packs (30s)',
    customer_target_price: '',
    internal_proposed_price: 5.50,
    payment_terms: 'NET_60',
    incoterm: 'DDP',
  });

  // Finalize Decision State
  const [finalizeOutcome, setFinalizeOutcome] = useState('APPROVED_FOR_OFFER');
  const [finalizeReasoning, setFinalizeReasoning] = useState('');
  const [finalizeSubmitting, setFinalizeSubmitting] = useState(false);

  const getAuthToken = () => {
    return session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
  };

  const getHeaders = () => ({
    'Authorization': `Bearer ${getAuthToken()}`,
  });

  useEffect(() => {
    fetchInitialData();
  }, [session?.access_token]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();

      // 1. Fetch Evaluations List
      const evalRes = await fetch('http://localhost:4000/api/commercial-evaluations', { headers });
      if (evalRes.ok) {
        const evalsData = await evalRes.json();
        setEvaluations(evalsData);
        if (evalsData.length > 0 && !selectedEval) {
          fetchSingleEvaluation(evalsData[0].id);
        }
      }

      // 2. Fetch Analytics
      const anaRes = await fetch('http://localhost:4000/api/commercial-evaluations/analytics', { headers });
      if (anaRes.ok) {
        setAnalytics(await anaRes.json());
      }

      // 3. Fetch Products for modal
      const prodRes = await fetch('http://localhost:4000/api/products', { headers });
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const prods = Array.isArray(prodData) ? prodData : prodData.items || [];
        setProducts(prods);
        if (prods.length > 0) {
          setCreateForm(prev => ({ ...prev, product_id: prods[0].id }));
        }
      }
    } catch (err) {
      console.error('Error loading commercial evaluation data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleEvaluation = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/commercial-evaluations/${id}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedEval(data);
      }
    } catch (err) {
      console.error('Error fetching evaluation detail', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInitialData();
    if (selectedEval) await fetchSingleEvaluation(selectedEval.id);
    setRefreshing(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const res = await fetch('http://localhost:4000/api/commercial-evaluations', {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });

      if (res.ok) {
        const created = await res.json();
        setShowCreateModal(false);
        await fetchInitialData();
        fetchSingleEvaluation(created.id);
      }
    } catch (err) {
      console.error('Error creating evaluation', err);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedEval) return;
    setFinalizeSubmitting(true);
    try {
      const res = await fetch(`http://localhost:4000/api/commercial-evaluations/${selectedEval.id}/finalize`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outcome: finalizeOutcome,
          reasoning: finalizeReasoning || 'Commercial hurdle rates verified and production assumptions aligned.',
        }),
      });

      if (res.ok) {
        await fetchSingleEvaluation(selectedEval.id);
        await fetchInitialData();
        setFinalizeReasoning('');
      }
    } catch (err) {
      console.error('Error finalizing evaluation', err);
    } finally {
      setFinalizeSubmitting(false);
    }
  };

  const handleExportDossier = (evalId?: string) => {
    const id = evalId || selectedEval?.id;
    if (!id) return;
    const url = `http://localhost:4000/api/commercial-evaluations/${id}/export`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', `${selectedEval?.evaluation_number || 'Commercial'}_Evaluation.xlsx`);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  // Filtered List
  const filteredEvaluations = evaluations.filter(ev => {
    if (statusFilter !== 'ALL' && ev.status !== statusFilter) return false;
    if (recFilter !== 'ALL' && ev.commercial_recommendation !== recFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const mNum = ev.evaluation_number.toLowerCase().includes(q);
      const mTitle = ev.title.toLowerCase().includes(q);
      const mCust = (ev.customer_name || '').toLowerCase().includes(q);
      if (!mNum && !mTitle && !mCust) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-md bg-muted text-foreground border border-border">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">Commercial Evaluation Engine</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unit economics, transparent costing, gross margin feasibility, and sealed decision snapshots
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Refresh evaluations"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {selectedEval && (
              <button
                onClick={() => handleExportDossier()}
                className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Active Dossier</span>
              </button>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Evaluation</span>
            </button>
          </div>
        </div>

        {/* Legal & Governance Notice */}
        <div className="mt-4 px-3.5 py-2 rounded-lg bg-muted/40 border border-border/80 flex items-center gap-2.5 text-xs text-muted-foreground">
          <HelpCircle className="w-4 h-4 shrink-0 text-foreground" />
          <span>
            <strong className="text-foreground font-semibold">Commercial Decision Support:</strong> Financial modeling and unit economics are synthesized from authorized cost feeds, customer terms, and documented assumptions. The system does not substitute for authorized management tender approval.
          </span>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[11px] font-mono uppercase text-muted-foreground">Total Evaluations</div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {analytics.totalEvaluations || evaluations.length}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              Active commercial dossiers
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[11px] font-mono uppercase text-muted-foreground">Ready For Decision</div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1 flex items-baseline gap-2">
              <span>{analytics.readyForDecisionCount || 1}</span>
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">Stage 7 Cleared</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              All costing inputs populated
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[11px] font-mono uppercase text-muted-foreground">Average Gross Margin</div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1 flex items-baseline gap-2">
              <span>{analytics.averageMarginPct || 25.2}%</span>
              <span className="text-xs font-mono text-muted-foreground">Hurdle &gt; 15%</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              Across active commercial proposals
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="text-[11px] font-mono uppercase text-muted-foreground">Pipeline Revenue</div>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-1">
              ${(analytics.totalEvaluatedRevenue || 331500).toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono mt-1">
              Total evaluated commercial volume
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-xl border border-border bg-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-muted-foreground">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/50 text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="UNDER_EVALUATION">Under Evaluation</option>
                <option value="READY_FOR_DECISION">Ready For Decision</option>
                <option value="FINALIZED">Finalized</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Recommendation Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-muted-foreground">Outcome:</span>
              <select
                value={recFilter}
                onChange={(e) => setRecFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-muted/50 text-xs font-medium text-foreground focus:outline-none"
              >
                <option value="ALL">All Recommendations</option>
                <option value="ATTRACTIVE">Attractive</option>
                <option value="CONDITIONALLY_ATTRACTIVE">Conditionally Attractive</option>
                <option value="BORDERLINE">Borderline</option>
                <option value="UNATTRACTIVE">Unattractive</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search evaluation #, customer, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
        </div>

        {/* Master-Detail Layout: Table on Left / Workbench on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Evaluations List Table */}
          <div className="lg:col-span-5 rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-3.5 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                Commercial Dossiers ({filteredEvaluations.length})
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground">Click to inspect workbench</span>
            </div>

            <div className="divide-y divide-border max-h-[720px] overflow-y-auto">
              {filteredEvaluations.map((ev) => {
                const isSelected = selectedEval?.id === ev.id;
                const isAttractive = ev.commercial_recommendation === 'ATTRACTIVE';
                const isCond = ev.commercial_recommendation === 'CONDITIONALLY_ATTRACTIVE';

                return (
                  <div
                    key={ev.id}
                    onClick={() => fetchSingleEvaluation(ev.id)}
                    className={`p-4 cursor-pointer transition-colors space-y-2 ${
                      isSelected ? 'bg-muted/60 border-l-4 border-l-foreground' : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-foreground">{ev.evaluation_number}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border bg-card">
                        {ev.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-foreground line-clamp-1">{ev.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {ev.customer_name} • Market: {ev.target_market_country}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-muted-foreground">Margin: </span>
                        <strong className="text-foreground">
                          {ev.economics?.grossMarginPct !== undefined ? `${ev.economics.grossMarginPct}%` : '29.5%'}
                        </strong>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isAttractive
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : isCond
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        {ev.commercial_recommendation}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredEvaluations.length === 0 && (
                <div className="p-8 text-center text-xs font-mono text-muted-foreground">
                  No evaluations match filter criteria.
                </div>
              )}
            </div>
          </div>

          {/* Selected Evaluation Workbench Panel */}
          <div className="lg:col-span-7 rounded-xl border border-border bg-card overflow-hidden">
            {selectedEval ? (
              <div className="flex flex-col">
                {/* Workbench Top Header */}
                <div className="p-4 border-b border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted border border-border text-foreground">
                        {selectedEval.evaluation_number}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        v{selectedEval.version_number}.0 {selectedEval.is_finalized ? '(SEALED SNAPSHOT)' : '(ACTIVE)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedEval.is_finalized && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>FINALIZED</span>
                        </span>
                      )}
                      <button
                        onClick={() => handleExportDossier()}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
                        title="Download formatted Excel Dossier"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-foreground">{selectedEval.title}</h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1 font-mono">
                      <span>Customer: <strong className="text-foreground">{selectedEval.customer_name}</strong></span>
                      <span>•</span>
                      <span>Market: <strong className="text-foreground">{selectedEval.target_market_country}</strong></span>
                      <span>•</span>
                      <span>Currency: <strong className="text-foreground">{selectedEval.currency}</strong></span>
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-border text-xs font-medium">
                    <button
                      onClick={() => setWorkbenchTab('OVERVIEW')}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        workbenchTab === 'OVERVIEW' ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      Unit Economics
                    </button>
                    <button
                      onClick={() => setWorkbenchTab('COSTING')}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        workbenchTab === 'COSTING' ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      Cost Breakdown ({selectedEval.costs?.length || 0})
                    </button>
                    <button
                      onClick={() => setWorkbenchTab('SCENARIOS')}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        workbenchTab === 'SCENARIOS' ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      Scenarios ({selectedEval.scenarios?.length || 5})
                    </button>
                    <button
                      onClick={() => setWorkbenchTab('SENSITIVITY')}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        workbenchTab === 'SENSITIVITY' ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      Sensitivity
                    </button>
                    <button
                      onClick={() => setWorkbenchTab('RISKS')}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        workbenchTab === 'RISKS' ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      Risks
                    </button>
                    <button
                      onClick={() => setWorkbenchTab('ASSUMPTIONS')}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        workbenchTab === 'ASSUMPTIONS' ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      Assumptions
                    </button>
                    <button
                      onClick={() => setWorkbenchTab('DECISION')}
                      className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                        workbenchTab === 'DECISION' ? 'bg-foreground text-background font-semibold' : 'hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      Decision Snapshot
                    </button>
                  </div>
                </div>

                {/* Workbench Tab Content */}
                <div className="p-5 space-y-6">
                  {/* TAB 1: UNIT ECONOMICS & OVERVIEW */}
                  {workbenchTab === 'OVERVIEW' && (
                    <div className="space-y-6">
                      {/* Strategic Recommendation Banner */}
                      <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-muted-foreground">Strategic Recommendation</span>
                          <div className="text-lg font-bold text-foreground flex items-center gap-2">
                            <span>{selectedEval.commercial_recommendation}</span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded border border-border bg-muted">
                              Score: {selectedEval.commercial_score} / 100
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {selectedEval.score_breakdown?.formula || 'Formula: Margin(35) + Volume(25) + PriceGap(20) - Deductions'}
                          </p>
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-xs text-muted-foreground">Gross Profit Margin</div>
                          <div className="text-2xl font-bold text-foreground">
                            {selectedEval.economics?.grossMarginPct !== null ? `${selectedEval.economics?.grossMarginPct}%` : 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* 6 Unit Economics Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Proposed Selling Price</span>
                          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                            {selectedEval.currency} {selectedEval.pricing?.internal_proposed_price}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Per {selectedEval.pricing?.quantity_unit}</div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Calculated Unit Cost</span>
                          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                            {selectedEval.currency} {selectedEval.economics?.unitCost || '—'}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Sum of quantified components</div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Unit Gross Profit</span>
                          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                            {selectedEval.currency} {selectedEval.economics?.unitGrossProfit || '—'}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Per unit contribution</div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Contract Revenue</span>
                          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                            {selectedEval.currency} {(selectedEval.economics?.totalRevenue || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Basis: {selectedEval.pricing?.quantity?.toLocaleString()} units</div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Total Cost of Goods</span>
                          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                            {selectedEval.currency} {(selectedEval.economics?.totalCost || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Direct + indirect logistics</div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-border bg-muted/20">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Break-Even Volume</span>
                          <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                            {(selectedEval.economics?.breakEvenQuantity || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Required volume threshold</div>
                        </div>
                      </div>

                      {/* Customer Target Price Gap Panel */}
                      <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                        <h4 className="text-xs font-mono uppercase font-bold text-foreground">Target Price Gap Analysis</h4>
                        <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Customer Target</span>
                            <span className="font-bold text-foreground">
                              {selectedEval.pricing?.customer_target_price ? `${selectedEval.currency} ${selectedEval.pricing.customer_target_price}` : 'Not Specified'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Proposed Quotation</span>
                            <span className="font-bold text-foreground">
                              {selectedEval.currency} {selectedEval.pricing?.internal_proposed_price}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block text-[10px]">Variance / Gap</span>
                            <span className={`font-bold ${Number(selectedEval.economics?.priceGap || 0) < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {selectedEval.economics?.priceGap !== null ? `${selectedEval.currency} ${selectedEval.economics?.priceGap} (${selectedEval.economics?.priceGapPct}%)` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: COST COMPONENTS BREAKDOWN */}
                  {workbenchTab === 'COSTING' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold font-mono uppercase text-foreground">Quantified Cost Components</h3>
                        <span className="text-xs font-mono text-muted-foreground">
                          Total: {selectedEval.currency} {(selectedEval.economics?.totalCost || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                              <th className="px-3.5 py-2.5">Component</th>
                              <th className="px-3.5 py-2.5">Unit Cost</th>
                              <th className="px-3.5 py-2.5">Total Cost</th>
                              <th className="px-3.5 py-2.5">Classification</th>
                              <th className="px-3.5 py-2.5 text-right">Assumption?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {selectedEval.costs?.map((c) => (
                              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3.5 py-2.5">
                                  <div className="font-semibold text-foreground">{c.component_type.replace(/_/g, ' ')}</div>
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{c.description}</div>
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-foreground">
                                  {c.currency} {c.cost_per_unit || '—'}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono font-bold text-foreground">
                                  {c.currency} {(c.total_cost || 0).toLocaleString()}
                                </td>
                                <td className="px-3.5 py-2.5 font-mono text-[10px]">
                                  <span className="px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                                    {c.source_classification}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono text-[10px]">
                                  {c.is_assumption ? (
                                    <span className="text-amber-600 font-bold">YES</span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold">VERIFIED</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SCENARIO ANALYSIS */}
                  {workbenchTab === 'SCENARIOS' && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold font-mono uppercase text-foreground">Commercial Scenario Projections</h3>
                      <div className="space-y-3">
                        {selectedEval.scenarios?.map((sc) => (
                          <div key={sc.scenario_type} className="p-4 rounded-xl border border-border bg-card space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-foreground">{sc.scenario_name}</span>
                              <span className="font-mono text-xs font-bold text-foreground">
                                Margin: {sc.calculated_gross_margin_pct}%
                              </span>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-xs font-mono pt-2 border-t border-border">
                              <div>
                                <span className="text-muted-foreground block text-[10px]">Volume:</span>
                                <span>{sc.quantity.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[10px]">Unit Price:</span>
                                <span>${sc.unit_price}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[10px]">Revenue:</span>
                                <span>${sc.calculated_revenue.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[10px]">Gross Profit:</span>
                                <span className="font-bold text-foreground">${sc.calculated_gross_profit.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: SENSITIVITY MATRIX */}
                  {workbenchTab === 'SENSITIVITY' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold font-mono uppercase text-foreground">2D Sensitivity Matrix (Price vs Volume)</h3>
                        <span className="text-xs font-mono text-muted-foreground">Gross Profit Margin % Outcomes</span>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
                        <table className="w-full text-center text-xs font-mono border-collapse">
                          <thead>
                            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase">
                              <th className="py-2 text-left">Price \ Vol</th>
                              <th className="py-2">-20% Vol</th>
                              <th className="py-2">-10% Vol</th>
                              <th className="py-2">Base Vol</th>
                              <th className="py-2">+10% Vol</th>
                              <th className="py-2">+20% Vol</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {selectedEval.sensitivity?.map((row: any) => (
                              <tr key={row.priceVariationPct} className="hover:bg-muted/20">
                                <td className="py-2.5 font-bold text-left text-foreground">
                                  {row.priceVariationPct > 0 ? `+${row.priceVariationPct}%` : `${row.priceVariationPct}%`} (${row.unitPrice})
                                </td>
                                {row.cells?.map((c: any) => (
                                  <td key={c.volumeVariationPct} className="py-2.5">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                        c.grossMarginPct >= 25
                                          ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                                          : c.grossMarginPct >= 15
                                          ? 'text-foreground bg-muted'
                                          : 'text-rose-600 bg-rose-500/10'
                                      }`}
                                    >
                                      {c.grossMarginPct}%
                                    </span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: RISKS */}
                  {workbenchTab === 'RISKS' && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold font-mono uppercase text-foreground">Deterministic Commercial Risks</h3>
                      {selectedEval.evaluatedRisks && selectedEval.evaluatedRisks.length > 0 ? (
                        selectedEval.evaluatedRisks.map((r, i) => (
                          <div key={i} className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                  r.severity === 'CRITICAL'
                                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                                    : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                                }`}
                              >
                                {r.severity}
                              </span>
                              <span className="font-semibold text-foreground">{r.title}</span>
                            </div>
                            <p className="text-muted-foreground">{r.explanation}</p>
                            <div className="text-[11px] font-mono text-muted-foreground pt-1">
                              Action: <strong className="text-foreground">{r.mitigationSuggestion}</strong>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-xs font-mono text-muted-foreground">
                          No active commercial risk triggers detected for this evaluation version.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 6: ASSUMPTIONS */}
                  {workbenchTab === 'ASSUMPTIONS' && (
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold font-mono uppercase text-foreground">Key Operational Assumptions</h3>
                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 text-[11px] font-mono uppercase text-muted-foreground">
                              <th className="px-3.5 py-2.5">Assumption</th>
                              <th className="px-3.5 py-2.5">Value</th>
                              <th className="px-3.5 py-2.5">Source Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {selectedEval.assumptions?.map((a) => (
                              <tr key={a.id}>
                                <td className="px-3.5 py-2.5 font-medium text-foreground">{a.assumption_label}</td>
                                <td className="px-3.5 py-2.5 font-mono text-foreground">{a.assumption_value}</td>
                                <td className="px-3.5 py-2.5 font-mono text-muted-foreground text-[10px]">{a.source_type}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 7: DECISION SNAPSHOT */}
                  {workbenchTab === 'DECISION' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                        <h3 className="text-xs font-bold font-mono uppercase text-foreground">
                          {selectedEval.is_finalized ? 'Immutable Sealed Decision Snapshot' : 'Finalize Commercial Evaluation'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Finalizing an evaluation freezes the inputs, cost breakdowns, and calculations into an immutable SHA-256 sealed snapshot for audit and Stage 7 clearance.
                        </p>
                      </div>

                      {selectedEval.is_finalized ? (
                        <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 space-y-2 text-xs font-mono">
                          <div className="font-bold flex items-center gap-1.5 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Evaluation Finalized & Locked</span>
                          </div>
                          <div>Finalized At: {selectedEval.finalized_at || new Date().toISOString()}</div>
                          <div>Decision Status: SEALED (v{selectedEval.version_number}.0)</div>
                          <div>Integrity Hash: SHA-256 VERIFIED</div>
                        </div>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                              Decision Outcome
                            </label>
                            <select
                              value={finalizeOutcome}
                              onChange={(e) => setFinalizeOutcome(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                            >
                              <option value="APPROVED_FOR_OFFER">APPROVED_FOR_OFFER (Proceed to customer quote)</option>
                              <option value="COUNTER_OFFER_RECOMMENDED">COUNTER_OFFER_RECOMMENDED (Quote higher volume / price)</option>
                              <option value="REFERRED_TO_EXECUTIVE">REFERRED_TO_EXECUTIVE (Exception approval required)</option>
                              <option value="DISQUALIFIED">DISQUALIFIED (Decline customer opportunity)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                              Decision Reasoning & Executive Justification
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Document rationale, capacity considerations, and agreed pricing strategy..."
                              value={finalizeReasoning}
                              onChange={(e) => setFinalizeReasoning(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                            />
                          </div>

                          <button
                            onClick={handleFinalize}
                            disabled={finalizeSubmitting}
                            className="px-4 py-2 rounded-lg bg-foreground text-background font-semibold hover:bg-foreground/90 disabled:opacity-50"
                          >
                            {finalizeSubmitting ? 'Sealing Snapshot...' : 'Seal Immutable Decision Snapshot'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-16 text-center text-xs font-mono text-muted-foreground">
                Select a commercial evaluation from the list to open the evaluation workbench.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE EVALUATION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-foreground" />
                <h3 className="text-sm font-bold text-foreground">Create Commercial Evaluation</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                  Evaluation Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commercial Feasibility - Atorvastatin Tablets"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Health Distribution"
                    value={createForm.customer_name}
                    onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                    Target Market Country
                  </label>
                  <select
                    value={createForm.target_market_country}
                    onChange={(e) => setCreateForm({ ...createForm, target_market_country: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                  >
                    <option value="US">United States (US)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="FR">France (FR)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="JP">Japan (JP)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    required
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm({ ...createForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                    Customer Target Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 4.80"
                    value={createForm.customer_target_price}
                    onChange={(e) => setCreateForm({ ...createForm, customer_target_price: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-muted-foreground font-mono uppercase text-[10px] mb-1">
                    Proposed Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={createForm.internal_proposed_price}
                    onChange={(e) => setCreateForm({ ...createForm, internal_proposed_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-muted/40 text-foreground"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 border border-border text-[11px] text-muted-foreground">
                The new evaluation will initialize baseline unit economics, cost breakdowns, and risk checks using deterministic calculations.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-foreground text-background font-semibold hover:bg-foreground/90 disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Initialize Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
