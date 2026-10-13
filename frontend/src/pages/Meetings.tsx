import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { meetingApi } from '@/services/meeting.api';
import type { Meeting, MeetingDashboardOverview } from '@/types/meeting';
import { MeetingCreateModal } from '@/components/meetings/MeetingCreateModal';
import {
  Calendar,
  Plus,
  Search,
  Building2,
  Settings,
  ChevronRight,
  List,
  CalendarDays,
  AlignLeft
} from 'lucide-react';

export default function Meetings() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<MeetingDashboardOverview | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'agenda'>('list');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'today' | 'upcoming' | 'awaiting_prep' | 'awaiting_closure' | 'overdue_actions'>('all');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = session?.access_token;
      const [ov, meetList] = await Promise.all([
        meetingApi.getDashboardOverview(token),
        meetingApi.listMeetings(token)
      ]);
      setOverview(ov);
      setMeetings(meetList);
    } catch (err) {
      console.error('Failed to load meetings data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    if (searchTerm) {
      const match =
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.meeting_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.customer && m.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.opportunity && m.opportunity.title.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!match) return false;
    }
    if (typeFilter !== 'ALL' && m.meeting_type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

    const todayStr = new Date().toISOString().split('T')[0];
    if (activeFilterTab === 'today') return m.meeting_date === todayStr;
    if (activeFilterTab === 'upcoming') return m.meeting_date > todayStr;
    if (activeFilterTab === 'awaiting_prep') return m.preparation_status === 'PENDING' && m.status === 'SCHEDULED';
    if (activeFilterTab === 'awaiting_closure') return m.status === 'COMPLETED' && m.closure_status !== 'CLOSED';
    if (activeFilterTab === 'overdue_actions') return m.stats && m.stats.pendingActionCount > 0;

    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-primary" />
            Meeting Intelligence & Follow-up Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enterprise lifecycle governance: Schedule → Preparation → Live Mini Notes → Points → Decisions → Tasks → Closure
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/meetings/settings')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors"
          >
            <Settings className="w-4 h-4" /> Configuration Center
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Schedule Meeting
          </button>
        </div>
      </div>

      {/* 2. Key Intelligence Metrics Bar */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div
            onClick={() => setActiveFilterTab('today')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilterTab === 'today'
                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                : 'bg-card border-border hover:border-primary/40'
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Today's Meetings</div>
            <div className="text-2xl font-black mt-1 text-foreground">{overview.summary.todayCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Active schedule</div>
          </div>

          <div
            onClick={() => setActiveFilterTab('upcoming')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilterTab === 'upcoming'
                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                : 'bg-card border-border hover:border-primary/40'
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Upcoming</div>
            <div className="text-2xl font-black mt-1 text-foreground">{overview.summary.upcomingCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Next in pipeline</div>
          </div>

          <div
            onClick={() => setActiveFilterTab('awaiting_prep')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilterTab === 'awaiting_prep'
                ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-sm'
                : 'bg-card border-border hover:border-amber-500/40'
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Awaiting Prep</div>
            <div className="text-2xl font-black mt-1 text-amber-600">{overview.summary.awaitingPreparationCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Workspace unreviewed</div>
          </div>

          <div
            onClick={() => setActiveFilterTab('awaiting_closure')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilterTab === 'awaiting_closure'
                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                : 'bg-card border-border hover:border-primary/40'
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Awaiting Closure</div>
            <div className="text-2xl font-black mt-1 text-foreground">{overview.summary.awaitingClosureCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Minutes unsigned</div>
          </div>

          <div
            onClick={() => setActiveFilterTab('overdue_actions')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilterTab === 'overdue_actions'
                ? 'bg-destructive/10 border-destructive text-destructive shadow-sm'
                : 'bg-card border-border hover:border-destructive/40'
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Overdue Actions</div>
            <div className="text-2xl font-black mt-1 text-destructive">{overview.summary.overdueActionsCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Past due date</div>
          </div>

          <div
            onClick={() => setActiveFilterTab('all')}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              activeFilterTab === 'all'
                ? 'bg-primary/10 border-primary text-primary shadow-sm'
                : 'bg-card border-border hover:border-primary/40'
            }`}
          >
            <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Total Meetings</div>
            <div className="text-2xl font-black mt-1 text-foreground">{overview.summary.totalMeetings}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">All lifecycle stages</div>
          </div>
        </div>
      )}

      {/* 3. Filter Controls & View Switcher */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search & Selectors */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search meetings, code, customer..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
          >
            <option value="ALL">All Meeting Types</option>
            <option value="Customer Meeting">Customer Meeting</option>
            <option value="Internal BD Meeting">Internal BD Meeting</option>
            <option value="R&D Discussion">R&D Discussion</option>
            <option value="Regulatory Discussion">Regulatory Discussion</option>
            <option value="Production Review">Production Review</option>
            <option value="Commercial Discussion">Commercial Discussion</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
          >
            <option value="ALL">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border shrink-0">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
              viewMode === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
              viewMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Calendar
          </button>
          <button
            onClick={() => setViewMode('agenda')}
            className={`px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
              viewMode === 'agenda' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" /> Agenda
          </button>
        </div>
      </div>

      {/* 4. Meetings Data View */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground font-mono text-xs">
          Loading meetings...
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground">No meetings found</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            No meetings matched your current filters. Schedule a new meeting to begin.
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Schedule New Meeting
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="p-4 rounded-xl bg-card border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b border-border text-[11px] font-mono uppercase text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Meeting Title</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Customer / Opportunity</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Actions / Points</th>
                <th className="py-2.5 px-3 text-right">Workbench</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMeetings.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="hover:bg-muted/20 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono font-bold text-primary">{m.meeting_code}</td>
                  <td className="py-3 px-3 font-mono">
                    <div className="text-foreground font-semibold">{m.meeting_date}</div>
                    <div className="text-[10px] text-muted-foreground">{m.meeting_time} ({m.timezone})</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-foreground">{m.title}</div>
                    {m.objective && <div className="text-[11px] text-muted-foreground truncate max-w-xs">{m.objective}</div>}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                      {m.meeting_type}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {m.customer ? (
                      <div className="font-semibold text-foreground">{m.customer.name}</div>
                    ) : (
                      <div className="text-muted-foreground italic">Internal</div>
                    )}
                    {m.opportunity && <div className="text-[10px] text-primary truncate max-w-xs">{m.opportunity.title}</div>}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                        m.status === 'IN_PROGRESS'
                          ? 'bg-amber-500/10 text-amber-500'
                          : m.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <div className="text-foreground">
                      <strong>{m.stats?.pendingActionCount || 0}</strong> pending actions
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.stats?.pointsCount || 0} points | {m.stats?.decisionCount || 0} decisions
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/meetings/${m.id}`);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded bg-muted hover:bg-muted/80 text-foreground border border-border inline-flex items-center gap-1"
                    >
                      Open <ChevronRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card / Agenda view */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMeetings.map((m) => (
            <div
              key={m.id}
              onClick={() => navigate(`/meetings/${m.id}`)}
              className="p-5 rounded-xl bg-card border border-border shadow-sm hover:border-primary/40 cursor-pointer transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-mono font-bold text-primary">{m.meeting_code}</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                    {m.meeting_type}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-foreground leading-snug">{m.title}</h3>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 font-mono">
                  <span>{m.meeting_date}</span>
                  <span>{m.meeting_time}</span>
                </div>

                {m.customer && (
                  <div className="text-xs text-foreground font-semibold mt-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    {m.customer.name}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">
                  {m.stats?.pendingActionCount || 0} open actions
                </span>
                <span className="text-primary font-semibold flex items-center gap-1">
                  Workbench <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <MeetingCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onMeetingCreated={(newMeet) => {
          loadData();
          navigate(`/meetings/${newMeet.id}`);
        }}
      />
    </div>
  );
}
