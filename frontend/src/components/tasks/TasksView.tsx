import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TasksViewProps {
  defaultSourceType?: string;
  defaultSourceId?: string;
}

export default function TasksView({ defaultSourceType, defaultSourceId }: TasksViewProps) {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTasks() {
      try {
        setLoading(true);
        let url = '/api/tasks';
        const params = new URLSearchParams();
        if (defaultSourceType) params.append('source_type', defaultSourceType);
        if (defaultSourceId) params.append('source_id', defaultSourceId);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session?.access_token || localStorage.getItem('token')}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setTasks(Array.isArray(data) ? data : data.data || []);
        }
      } catch (err) {
        console.error('Failed to load tasks', err);
      } finally {
        setLoading(false);
      }
    }
    loadTasks();
  }, [defaultSourceType, defaultSourceId, session]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
        Loading associated operational tasks...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Operational Follow-up Tasks ({tasks.length})
          </span>
        </div>
        <Link
          to={`/tasks?action=new${defaultSourceType ? `&source_type=${defaultSourceType}` : ''}${defaultSourceId ? `&source_id=${defaultSourceId}` : ''}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="p-8 border border-border border-dashed rounded-lg text-center bg-muted/20">
          <p className="text-xs text-muted-foreground">No tasks currently attached to this record.</p>
        </div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-lg bg-card overflow-hidden">
          {tasks.map((task) => (
            <div key={task.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
              <div className="space-y-1">
                <Link to={`/tasks/${task.id}`} className="font-semibold text-foreground hover:underline">
                  {task.title}
                </Link>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                  <span>Type: {task.task_type}</span>
                  {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
                  {task.assigned_department && <span>Dept: {task.assigned_department}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  task.priority === 'HIGH' || task.priority === 'CRITICAL'
                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-muted text-muted-foreground border-border'
                }`}>
                  {task.priority}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  task.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
