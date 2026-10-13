import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, CheckSquare, X, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';

export default function NotificationToastContainer() {
  const { activeToasts, removeToast } = useNotifications();
  const navigate = useNavigate();

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {activeToasts.map(toast => {
        const isCritical = toast.priority === 'CRITICAL';
        const isHigh = toast.priority === 'HIGH';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl transition-all duration-300 animate-in slide-in-from-bottom-3 flex items-start gap-3 bg-card ${
              isCritical
                ? 'border-red-500/40 text-foreground bg-red-500/5'
                : isHigh
                ? 'border-amber-500/40 text-foreground bg-amber-500/5'
                : 'border-border text-foreground'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.category === 'MEETING' ? (
                <Calendar className="w-4 h-4 text-blue-500" />
              ) : toast.category === 'TASK' || toast.category === 'OVERDUE' ? (
                <CheckSquare className="w-4 h-4 text-amber-500" />
              ) : (
                <AlertTriangle className={`w-4 h-4 ${isCritical ? 'text-red-600' : 'text-amber-500'}`} />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-foreground tracking-tight">
                  {toast.title}
                </span>
                <span
                  className={`text-[9px] font-mono px-1 rounded uppercase font-semibold ${
                    isCritical
                      ? 'bg-red-500/10 text-red-600'
                      : isHigh
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {toast.priority}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                {toast.message}
              </p>

              {toast.actionUrl && (
                <button
                  onClick={() => {
                    removeToast(toast.id);
                    navigate(toast.actionUrl!);
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:underline"
                >
                  <span>{toast.actionLabel || 'View Record'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
              title="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
