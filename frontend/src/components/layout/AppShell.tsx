import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission, RequirePermission } from '@/contexts/PermissionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import NotificationCenterDropdown from '@/components/notifications/NotificationCenterDropdown';
import NotificationToastContainer from '@/components/notifications/NotificationToastContainer';
import MeetingStartModal from '@/components/notifications/MeetingStartModal';
import MeetingEndModal from '@/components/notifications/MeetingEndModal';
import LiveMeetingNotesWorkspaceModal from '@/components/meetings/LiveMeetingNotesWorkspaceModal';
import MeetingReviewAndTasksModal from '@/components/meetings/MeetingReviewAndTasksModal';
import { useNotifications } from '@/contexts/NotificationContext';
import {
  LayoutDashboard,
  TrendingUp,
  CheckSquare,
  Pill,
  Globe,
  Users,
  Shield,
  Sliders,
  Search,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
  Building2,
  GitFork,
  FileSpreadsheet,
  FileCheck2,
  Factory,
  Scale,
  Lightbulb,
  FileText,
  UserCheck,
  CalendarDays
} from 'lucide-react';

export default function AppShell() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { loading: permLoading, profile } = usePermission();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const {
    activeMeetingNotesId,
    closeLiveNotes,
    openReviewAndTasks,
    activeReviewMeetingId,
    closeReviewAndTasks,
  } = useNotifications();

  // Global Ctrl/Cmd + K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (authLoading || permLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-foreground/20 animate-ping" />
          <div className="w-10 h-10 rounded-full border-2 border-t-foreground border-r-transparent border-b-foreground border-l-transparent animate-spin" />
        </div>
        <p className="mt-4 text-xs font-mono tracking-widest text-muted-foreground uppercase">
          Initializing BDIQ Secure Session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isActive = (path: string) => {
    if (path === '/dashboard' && (location.pathname === '/' || location.pathname === '/dashboard')) return true;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans antialiased selection:bg-muted selection:text-foreground">
      {/* Global Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* Enterprise Left Sidebar */}
      <aside
        className={`relative z-30 flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-border">
          <Link to="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-foreground p-[1px] shrink-0 flex items-center justify-center">
              <div className="w-full h-full bg-background rounded-[7px] flex items-center justify-center">
                <span className="font-mono font-black text-foreground text-sm">
                  BD
                </span>
              </div>
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
                  BDIQ <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">OS</span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase truncate">
                  Pharma Intelligence
                </span>
              </div>
            )}
          </Link>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Organization / Workspace Badge */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3 mx-3 my-2 rounded-lg bg-muted/50 border border-border flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="truncate">
              <div className="text-xs font-semibold text-foreground truncate">
                {profile?.organization_name || 'Global Enterprise Pharma'}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">BD Intelligence Unit</div>
            </div>
          </div>
        )}

        {/* Main Navigation Items */}
        <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
          {/* Group 1: COMMAND CENTER */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Command Center
              </div>
            )}
            <div className="space-y-1">
              <Link
                to="/dashboard"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Dashboard"
              >
                <LayoutDashboard className={`w-4 h-4 shrink-0 ${isActive('/dashboard') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Dashboard</span>}
              </Link>
            </div>
          </div>

          {/* Group 2: PRODUCT INTELLIGENCE */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Product Intelligence
              </div>
            )}
            <div className="space-y-1">
              <RequirePermission permission="products.read">
                <Link
                  to="/products"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/products')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                  title="Product Master"
                >
                  <Pill className={`w-4 h-4 shrink-0 ${isActive('/products') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Product Master</span>}
                </Link>
              </RequirePermission>

              <Link
                to="/market-intelligence"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/market-intelligence')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Market Intelligence"
              >
                <Globe className={`w-4 h-4 shrink-0 ${isActive('/market-intelligence') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Market Intelligence</span>}
              </Link>
              
              <Link
                to="/customer-intelligence"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/customer-intelligence')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Customer Intelligence"
              >
                <Users className={`w-4 h-4 shrink-0 ${isActive('/customer-intelligence') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Customer Intelligence</span>}
              </Link>
              <Link
                to="/regulatory-intelligence"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/regulatory-intelligence')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Regulatory Intelligence"
              >
                <FileText className={`w-4 h-4 shrink-0 ${isActive('/regulatory-intelligence') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Regulatory Intelligence</span>}
              </Link>
            </div>
          </div>

          {/* Group 3: EVALUATION */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Evaluation
              </div>
            )}
            <div className="space-y-1">
              <RequirePermission permission="tasks.read">
                <Link
                  to="/tasks"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/tasks')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Department Follow-ups"
                >
                  <CheckSquare className={`w-4 h-4 shrink-0 ${isActive('/tasks') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Department Follow-ups</span>}
                </Link>
              </RequirePermission>

              <Link
                to="/meetings"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/meetings')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Meeting Intelligence"
              >
                <CalendarDays className={`w-4 h-4 shrink-0 ${isActive('/meetings') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Meeting Intelligence</span>}
              </Link>

              <Link
                to="/technical-evaluation"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/technical-evaluation')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Technical Evaluation"
              >
                <FileCheck2 className={`w-4 h-4 shrink-0 ${isActive('/technical-evaluation') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Technical Evaluation</span>}
              </Link>

              <Link
                to="/production-feasibility"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/production-feasibility')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Production Feasibility"
              >
                <Factory className={`w-4 h-4 shrink-0 ${isActive('/production-feasibility') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Production Feasibility</span>}
              </Link>
            </div>
          </div>

          {/* Group 4: COMMERCIAL */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Commercial
              </div>
            )}
            <div className="space-y-1">
              <Link
                to="/rfqs"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/rfqs')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="RFQ"
              >
                <FileSpreadsheet className={`w-4 h-4 shrink-0 ${isActive('/rfqs') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>RFQ</span>}
              </Link>

              <Link
                to="/commercial-evaluation"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/commercial-evaluation')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Commercial Evaluation"
              >
                <Scale className={`w-4 h-4 shrink-0 ${isActive('/commercial-evaluation') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Commercial Evaluation</span>}
              </Link>
            </div>
          </div>

          {/* Group 5: DECISION INTELLIGENCE */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Decision Intelligence
              </div>
            )}
            <div className="space-y-1">
              <RequirePermission permission="opportunities.read">
                <Link
                  to="/opportunities"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/opportunities')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Opportunities"
                >
                  <TrendingUp className={`w-4 h-4 shrink-0 ${isActive('/opportunities') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Opportunities</span>}
                </Link>
              </RequirePermission>

              <RequirePermission permission="opportunities.analytics">
                <Link
                  to="/executive-intelligence"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/executive-intelligence')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Executive Intelligence"
                >
                  <Lightbulb className={`w-4 h-4 shrink-0 ${isActive('/executive-intelligence') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Executive Intelligence</span>}
                </Link>
              </RequirePermission>
            </div>
          </div>

          {/* Group 4: Administration & Governance */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Governance & Admin
              </div>
            )}
            <div className="space-y-1">
              <Link
                to="/departments"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive('/departments') || isActive('/organization/directory')
                    ? 'bg-muted text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title="Departments & Staff Master Directory"
              >
                <Building2 className={`w-4 h-4 shrink-0 ${isActive('/departments') || isActive('/organization/directory') ? 'text-foreground' : 'text-muted-foreground'}`} />
                {!sidebarCollapsed && <span>Departments & Staff</span>}
              </Link>

              <RequirePermission permission="users.read">
                <Link
                  to="/users"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/users')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="User Directory"
                >
                  <Users className={`w-4 h-4 shrink-0 ${isActive('/users') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Users & Roles</span>}
                </Link>
              </RequirePermission>

              <RequirePermission permission="roles.read">
                <Link
                  to="/roles"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/roles')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="RBAC Roles"
                >
                  <Shield className={`w-4 h-4 shrink-0 ${isActive('/roles') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Roles & Security</span>}
                </Link>
              </RequirePermission>

              <RequirePermission permission="configuration.read">
                <Link
                  to="/configuration"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    location.pathname === '/configuration'
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Platform Configuration"
                >
                  <Sliders className={`w-4 h-4 shrink-0 ${location.pathname === '/configuration' ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Configuration</span>}
                </Link>
              </RequirePermission>

              <RequirePermission permission="configuration.read">
                <Link
                  to="/configuration/responsibility"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/configuration/responsibility') || isActive('/settings/responsibility')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Update Responsibility Rules"
                >
                  <UserCheck className={`w-4 h-4 shrink-0 ${isActive('/configuration/responsibility') || isActive('/settings/responsibility') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Update Responsibility</span>}
                </Link>
              </RequirePermission>

              <RequirePermission permission="configuration.read">
                <Link
                  to="/meetings/settings"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/meetings/settings') || isActive('/configuration/meetings')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Meeting & Follow-up Configuration"
                >
                  <CalendarDays className={`w-4 h-4 shrink-0 ${isActive('/meetings/settings') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Meeting Settings</span>}
                </Link>
              </RequirePermission>

              <RequirePermission permission="workflow.read">
                <Link
                  to="/workflows/admin"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive('/workflows')
                      ? 'bg-muted text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Workflow Engine Administration"
                >
                  <GitFork className={`w-4 h-4 shrink-0 ${isActive('/workflows') ? 'text-foreground' : 'text-muted-foreground'}`} />
                  {!sidebarCollapsed && <span>Workflow Engine</span>}
                </Link>
              </RequirePermission>
            </div>
          </div>
        </nav>

        {/* User Mini Profile at bottom */}
        <div className="p-3 border-t border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-mono font-bold text-foreground shrink-0">
                {user.email ? user.email.substring(0, 2).toUpperCase() : 'BD'}
              </div>
              {!sidebarCollapsed && (
                <div className="truncate">
                  <div className="text-xs font-semibold text-foreground truncate">{user.email}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Authenticated</div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                onClick={signOut}
                title="Sign out of BDIQ"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Command Center Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {/* Top Command Bar */}
        <header className="h-16 px-6 border-b border-border bg-card flex items-center justify-between z-20 shrink-0">
          {/* Search Trigger */}
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full max-w-md flex items-center justify-between px-3.5 py-2 rounded-lg border border-border bg-muted/30 text-muted-foreground text-xs hover:border-muted-foreground/50 hover:text-foreground transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span>Search opportunities, products, tasks, or commands...</span>
              </div>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted border border-border text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Quick Create Action Menu */}
            <div className="relative">
              <button
                onClick={() => setQuickCreateOpen(!quickCreateOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground hover:bg-foreground/90 text-background text-xs font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Quick Create</span>
              </button>

              {quickCreateOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <Link
                    to="/products?action=new"
                    onClick={() => setQuickCreateOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <Pill className="w-4 h-4 text-muted-foreground" />
                    <span>New Product</span>
                  </Link>
                  <Link
                    to="/market-intelligence?action=new"
                    onClick={() => setQuickCreateOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span>New Market Analysis</span>
                  </Link>
                  <Link
                    to="/tasks?action=new"
                    onClick={() => setQuickCreateOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 text-muted-foreground" />
                    <span>New Follow-up Task</span>
                  </Link>
                  <Link
                    to="/rfqs?action=new"
                    onClick={() => setQuickCreateOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                    <span>New RFQ</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Notification Center */}
            <NotificationCenterDropdown />

            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center text-xs font-mono font-bold text-background">
                  {user.email ? user.email.substring(0, 2).toUpperCase() : 'BD'}
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="pb-3 mb-2 border-b border-border">
                    <div className="text-xs font-semibold text-foreground truncate">{user.email}</div>
                    <div className="text-[11px] font-mono text-muted-foreground mt-0.5">Role: BD Executive</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Tenant ID: {profile?.organization_id || 'System'}</div>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition-colors text-left font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out of Platform</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Route Workspace Body */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Outlet />
        </main>

        {/* Global Notifications, Toasts, & Meeting Prompts */}
        <NotificationToastContainer />
        <MeetingStartModal />
        <MeetingEndModal />
        {activeMeetingNotesId && (
          <LiveMeetingNotesWorkspaceModal
            meetingId={activeMeetingNotesId}
            onClose={closeLiveNotes}
            onOpenReviewTasks={() => openReviewAndTasks(activeMeetingNotesId)}
          />
        )}
        {activeReviewMeetingId && (
          <MeetingReviewAndTasksModal
            meetingId={activeReviewMeetingId}
            onClose={closeReviewAndTasks}
          />
        )}
      </div>
    </div>
  );
}
