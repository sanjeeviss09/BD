import {
  Clock,
  CheckSquare,
  X,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';

export default function MeetingEndModal() {
  const {
    meetingEndPrompt,
    dismissMeetingEndPrompt,
    deferMeetingEndPrompt,
    openReviewAndTasks,
  } = useNotifications();

  if (!meetingEndPrompt) return null;

  const handleReviewAndTasks = () => {
    openReviewAndTasks(meetingEndPrompt.meetingId);
  };

  const handleRemindLater = () => {
    deferMeetingEndPrompt(10); // 10 minutes deferral
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold text-amber-600 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                SCHEDULED END TIME
              </span>
              <h2 className="text-base font-bold text-foreground mt-0.5 tracking-tight">
                Meeting time has ended.
              </h2>
            </div>
          </div>

          <button
            onClick={dismissMeetingEndPrompt}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Dismiss prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {meetingEndPrompt.title}
            </h3>
            <div className="text-xs text-muted-foreground">
              Scheduled End: <span className="font-mono text-foreground">{meetingEndPrompt.endTime}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/20 border border-border space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Captured Meeting Notes:</span>
              <span className="font-mono font-semibold text-foreground">
                {meetingEndPrompt.notesCount} Note Items
              </span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Would you like to review your captured discussion points, confirm key decisions, and convert action items into assigned BDIQ tasks?
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>If the meeting is running late, you can continue taking notes or defer the reminder.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={dismissMeetingEndPrompt}
            className="w-full sm:w-auto px-3 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Dismiss
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRemindLater}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm"
            >
              Remind Me Later (10m)
            </button>

            <button
              type="button"
              onClick={handleReviewAndTasks}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-md"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Review Notes & Add Tasks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
