import React from 'react';
import { Clock, CheckCircle2, User, ArrowRight, FileText } from 'lucide-react';

export interface WorkflowStageHistoryItem {
  id: string;
  from_stage_code?: string;
  to_stage_code: string;
  transition_name?: string;
  transitioned_by_name?: string;
  transitioned_at: string;
  duration_in_stage_seconds?: number;
  duration_in_stage_formatted?: string;
  comment?: string;
  sla_status_at_transition?: string;
}

interface WorkflowTimelineProps {
  history: WorkflowStageHistoryItem[];
  className?: string;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ history, className = '' }) => {
  if (!history || history.length === 0) {
    return (
      <div className={`p-8 text-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-500 text-xs font-mono ${className}`}>
        <Clock className="w-6 h-6 mx-auto mb-2 text-slate-600" />
        No historical stage transitions recorded yet. Opportunity is in initial stage.
      </div>
    );
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Immediate (<1h)';
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1 border-b border-slate-800 pb-2">
        <span className="font-bold text-slate-200 uppercase tracking-wider">
          Immutable Operational Stage History ({history.length} Events)
        </span>
        <span className="text-[11px] text-slate-500">Append-Only Audit Trail</span>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-800">
        {history.map((item, idx) => {
          const isLatest = idx === 0;

          return (
            <div key={item.id || idx} className="relative group">
              {/* Timeline Node Point */}
              <div
                className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] transition ${
                  isLatest
                    ? 'border-cyan-400 bg-cyan-950 text-cyan-300 ring-4 ring-cyan-500/10'
                    : 'border-emerald-500/80 bg-emerald-950/60 text-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
              </div>

              {/* Event Card */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 group-hover:border-slate-700 transition space-y-2.5 shadow-lg">
                {/* Stage Progression & Time */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.from_stage_code && (
                      <>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {item.from_stage_code.replace(/_/g, ' ')}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                      </>
                    )}
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {item.to_stage_code.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(item.transitioned_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Transition Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>{item.transitioned_by_name || 'Workflow System'}</span>
                  </div>

                  {item.duration_in_stage_seconds !== undefined && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                      <span>Dwell Duration:</span>
                      <span className="text-slate-300 font-semibold">
                        {formatDuration(item.duration_in_stage_seconds)}
                      </span>
                    </div>
                  )}

                  {item.sla_status_at_transition && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        item.sla_status_at_transition === 'OVERDUE'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      SLA: {item.sla_status_at_transition}
                    </span>
                  )}
                </div>

                {/* Comment / Justification */}
                {item.comment && (
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span className="italic leading-relaxed">{item.comment}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
