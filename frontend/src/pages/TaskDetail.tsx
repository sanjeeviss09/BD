import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import { getApiBaseUrl, authHeaders } from '@/lib/api';
import { 
  Activity, 
  Clock, 
  MessageSquare, 
  ArrowLeft, 
  AlertTriangle, 
  CalendarClock, 
  Send,
  X
} from 'lucide-react';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { hasPermission } = usePermission();
  const navigate = useNavigate();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal controls
  const [showNoUpdateModal, setShowNoUpdateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  // Form states
  const [nextDate, setNextDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [contactedPerson, setContactedPerson] = useState('');
  const [receivedSummary, setReceivedSummary] = useState('');
  const [pendingItems, setPendingItems] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [commentText, setCommentText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTask = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/tasks/${id}`, {
        headers: authHeaders(session?.access_token),
      });
      if (response.ok) {
        setTask(await response.json());
      } else {
        navigate('/tasks');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTask();
  }, [id, session]);

  const handleRecordNoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/tasks/${id}/no-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(session?.access_token),
        },
        body: JSON.stringify({
          next_followup_date: nextDate,
          remarks,
          contacted_person: contactedPerson,
        }),
      });
      if (response.ok) {
        setShowNoUpdateModal(false);
        setNextDate('');
        setRemarks('');
        setContactedPerson('');
        fetchTask();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/tasks/${id}/update-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(session?.access_token),
        },
        body: JSON.stringify({
          response_summary: remarks,
          complete_task: true,
          contacted_person: contactedPerson,
        }),
      });
      if (response.ok) {
        setShowUpdateModal(false);
        setRemarks('');
        setContactedPerson('');
        fetchTask();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPartialUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/tasks/${id}/partial-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(session?.access_token),
        },
        body: JSON.stringify({
          received_summary: receivedSummary,
          pending_items: pendingItems,
          next_followup_date: nextDate,
          contacted_person: contactedPerson,
        }),
      });
      if (response.ok) {
        setShowPartialModal(false);
        setReceivedSummary('');
        setPendingItems('');
        setNextDate('');
        setContactedPerson('');
        fetchTask();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/tasks/${id}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(session?.access_token),
        },
        body: JSON.stringify({
          new_date: rescheduleDate,
          reason: rescheduleReason,
        }),
      });
      if (response.ok) {
        setShowRescheduleModal(false);
        setRescheduleDate('');
        setRescheduleReason('');
        fetchTask();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const response = await fetch(`${getApiBaseUrl()}/tasks/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(session?.access_token),
        },
        body: JSON.stringify({ comment: commentText }),
      });
      if (response.ok) {
        setCommentText('');
        fetchTask();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading task details...</div>;
  if (!task) return <div className="p-8 text-center text-gray-500">Task not found</div>;

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center text-xs font-medium text-muted-foreground hover:text-foreground mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Tasks
        </button>

        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-xs bg-muted text-foreground border border-border px-2.5 py-1 rounded font-bold">
                {task.task_code}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{task.title}</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Created by {task.creator?.full_name || 'System'} on{' '}
              {new Date(task.created_at).toLocaleDateString()} | Priority: {task.priority}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {hasPermission('tasks.followup') && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
              <>
                <button
                  onClick={() => setShowNoUpdateModal(true)}
                  className="px-3.5 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 font-medium text-xs shadow-xs transition-colors"
                >
                  No Update
                </button>
                <button
                  onClick={() => setShowPartialModal(true)}
                  className="px-3.5 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 font-medium text-xs shadow-xs transition-colors"
                >
                  Partial Update
                </button>
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="px-3.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 font-medium text-xs shadow-xs transition-colors"
                >
                  Complete Task
                </button>
              </>
            )}
            {hasPermission('tasks.reschedule') && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
              <button
                onClick={() => setShowRescheduleModal(true)}
                className="px-3.5 py-2 bg-card text-foreground border border-border rounded-lg hover:bg-muted font-medium text-xs shadow-xs transition-colors"
              >
                Reschedule
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Core Overview & Follow-up History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <div className="bg-card shadow-xs border border-border rounded-xl p-6 text-foreground">
            <h2 className="text-base font-bold text-foreground mb-3">Task Overview & Requirements</h2>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {task.description || 'No description provided.'}
            </p>
          </div>

          {/* Chronological Follow-up History */}
          <div className="bg-card shadow-xs border border-border rounded-xl p-6 text-foreground">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center">
                <Activity className="w-5 h-5 mr-2 text-primary" />
                Follow-up History ({task.followups?.length || 0})
              </h2>
            </div>

            <div className="space-y-4">
              {task.followups && task.followups.length > 0 ? (
                task.followups.map((f: any) => (
                  <div
                    key={f.id}
                    className={`border-l-4 pl-4 py-3 rounded-r-lg ${
                      f.response_status === 'NO_UPDATE'
                        ? 'border-orange-500 bg-orange-500/10'
                        : f.response_status === 'PARTIAL_UPDATE'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-emerald-500 bg-emerald-500/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Follow-up #{f.followup_number} — {f.response_status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.followup_date).toLocaleDateString()}
                      </span>
                    </div>

                    {f.contacted_person && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Contacted: <span className="font-medium text-foreground">{f.contacted_person}</span>
                      </p>
                    )}

                    {f.remarks && (
                      <p className="text-xs text-foreground mt-2 whitespace-pre-wrap bg-background/80 p-2.5 rounded-lg border border-border">
                        {f.remarks}
                      </p>
                    )}

                    {f.response_summary && (
                      <p className="text-xs text-foreground mt-2 whitespace-pre-wrap bg-background/80 p-2.5 rounded-lg border border-border">
                        {f.response_summary}
                      </p>
                    )}

                    {f.next_followup_date && (
                      <p className="text-xs text-primary font-medium mt-2 flex items-center">
                        <CalendarClock className="w-3.5 h-3.5 mr-1" />
                        Next Follow-up Scheduled: {new Date(f.next_followup_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                  No follow-ups recorded yet. Click "No Update" or "Partial Update" to log an interaction.
                </div>
              )}
            </div>
          </div>

          {/* Comments Thread */}
          <div className="bg-card shadow-xs border border-border rounded-xl p-6 text-foreground">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-primary" /> Comments & Collaboration
            </h2>

            <form onSubmit={handleAddComment} className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="Write an internal remark or note..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 flex items-center transition-colors"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Comment
              </button>
            </form>

            <div className="space-y-3">
              {task.comments && task.comments.length > 0 ? (
                task.comments.map((c: any) => (
                  <div key={c.id} className="p-3 bg-muted/20 rounded-lg border border-border">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                      <span className="font-semibold text-foreground">{c.author?.full_name || 'User'}</span>
                      <span className="text-[11px]">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-foreground">{c.comment}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">No comments added yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Authoritative Dates, Delay Metrics & Timeline */}
        <div className="space-y-6">
          {/* Key Dates & Delay Metrics Panel */}
          <div className="bg-card shadow-xs border border-border rounded-xl p-6 text-foreground">
            <h2 className="text-base font-bold text-foreground mb-4 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-primary" />
              Dates & Delay Metrics
            </h2>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Status</span>
                <div className="mt-1">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                    task.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    task.status === 'WAITING_FOR_UPDATE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Original Commitment</span>
                <p className="text-sm font-mono font-bold text-foreground mt-1">
                  {task.original_due_date ? new Date(task.original_due_date).toLocaleDateString() : '-'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Immutable commitment baseline</p>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Next Expected Follow-up</span>
                <p className="text-sm font-mono font-bold text-primary mt-1">
                  {task.current_due_date ? new Date(task.current_due_date).toLocaleDateString() : '-'}
                </p>
              </div>

              <div className="border-t border-border pt-3">
                <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Original Delay Days</span>
                <p className={`text-2xl font-black mt-1 ${task.metrics?.originalDelayDays > 0 ? 'text-red-400' : 'text-foreground'}`}>
                  {task.metrics?.originalDelayDays || 0} Days
                </p>
                {task.metrics?.isOverdue && (
                  <p className="text-xs text-red-400 font-semibold flex items-center mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Overdue past current follow-up date
                  </p>
                )}
              </div>

              {task.metrics?.responseDelayDays !== null && (
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Response Delay</span>
                  <p className="text-lg font-bold text-emerald-400 mt-1">
                    {task.metrics?.responseDelayDays} Calendar Days
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-3">
                <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Assigned Owner</span>
                <p className="text-sm font-medium text-foreground mt-1">
                  {task.assigned_user?.full_name || 'Unassigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Immutable Timeline Feed */}
          <div className="bg-card shadow-xs border border-border rounded-xl p-6 text-foreground">
            <h2 className="text-base font-bold text-foreground mb-4">Activity Timeline</h2>
            <div className="space-y-4">
              {task.timeline && task.timeline.length > 0 ? (
                task.timeline.map((t: any) => (
                  <div key={t.id} className="relative pl-6 border-l-2 border-border pb-3 last:border-0">
                    <div className="absolute w-2.5 h-2.5 bg-primary rounded-full -left-[6px] top-1"></div>
                    <p className="text-xs font-bold text-foreground">{t.event_type.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(t.created_at).toLocaleString()} by {t.actor?.full_name || 'User'}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No events logged.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* No Update Modal */}
      {showNoUpdateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 text-foreground">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Record No Update</h2>
              <button onClick={() => setShowNoUpdateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-2 mb-4">
              Original commitment date (
              <span className="font-mono font-bold text-foreground">
                {new Date(task.original_due_date).toLocaleDateString()}
              </span>
              ) remains preserved. Active delay is {task.metrics?.originalDelayDays || 0} days.
            </p>

            <form onSubmit={handleRecordNoUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Next Follow-up Date *</label>
                <input
                  type="date"
                  required
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Contacted Person</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Jane Smith"
                  value={contactedPerson}
                  onChange={(e) => setContactedPerson(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Reason for delay or notes on follow-up attempt..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNoUpdateModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Record No Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Partial Update Modal */}
      {showPartialModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 text-foreground">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Record Partial Update</h2>
              <button onClick={() => setShowPartialModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPartialUpdate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">What Information Was Received? *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Received Stability Data Module 3.2..."
                  value={receivedSummary}
                  onChange={(e) => setReceivedSummary(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">What Remains Pending? *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Awaiting Bioequivalence Clinical Summary..."
                  value={pendingItems}
                  onChange={(e) => setPendingItems(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Next Expected Date *</label>
                <input
                  type="date"
                  required
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowPartialModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Partial Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 text-foreground">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Record Complete Resolution</h2>
              <button onClick={() => setShowUpdateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordUpdate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Final Outcome & Resolution Summary *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail the final response or resolution received..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowUpdateModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Complete Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 text-foreground">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Reschedule Expected Date</h2>
              <button onClick={() => setShowRescheduleModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReschedule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">New Expected Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Reason for Rescheduling *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Justification for date adjustment..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
