import React from 'react';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  User,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export interface TimelineEventItem {
  id: string;
  eventType: string;
  title: string;
  description?: string;
  timestamp: string;
  actorName?: string;
  metadata?: Record<string, any>;
}

export const ActivityTimeline: React.FC<{
  events: TimelineEventItem[];
  className?: string;
  maxItems?: number;
}> = ({ events, className = '', maxItems = 10 }) => {
  const displayEvents = events.slice(0, maxItems);

  const getEventIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'STAGE_CHANGED':
        return <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />;
      case 'QUALIFICATION_COMPLETED':
        return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'TASK_COMPLETED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'TASK_DELAYED':
      case 'RISK_ADDED':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'DOCUMENT_UPLOADED':
        return <FileText className="w-3.5 h-3.5 text-sky-400" />;
      case 'ASSIGNMENT_CHANGED':
        return <User className="w-3.5 h-3.5 text-violet-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className={`p-8 text-center text-xs text-slate-500 font-mono rounded-lg border border-slate-800 bg-slate-900/40 ${className}`}>
        No recent intelligence activity recorded in this audit timeline.
      </div>
    );
  }

  return (
    <div className={`relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800 ${className}`}>
      {displayEvents.map((evt) => (
        <div key={evt.id} className="relative group">
          {/* Timeline Node Dot */}
          <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow-md group-hover:border-cyan-500 transition">
            {getEventIcon(evt.eventType)}
          </div>

          {/* Content Card */}
          <div className="bg-slate-900/60 light:bg-slate-50 border border-slate-800/80 light:border-slate-200 rounded-lg p-3 hover:border-slate-700 transition">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200 light:text-slate-800">
                {evt.title}
              </span>
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                <Calendar className="w-3 h-3" />
                {evt.timestamp}
              </span>
            </div>

            {evt.description && (
              <p className="text-xs text-slate-400 light:text-slate-600 mt-1 line-clamp-2">
                {evt.description}
              </p>
            )}

            {evt.actorName && (
              <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
                <span>Recorded by: {evt.actorName}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
