import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart3,
  TrendingUp,
  Download,
  DollarSign,
  Pill,
  Clock,
  RefreshCw,
} from 'lucide-react';

export default function Analytics() {
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [oppAnalytics, setOppAnalytics] = useState<any>(null);
  const [taskAnalytics, setTaskAnalytics] = useState<any>(null);
  const [prodAnalytics, setProdAnalytics] = useState<any>(null);
  const [selectedHorizon, setSelectedHorizon] = useState('YTD');

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!session?.access_token) return;
      setLoading(true);

      const headers = { Authorization: `Bearer ${session.access_token}` };
      try {
        const [oppRes, taskRes, prodRes] = await Promise.allSettled([
          fetch('http://localhost:4000/api/opportunities/analytics', { headers }),
          fetch('http://localhost:4000/api/tasks/analytics', { headers }),
          fetch('http://localhost:4000/api/products/analytics', { headers }),
        ]);

        if (oppRes.status === 'fulfilled' && oppRes.value.ok) {
          setOppAnalytics((await oppRes.value.json()).data || null);
        }
        if (taskRes.status === 'fulfilled' && taskRes.value.ok) {
          setTaskAnalytics((await taskRes.value.json()).data || null);
        }
        if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
          setProdAnalytics((await prodRes.value.json()).data || null);
        }
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [session?.access_token]);

  const formatCurrency = (val: number) => {
    if (!val) return '$0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  const handleExportCSV = () => {
    window.open('http://localhost:4000/api/opportunities/export', '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-3" />
        <p className="text-xs font-mono uppercase tracking-wider">Aggregating Commercial Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-slate-100 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white light:text-slate-900">
              Executive Analytics & Revenue Builder
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              AGGREGATED REPORTING
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 font-mono">
            Pipeline Velocity, Win/Loss Conversions, Delay Attribution & Asset Concentration
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedHorizon}
            onChange={e => setSelectedHorizon(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-300 focus:outline-none"
          >
            <option value="Q3">Q3 2026</option>
            <option value="YTD">Year-to-Date (2026)</option>
            <option value="24M">Trailing 24-Month</option>
          </select>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-medium transition"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export Pipeline Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Pipeline Value</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {formatCurrency(oppAnalytics?.total_pipeline_value || 0)}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Weighted Value: {formatCurrency(oppAnalytics?.weighted_pipeline_value || 0)}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Opportunities</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {oppAnalytics?.total_opportunities || 0} Deals
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {oppAnalytics?.qualified_count || 0} Fully Qualified Deals
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Operational Delays</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {oppAnalytics?.overdue_next_actions_count || 0} Actions Overdue
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Linked Task Backlog: {taskAnalytics?.totalDelayed || 0} Overdue
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/80 shadow-xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Pharmaceutical Master Assets</span>
            <Pill className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {prodAnalytics?.total_products || 0} Products
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Under Active Evaluation
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Value Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
            Pipeline Value by Workflow Stage
          </h3>

          {oppAnalytics?.stages && oppAnalytics.stages.length > 0 ? (
            <div className="space-y-3">
              {oppAnalytics.stages.map((st: any) => {
                const totalVal = oppAnalytics.total_pipeline_value || 1;
                const pct = Math.round(((st.value || 0) / totalVal) * 100);
                return (
                  <div key={st.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">{st.stage}</span>
                      <span className="font-mono text-slate-400">
                        {formatCurrency(st.value)} ({pct}%) · {st.count} Deals
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 font-mono">
              No commercial pipeline value recorded in this period.
            </div>
          )}
        </div>

        {/* Win/Loss & Health Attribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
            Portfolio Health & Win / Loss Breakdown
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-1">
              <div className="text-xs font-mono text-emerald-400 uppercase">Won / Contracted Deals</div>
              <div className="text-2xl font-bold font-mono text-emerald-300">
                {oppAnalytics?.won_count || 0}
              </div>
              <div className="text-xs text-slate-400">Closed deals executing development</div>
            </div>

            <div className="p-4 rounded-lg bg-rose-950/20 border border-rose-500/30 space-y-1">
              <div className="text-xs font-mono text-rose-400 uppercase">Lost / Discontinued</div>
              <div className="text-2xl font-bold font-mono text-rose-300">
                {oppAnalytics?.lost_count || 0}
              </div>
              <div className="text-xs text-slate-400">Structured loss reasons captured</div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 leading-relaxed font-mono">
              BDIQ enforces deterministic calculation formulas across probability-weighted pipeline values and task delay calculations. No values are extrapolated without authorized tenant records.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
