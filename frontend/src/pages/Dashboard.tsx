import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import { Link } from 'react-router-dom';
import { IntelligenceNetwork3D } from '@/components/3d/IntelligenceNetwork3D';
import { IntelligenceMetric } from '@/components/visualization/IntelligenceMetric';
import { ActivityTimeline } from '@/components/visualization/ActivityTimeline';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckSquare,
  Pill,
  Globe,
  RefreshCw,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Building2,
  BarChart2,
} from 'lucide-react';

export default function Dashboard() {
  const { session } = useAuth();
  const { profile } = usePermission();

  const [loading, setLoading] = useState(true);
  const [oppAnalytics, setOppAnalytics] = useState<any>(null);
  const [taskAnalytics, setTaskAnalytics] = useState<any>(null);
  const [prodAnalytics, setProdAnalytics] = useState<any>(null);
  const [recentOpportunities, setRecentOpportunities] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (!session?.access_token) return;
    setLoading(true);

    const headers = { Authorization: `Bearer ${session.access_token}` };

    try {
      const [oppRes, taskRes, prodRes, recentOppRes] = await Promise.allSettled([
        fetch('http://localhost:4000/api/opportunities/analytics', { headers }),
        fetch('http://localhost:4000/api/tasks/analytics', { headers }),
        fetch('http://localhost:4000/api/products/analytics', { headers }),
        fetch('http://localhost:4000/api/opportunities?limit=5', { headers }),
      ]);

      if (oppRes.status === 'fulfilled' && oppRes.value.ok) {
        const data = await oppRes.value.json();
        setOppAnalytics(data.data || null);
      }
      if (taskRes.status === 'fulfilled' && taskRes.value.ok) {
        const data = await taskRes.value.json();
        setTaskAnalytics(data.data || null);
      }
      if (prodRes.status === 'fulfilled' && prodRes.value.ok) {
        const data = await prodRes.value.json();
        setProdAnalytics(data.data || null);
      }
      if (recentOppRes.status === 'fulfilled' && recentOppRes.value.ok) {
        const data = await recentOppRes.value.json();
        setRecentOpportunities(data.opportunities || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [session?.access_token]);

  const formatCurrency = (val: number) => {
    if (!val) return '$0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const timelineMock = [
    {
      id: 'tl-1',
      eventType: 'QUALIFICATION_COMPLETED',
      title: 'Augmentin Extended Release Qualified',
      description: 'Achieved 80% qualification threshold across technical & regulatory criteria.',
      timestamp: 'Today, 14:30',
      actorName: 'Dr. Sarah Chen (BD Lead)',
    },
    {
      id: 'tl-2',
      eventType: 'STAGE_CHANGED',
      title: 'EU Biosimilar Opportunity advanced to TECHNICAL_EVALUATION',
      description: 'Transition validated following API solubility analysis report.',
      timestamp: 'Today, 11:15',
      actorName: 'Marcus Vance',
    },
    {
      id: 'tl-3',
      eventType: 'TASK_DELAYED',
      title: 'Next Action Delayed on Formulation Batch #4',
      description: 'Laboratory stability update waiting on HPLC raw data from CMO.',
      timestamp: 'Yesterday, 16:45',
      actorName: 'System Monitor',
    },
    {
      id: 'tl-4',
      eventType: 'DOCUMENT_UPLOADED',
      title: 'Module 3 Quality Summary Uploaded',
      description: 'EMA harmonization dossier version 1.2 archived in product dossier.',
      timestamp: 'Oct 04, 2026',
      actorName: 'Elena Rostova',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Executive Command Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white light:text-slate-900">
              Executive Intelligence Command Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              LIVE TELEMETRY
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              {currentDate}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              {profile?.organization_name || 'Global Enterprise Pharma Inc.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 text-xs hover:border-slate-700 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/opportunities"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-medium shadow-md shadow-cyan-600/20 transition"
          >
            <span>Explore Pipeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Executive 3D Global Market Network Hero */}
      <IntelligenceNetwork3D />

      {/* High-Level Intelligence Metric Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <IntelligenceMetric
          title="Active Pipeline Value"
          value={formatCurrency(oppAnalytics?.total_pipeline_value || 0)}
          subtitle={`Weighted: ${formatCurrency(oppAnalytics?.weighted_pipeline_value || 0)}`}
          badge="Commercial"
          badgeVariant="emerald"
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          sparklineData={[40, 52, 60, 55, 68, 74, 85, 92]}
          sparklineColor="#10b981"
        />

        <IntelligenceMetric
          title="Active BD Opportunities"
          value={oppAnalytics?.total_opportunities || 0}
          subtitle={`${oppAnalytics?.qualified_count || 0} Fully Qualified Deals`}
          badge="Stage Gate"
          badgeVariant="cyan"
          icon={<TrendingUp className="w-4 h-4 text-cyan-400" />}
          sparklineData={[12, 14, 18, 16, 21, 24, 28, 32]}
          sparklineColor="#0ea5e9"
        />

        <IntelligenceMetric
          title="Delayed Next Actions"
          value={oppAnalytics?.overdue_next_actions_count || 0}
          subtitle={`${taskAnalytics?.totalDelayed || 0} Overdue Follow-ups`}
          badge={oppAnalytics?.overdue_next_actions_count > 0 ? 'Action Req' : 'Optimal'}
          badgeVariant={oppAnalytics?.overdue_next_actions_count > 0 ? 'rose' : 'emerald'}
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
          sparklineData={[5, 4, 6, 8, 7, 5, 4, 3]}
          sparklineColor="#f43f5e"
        />

        <IntelligenceMetric
          title="Canonical Product Assets"
          value={prodAnalytics?.total_products || 0}
          subtitle="Formulations & Presentations"
          badge="Portfolio"
          badgeVariant="amber"
          icon={<Pill className="w-4 h-4 text-amber-400" />}
          sparklineData={[20, 22, 24, 25, 28, 30, 34, 38]}
          sparklineColor="#f59e0b"
        />
      </div>

      {/* Dual Column: Stage Funnel & Active Opportunity Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Stage Funnel & High-Priority Opportunities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stage Funnel Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  Opportunity Stage Gate Distribution
                </h3>
              </div>
              <Link to="/opportunities" className="text-xs font-mono text-cyan-400 hover:underline">
                View Kanban Board →
              </Link>
            </div>

            {oppAnalytics?.stages && oppAnalytics.stages.length > 0 ? (
              <div className="space-y-3">
                {oppAnalytics.stages.map((st: any) => {
                  const maxCount = Math.max(...oppAnalytics.stages.map((s: any) => s.count), 1);
                  const pct = Math.round((st.count / maxCount) * 100);
                  return (
                    <div key={st.stage} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300">{st.stage.replace(/_/g, ' ')}</span>
                        <div className="font-mono text-slate-400">
                          <span className="text-cyan-400 font-semibold">{st.count}</span> deals · {formatCurrency(st.value)}
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                No active stage-gate distribution data available. Create an Opportunity to begin.
              </div>
            )}
          </div>

          {/* High Priority Opportunities Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  High Priority Strategic Deals
                </h3>
              </div>
              <Link to="/opportunities" className="text-xs font-mono text-cyan-400 hover:underline">
                All Opportunities ({oppAnalytics?.total_opportunities || 0}) →
              </Link>
            </div>

            {recentOpportunities.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Title</th>
                      <th className="p-2.5">Stage</th>
                      <th className="p-2.5">Value</th>
                      <th className="p-2.5">Health</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {recentOpportunities.map((opp) => (
                      <tr key={opp.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-2.5 font-mono text-cyan-400">{opp.opportunity_code}</td>
                        <td className="p-2.5 font-medium max-w-[200px] truncate">{opp.title}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                            {opp.stage}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-emerald-400">
                          {formatCurrency(opp.estimated_value)}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              opp.health === 'CRITICAL'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : opp.health === 'AT_RISK'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            {opp.health || 'HEALTHY'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <Link
                            to={`/opportunities/${opp.id}`}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono hover:underline"
                          >
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-mono">
                No active opportunities found in current portfolio.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Live Audit Activity Timeline */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  Intelligence Feed
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                AUDIT TRAIL
              </span>
            </div>

            <ActivityTimeline events={timelineMock} maxItems={4} />
          </div>

          {/* Quick Shortcuts Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <h3 className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Operational Accelerators
            </h3>
            <div className="space-y-2">
              <Link
                to="/opportunities?action=new"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/60 hover:border-slate-700 text-xs text-slate-200 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Initiate New BD Opportunity</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                to="/market-intelligence"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/60 hover:border-slate-700 text-xs text-slate-200 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-violet-400" />
                  <span>Launch Market Intelligence Terminal</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                to="/tasks?action=new"
                className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/60 hover:border-slate-700 text-xs text-slate-200 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 text-sky-400" />
                  <span>Create Action Follow-up</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
