import { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckSquare,
  AlertCircle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface MeetingReviewAndTasksModalProps {
  meetingId: string;
  onClose: () => void;
  onTasksCreated?: () => void;
}

export default function MeetingReviewAndTasksModal({
  meetingId,
  onClose,
  onTasksCreated,
}: MeetingReviewAndTasksModalProps) {
  const { session } = useAuth();

  const [meeting, setMeeting] = useState<any>(null);
  const [points, setPoints] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Task creation form state
  const [selectedPointId, setSelectedPointId] = useState<string>('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [createdTasksList, setCreatedTasksList] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const getHeaders = useCallback(() => {
    const token = session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [session]);

  // Load meeting points, decisions, departments, and users
  useEffect(() => {
    const loadData = async () => {
      try {
        const headers = getHeaders();
        const [meetRes, pointsRes, decRes, deptRes, usersRes] = await Promise.all([
          fetch(`http://localhost:4000/api/meetings/${meetingId}`, { headers }),
          fetch(`http://localhost:4000/api/meetings/${meetingId}/points`, { headers }),
          fetch(`http://localhost:4000/api/meetings/${meetingId}/decisions`, { headers }),
          fetch('http://localhost:4000/api/departments', { headers }),
          fetch('http://localhost:4000/api/users', { headers }),
        ]);

        if (meetRes.ok) setMeeting(await meetRes.json());
        if (pointsRes.ok) {
          const ptData = await pointsRes.json();
          setPoints(ptData || []);
          if (ptData && ptData.length > 0) {
            setSelectedPointId(ptData[0].id);
            setTaskTitle(ptData[0].title);
          }
        }
        if (decRes.ok) setDecisions(await decRes.json());
        if (deptRes.ok) {
          const dData = await deptRes.json();
          setDepartments(dData.departments || dData || []);
        }
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsers(uData.users || uData || []);
        }
      } catch (err) {
        console.error('Failed to load review workspace:', err);
      }
    };

    loadData();
  }, [meetingId, getHeaders]);

  const handleSelectPointToConvert = (point: any) => {
    setSelectedPointId(point.id);
    setTaskTitle(point.title);
    setTaskDescription(point.description || point.discussion_notes || '');
    if (point.responsible_department_id) setDepartmentId(point.responsible_department_id);
    if (point.responsible_user_id) setAssignedUserId(point.responsible_user_id);
    if (point.due_date) setDueDate(point.due_date);
    if (point.priority) setPriority(point.priority);
  };

  // Convert Point into Canonical BDIQ Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setErrorMsg('Task title is required');
      return;
    }

    setIsSubmittingTask(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let endpoint = `http://localhost:4000/api/tasks`;
      let payload: any = {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        department_id: departmentId || undefined,
        assigned_to: assignedUserId || undefined,
        current_due_date: dueDate || undefined,
        priority,
        meeting_id: meetingId,
        source_type: 'MEETING',
      };

      // If tied to a specific point, use the meeting point conversion endpoint to link them
      if (selectedPointId) {
        endpoint = `http://localhost:4000/api/meetings/points/${selectedPointId}/create-task`;
        payload = {
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          department_id: departmentId || undefined,
          assigned_user_id: assignedUserId || undefined,
          due_date: dueDate || undefined,
          priority,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || 'Failed to create task');
      }

      const created = await res.json();
      setCreatedTasksList(prev => [created, ...prev]);
      setSuccessMsg(`Task "${created.title || taskTitle}" successfully created in BDIQ Task Management!`);

      // Mark the point as converted in local list
      setPoints(prev =>
        prev.map(p => (p.id === selectedPointId ? { ...p, linked_task_id: created.id, status: 'ACTION_REQUIRED' } : p))
      );

      // Reset form
      setTaskTitle('');
      setTaskDescription('');
      setSelectedPointId('');

      if (onTasksCreated) onTasksCreated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while creating task');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">
                {meeting?.title ? `${meeting.title} — Review & Tasks` : 'Post-Meeting Review & Task Creation Workspace'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Review captured discussion points and convert meeting action items into canonical BDIQ tasks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body (Split 2 Columns) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Left Column: Meeting Points & Decisions Overview */}
          <div className="w-full lg:w-1/2 p-5 overflow-y-auto space-y-5 bg-muted/10">
            {/* Captured Decisions */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Agreed Meeting Decisions ({decisions.length})
              </div>

              {decisions.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground rounded-lg bg-card border border-border">
                  No formal decisions recorded for this meeting.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {decisions.map(d => (
                    <div
                      key={d.id}
                      className="p-3 rounded-lg bg-card border border-border text-xs text-foreground space-y-1 shadow-sm"
                    >
                      <div className="font-semibold">{d.decision_text}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        Status: <span className="text-emerald-600 font-semibold">{d.decision_status || 'AGREED'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meeting Action Points Table */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Meeting Action Points ({points.length})</span>
                <span className="text-[10px] text-muted-foreground">Select to convert to task</span>
              </div>

              {points.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground rounded-lg bg-card border border-border">
                  No structured action points recorded yet. You can create a new task directly on the right.
                </div>
              ) : (
                <div className="space-y-2">
                  {points.map(p => {
                    const isSelected = selectedPointId === p.id;
                    const isConverted = !!p.linked_task_id;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPointToConvert(p)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all shadow-sm ${
                          isSelected
                            ? 'bg-foreground text-background border-foreground font-medium'
                            : 'bg-card text-foreground border-border hover:border-foreground/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold">
                            {p.point_code}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isConverted && (
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                                  isSelected ? 'bg-background text-foreground' : 'bg-emerald-500/10 text-emerald-600'
                                }`}
                              >
                                TASK CREATED
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-mono px-1 rounded uppercase ${
                                isSelected ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {p.category}
                            </span>
                          </div>
                        </div>

                        <p className="mt-1 line-clamp-2">{p.title}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Task Creation Form */}
          <div className="w-full lg:w-1/2 p-5 overflow-y-auto space-y-4 bg-card">
            <div className="pb-2 border-b border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Convert to Canonical BDIQ Task
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tasks created here are tracked in Task Management with SLA monitoring and overdue alerts.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="e.g. Deliver batch analytical validation report"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Detailed Description & Commitments
                </label>
                <textarea
                  rows={2}
                  value={taskDescription}
                  onChange={e => setTaskDescription(e.target.value)}
                  placeholder="Additional context, action requirements, or client commitments..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Responsible Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={e => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Assigned Person
                  </label>
                  <select
                    value={assignedUserId}
                    onChange={e => setAssignedUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                  >
                    <option value="">-- Select Assignee --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name || ''} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingTask || !taskTitle.trim()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-md disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingTask ? 'Creating Task...' : 'Confirm & Create Task'}</span>
                </button>
              </div>
            </form>

            {/* Created Tasks in this Session */}
            {createdTasksList.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <div className="text-[11px] font-semibold text-foreground">
                  Tasks Created in this Session ({createdTasksList.length}):
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {createdTasksList.map((t, idx) => (
                    <div
                      key={t.id || idx}
                      className="p-2 rounded bg-muted/30 border border-border text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-foreground truncate">{t.title}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                        {t.task_code || 'TASK'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Tasks are permanently assigned and monitored in Task Management.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-card border border-border hover:bg-muted transition-colors shadow-sm"
          >
            Done / Close Review
          </button>
        </div>
      </div>
    </div>
  );
}
