import {
  Calendar,
  ExternalLink,
  Edit3,
  X,
  Clock,
  ArrowRight,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';

export default function MeetingStartModal() {
  const { meetingStartPrompt, dismissMeetingStartPrompt, openLiveNotes } = useNotifications();

  if (!meetingStartPrompt) return null;

  const handleOpenTeams = () => {
    if (meetingStartPrompt.externalLink) {
      window.open(meetingStartPrompt.externalLink, '_blank', 'noopener,noreferrer');
    } else {
      alert('No external meeting URL was provided for this meeting. You can add one in Meeting Details.');
    }
  };

  const handleStartNotes = () => {
    openLiveNotes(meetingStartPrompt.meetingId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header Banner */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-red-600 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                  LIVE NOW
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Scheduled Start Time
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground mt-0.5 tracking-tight">
                Your meeting has started.
              </h2>
            </div>
          </div>

          <button
            onClick={dismissMeetingStartPrompt}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Dismiss prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Meeting Details Card */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {meetingStartPrompt.title}
            </h3>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {meetingStartPrompt.scheduledTime}
              </span>
            </div>

            {meetingStartPrompt.objective && (
              <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t border-border">
                <span className="font-medium text-foreground">Objective:</span> {meetingStartPrompt.objective}
              </p>
            )}
          </div>

          {/* Previous Meeting Context & Carried Forward Points */}
          {meetingStartPrompt.previousMeeting && (
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-1.5">
              <div className="text-[11px] font-semibold text-blue-600 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Carried-Forward Context from {meetingStartPrompt.previousMeeting.title}
              </div>
              {meetingStartPrompt.previousMeeting.closure_summary && (
                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                  "{meetingStartPrompt.previousMeeting.closure_summary}"
                </p>
              )}
            </div>
          )}

          {/* Open Points Snapshot */}
          {meetingStartPrompt.openPoints && meetingStartPrompt.openPoints.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Outstanding Action Points to Address:</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {meetingStartPrompt.openPoints.length} Open Points
                </span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {meetingStartPrompt.openPoints.map(p => (
                  <div
                    key={p.id}
                    className="p-2 rounded bg-muted/20 border border-border text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckSquare className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">{p.title}</span>
                    </div>
                    <span className="text-[9px] font-mono px-1 rounded bg-muted text-muted-foreground shrink-0">
                      {p.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={dismissMeetingStartPrompt}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Dismiss
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {meetingStartPrompt.externalLink && (
              <button
                type="button"
                onClick={handleOpenTeams}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Open Teams / Call</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartNotes}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-md"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Start Notes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
