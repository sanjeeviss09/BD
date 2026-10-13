import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  CheckSquare,
  Pill,
  Globe,
  BarChart3,
  Users,
  Shield,
  Sliders,
  Plus,
  X,
  ArrowRight,
  Factory,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Quick Action' | 'Intelligence';
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    { id: 'nav-dash', title: 'Executive Dashboard', subtitle: 'Global portfolio command center', category: 'Navigation', icon: <LayoutDashboard className="w-4 h-4 text-cyan-400" />, path: '/dashboard' },
    { id: 'nav-opp', title: 'Opportunities Pipeline', subtitle: 'Commercial stage-gate deals', category: 'Navigation', icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, path: '/opportunities' },
    { id: 'nav-tasks', title: 'Operational Tasks', subtitle: 'Work tracking & follow-ups', category: 'Navigation', icon: <CheckSquare className="w-4 h-4 text-sky-400" />, path: '/tasks' },
    { id: 'nav-prod', title: 'Product Master Catalog', subtitle: 'Canonical molecules & presentations', category: 'Navigation', icon: <Pill className="w-4 h-4 text-amber-400" />, path: '/products' },
    { id: 'nav-market', title: 'Market Intelligence Terminal', subtitle: 'Global volumes, sales & competitor radar', category: 'Navigation', icon: <Globe className="w-4 h-4 text-violet-400" />, path: '/market-intelligence' },
    { id: 'nav-analytics', title: 'Executive Analytics Builder', subtitle: 'Pipeline metrics & conversion rates', category: 'Navigation', icon: <BarChart3 className="w-4 h-4 text-indigo-400" />, path: '/analytics' },
    { id: 'nav-users', title: 'User Management', subtitle: 'Enterprise user directory', category: 'Navigation', icon: <Users className="w-4 h-4 text-slate-400" />, path: '/users' },
    { id: 'nav-roles', title: 'Role & RBAC Security', subtitle: 'Permission matrices', category: 'Navigation', icon: <Shield className="w-4 h-4 text-slate-400" />, path: '/roles' },
    { id: 'nav-config', title: 'System Configuration', subtitle: 'Platform parameters & stages', category: 'Navigation', icon: <Sliders className="w-4 h-4 text-slate-400" />, path: '/configuration' },
    { id: 'nav-prod-feasibility', title: 'Production Feasibility Platform', subtitle: 'Manufacturing facility, line, equipment & capacity checks', category: 'Navigation', icon: <Factory className="w-4 h-4 text-neutral-400" />, path: '/production-feasibility' },
    { id: 'nav-prod-dash', title: 'Production Capacity Dashboard', subtitle: 'Site utilization & operational pipeline metrics', category: 'Navigation', icon: <BarChart3 className="w-4 h-4 text-cyan-400" />, path: '/production-feasibility/dashboard' },
    { id: 'act-new-opp', title: 'Create New Opportunity', subtitle: 'Initiate a commercial BD deal', category: 'Quick Action', icon: <Plus className="w-4 h-4 text-emerald-400" />, path: '/opportunities?action=new' },
    { id: 'act-new-feasibility', title: 'Start Production Feasibility Assessment', subtitle: 'Standard 17-step manufacturing evaluation dossier', category: 'Quick Action', icon: <Plus className="w-4 h-4 text-neutral-400" />, path: '/production-feasibility/wizard' },
    { id: 'act-new-task', title: 'Create Follow-up Task', subtitle: 'Assign an operational commitment', category: 'Quick Action', icon: <Plus className="w-4 h-4 text-sky-400" />, path: '/tasks?action=new' },
    { id: 'act-new-prod', title: 'Register New Product', subtitle: 'Add a canonical pharmaceutical asset', category: 'Quick Action', icon: <Plus className="w-4 h-4 text-amber-400" />, path: '/products?action=new' },
  ];

  const filtered = commands.filter(c =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    (c.subtitle && c.subtitle.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          const item = filtered[selectedIndex];
          if (item.action) {
            item.action();
          } else if (item.path) {
            navigate(item.path);
          }
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <Search className="w-5 h-5 text-cyan-400 mr-3" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command, module, or entity to search (e.g., Opportunities, Tasks, Products)..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No matching commands or entities found for "{query}".
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.action) item.action();
                  else if (item.path) navigate(item.path);
                  onClose();
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer transition ${
                  selectedIndex === idx
                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-white'
                    : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-xs text-slate-400">{item.subtitle}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {item.category}
                  </span>
                  <ArrowRight className={`w-3.5 h-3.5 ${selectedIndex === idx ? 'text-cyan-400' : 'text-slate-600'}`} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Tips */}
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/80 text-[11px] font-mono text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">↵</kbd> Select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">ESC</kbd> Close</span>
          </div>
          <span className="text-cyan-400">BDIQ Command Center</span>
        </div>
      </div>
    </div>
  );
};
