import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart3,
  Clock,
  AlertTriangle,
  RefreshCw,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export default function WorkflowAnalytics() {
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:4000/api/workflows/analytics', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch workflow analytics');
      }

      const data = await res.json();
      setAnalytics(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="text-xs font-mono tracking-wider uppercase">
          Aggregating Operational Pipeline Analytics...
        </span>
      </div>
    );
  }

  const stageDistribution = analytics?.stageDistribution || [];
  const averageDurations = analytics?.averageDurations || [];
  const slaCompliance = analytics?.slaCompliance || { compliance_rate: 100, on_track_count: 0, overdue_count: 0 };
  const bottlenecks = analytics?.bottlenecks || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Workflow Operational Intelligence
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Stage Gate Dwell Times • SLA Compliance • Pipeline Velocity & Bottlenecks
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition self-start"
          title="Refresh Analytics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SLA Compliance */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">SLA Compliance</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {slaCompliance.compliance_rate}%
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            {slaCompliance.on_track_count} on-track • {slaCompliance.overdue_count} overdue
          </div>
        </div>

        {/* Total Active Instances */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Active In Pipeline</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">
            {stageDistribution.reduce((acc: number, cur: any) => acc + (cur.opportunity_count || 0), 0)}
          </div>
          <div className="text-[11px] font-mono text-slate-500">Live operational opportunities</div>
        </div>

        {/* Identified Bottlenecks */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Stage Gate Bottlenecks</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300">
            {bottlenecks.length}
          </div>
          <div className="text-[11px] font-mono text-slate-500">Stages exceeding target dwell SLA</div>
        </div>

        {/* Overdue Count */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-mono uppercase tracking-wider">Overdue Stages</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            {slaCompliance.overdue_count}
          </div>
          <div className="text-[11px] font-mono text-slate-500">Immediate follow-up required</div>
        </div>
      </div>

      {/* Main Grid: Distribution & Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Gate Distribution */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Active Opportunities by Stage Gate
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Headcount & Volume</span>
          </div>

          <div className="space-y-3">
            {stageDistribution.map((item: any) => (
              <div key={item.stage_code} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300">{item.stage_name}</span>
                  <span className="text-cyan-400 font-bold">{item.opportunity_count} deals</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        ((item.opportunity_count || 0) /
                          Math.max(
                            ...stageDistribution.map((s: any) => s.opportunity_count || 1)
                          )) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Velocity / Cycle Times (Dwell in Days) */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Average Stage Cycle Time (Days)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">Dwell Duration</span>
          </div>

          <div className="space-y-3">
            {averageDurations.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-500">
                Awaiting more transition cycles to compute duration averages.
              </div>
            ) : (
              averageDurations.map((item: any) => (
                <div key={item.stage_code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">{item.stage_name}</span>
                    <span className="text-indigo-400 font-bold">
                      {Math.round(item.avg_duration_days || 0)} days
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(((item.avg_duration_days || 0) / 30) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
