import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Video,
  FileText,
  FileCheck,
  Briefcase
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryType = 'all' | 'navigation' | 'actions' | 'products' | 'deals_tasks';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Quick Action' | 'Product' | 'Opportunity' | 'Task';
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
  keywords?: string[];
  badge?: string;
  badgeVariant?: 'neutral' | 'primary' | 'success' | 'warning' | 'info';
}

const STATIC_COMMANDS: CommandItem[] = [
  // 1. Navigation & Modules
  {
    id: 'nav-dash',
    title: 'Executive Dashboard',
    subtitle: 'Global portfolio command center & KPI metrics',
    category: 'Navigation',
    icon: <LayoutDashboard className="w-4 h-4 text-foreground" />,
    path: '/dashboard',
    keywords: ['home', 'overview', 'kpi', 'metrics', 'executive', 'command'],
    badge: 'Module',
    badgeVariant: 'neutral'
  },
  {
    id: 'nav-opp',
    title: 'Opportunities Pipeline',
    subtitle: 'Commercial stage-gate deals & BD negotiations',
    category: 'Navigation',
    icon: <TrendingUp className="w-4 h-4 text-foreground" />,
    path: '/opportunities',
    keywords: ['deals', 'pipeline', 'commercial', 'bd', 'revenue', 'stage-gate'],
    badge: 'Commercial',
    badgeVariant: 'success'
  },
  {
    id: 'nav-market',
    title: 'Market Intelligence Terminal',
    subtitle: 'IQVIA / MIDAS sales volumes, shares & competitor radar',
    category: 'Navigation',
    icon: <Globe className="w-4 h-4 text-foreground" />,
    path: '/market-intelligence',
    keywords: ['ims', 'iqvia', 'midas', 'sales', 'volume', 'pricing', 'competitors', 'market', 'share', 'lineage', 'provenance'],
    badge: 'Intelligence',
    badgeVariant: 'info'
  },
  {
    id: 'nav-meetings',
    title: 'Live Meeting Intelligence',
    subtitle: 'Live meeting capture, automatic MoM & task conversion',
    category: 'Navigation',
    icon: <Video className="w-4 h-4 text-foreground" />,
    path: '/meetings',
    keywords: ['meeting', 'mom', 'minutes', 'notes', 'live', 'transcription', 'tasks', 'agenda'],
    badge: 'Workflow',
    badgeVariant: 'primary'
  },
  {
    id: 'nav-prod',
    title: 'Product Master Catalog',
    subtitle: 'Canonical molecules, strengths & presentations',
    category: 'Navigation',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products',
    keywords: ['molecules', 'drugs', 'formulations', 'catalog', 'skus', 'dosage', 'api'],
    badge: 'Catalog',
    badgeVariant: 'warning'
  },
  {
    id: 'nav-tasks',
    title: 'Operational Tasks',
    subtitle: 'Work tracking, commitments & responsibility matrix',
    category: 'Navigation',
    icon: <CheckSquare className="w-4 h-4 text-foreground" />,
    path: '/tasks',
    keywords: ['todo', 'action items', 'follow-ups', 'deadlines', 'commitments', 'sla'],
    badge: 'Operations',
    badgeVariant: 'neutral'
  },
  {
    id: 'nav-prod-feasibility',
    title: 'Production Feasibility Platform',
    subtitle: 'Manufacturing lines, equipment, cleanrooms & CDMO checks',
    category: 'Navigation',
    icon: <Factory className="w-4 h-4 text-foreground" />,
    path: '/production-feasibility',
    keywords: ['cdmo', 'manufacturing', 'facility', 'capacity', 'cleanroom', 'lines', 'batch', 'equipment'],
    badge: 'Manufacturing',
    badgeVariant: 'neutral'
  },
  {
    id: 'nav-commercial-eval',
    title: 'Commercial Decision Engine',
    subtitle: '17-dimension financial NPV & strategic feasibility',
    category: 'Navigation',
    icon: <FileCheck className="w-4 h-4 text-foreground" />,
    path: '/commercial-evaluation',
    keywords: ['npv', 'evaluation', 'pricing', 'payback', 'feasibility', 'decision'],
    badge: 'Analytics',
    badgeVariant: 'info'
  },
  {
    id: 'nav-regulatory',
    title: 'Regulatory Intelligence',
    subtitle: 'Statutory approvals, FDA Orange Book & EMA registries',
    category: 'Navigation',
    icon: <Shield className="w-4 h-4 text-foreground" />,
    path: '/regulatory-intelligence',
    keywords: ['regulatory', 'fda', 'ema', 'mhra', 'approvals', 'clinical trials', 'epar'],
    badge: 'Compliance',
    badgeVariant: 'warning'
  },
  {
    id: 'nav-analytics',
    title: 'Executive Analytics Builder',
    subtitle: 'Cross-functional pipeline metrics & conversion rates',
    category: 'Navigation',
    icon: <BarChart3 className="w-4 h-4 text-foreground" />,
    path: '/analytics',
    keywords: ['analytics', 'metrics', 'kpi', 'reports', 'charts', 'conversion', 'revenue'],
    badge: 'Reports',
    badgeVariant: 'neutral'
  },
  {
    id: 'nav-config',
    title: 'Platform Settings & Feature Registry',
    subtitle: 'Central module flags, API connectors & system diagnostics',
    category: 'Navigation',
    icon: <Sliders className="w-4 h-4 text-foreground" />,
    path: '/settings',
    keywords: ['settings', 'configuration', 'admin', 'features', 'registry', 'api keys', 'nvidia'],
    badge: 'Admin',
    badgeVariant: 'neutral'
  },
  {
    id: 'nav-departments',
    title: 'Department & Employee Directory',
    subtitle: 'Organization structure, RACI allocation & teams',
    category: 'Navigation',
    icon: <Users className="w-4 h-4 text-foreground" />,
    path: '/departments',
    keywords: ['departments', 'employees', 'team', 'staff', 'directory', 'org', 'users'],
    badge: 'Directory',
    badgeVariant: 'neutral'
  },

  // 2. Quick Actions
  {
    id: 'act-new-opp',
    title: 'Create New Opportunity',
    subtitle: 'Initiate a commercial BD stage-gate deal dossier',
    category: 'Quick Action',
    icon: <Plus className="w-4 h-4 text-foreground" />,
    path: '/opportunities?action=new',
    keywords: ['new deal', 'add opportunity', 'create commercial'],
    badge: 'Action',
    badgeVariant: 'primary'
  },
  {
    id: 'act-new-meeting',
    title: 'Schedule Live Intelligence Meeting',
    subtitle: 'Launch assistant with real-time minutes & live action conversion',
    category: 'Quick Action',
    icon: <Video className="w-4 h-4 text-foreground" />,
    path: '/meetings?action=new',
    keywords: ['new meeting', 'schedule', 'start live meeting', 'agenda'],
    badge: 'Action',
    badgeVariant: 'primary'
  },
  {
    id: 'act-new-feasibility',
    title: 'Start Production Feasibility Assessment',
    subtitle: 'Standardized 17-step manufacturing evaluation dossier',
    category: 'Quick Action',
    icon: <Factory className="w-4 h-4 text-foreground" />,
    path: '/production-feasibility/wizard',
    keywords: ['new feasibility', 'wizard', 'manufacturing check', 'cdmo assess'],
    badge: 'Action',
    badgeVariant: 'primary'
  },
  {
    id: 'act-new-task',
    title: 'Create Operational Task',
    subtitle: 'Assign a commitment with automated responsibility routing',
    category: 'Quick Action',
    icon: <CheckSquare className="w-4 h-4 text-foreground" />,
    path: '/tasks?action=new',
    keywords: ['new task', 'add todo', 'assign follow-up', 'commitment'],
    badge: 'Action',
    badgeVariant: 'primary'
  },
  {
    id: 'act-new-prod',
    title: 'Register New Product',
    subtitle: 'Add a canonical pharmaceutical asset to master catalog',
    category: 'Quick Action',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products?action=new',
    keywords: ['new product', 'add molecule', 'register drug'],
    badge: 'Action',
    badgeVariant: 'primary'
  },

  // 3. Key Pharmaceutical Reference Entities (for live entity search)
  {
    id: 'ent-prod-atorvastatin',
    title: 'Atorvastatin 20mg Film-Coated Tablets',
    subtitle: 'Lipitor • Pfizer Inc. • Cardiovascular System • PROD-2026-000001',
    category: 'Product',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products',
    keywords: ['atorvastatin', 'lipitor', 'pfizer', 'cardio', 'statin', 'cholesterol', 'tablet'],
    badge: 'Molecule',
    badgeVariant: 'warning'
  },
  {
    id: 'ent-prod-semaglutide',
    title: 'Semaglutide 1.0mg/0.75mL Prefilled Pen',
    subtitle: 'Ozempic • Novo Nordisk • GLP-1 Receptor Agonist • PROD-2026-000002',
    category: 'Product',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products',
    keywords: ['semaglutide', 'ozempic', 'novo nordisk', 'glp-1', 'diabetes', 'pen', 'injectable'],
    badge: 'Biologic',
    badgeVariant: 'warning'
  },
  {
    id: 'ent-prod-mesalamine',
    title: 'Mesalamine 1.2g Delayed-Release Tablets',
    subtitle: 'Lialda • Takeda Pharmaceuticals • Gastroenterology / 5-ASA • PROD-2026-000008',
    category: 'Product',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products',
    keywords: ['mesalamine', 'lialda', 'asacol', 'pentasa', '5-asa', 'takeda', 'gastro', 'colitis'],
    badge: 'Molecule',
    badgeVariant: 'warning'
  },
  {
    id: 'ent-prod-apixaban',
    title: 'Apixaban 5mg Film-Coated Tablets',
    subtitle: 'Eliquis • BMS / Pfizer • Factor Xa Anticoagulant • PROD-2026-000003',
    category: 'Product',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products',
    keywords: ['apixaban', 'eliquis', 'bms', 'pfizer', 'anticoagulant', 'thrombosis', 'doac'],
    badge: 'Molecule',
    badgeVariant: 'warning'
  },
  {
    id: 'ent-prod-pembrolizumab',
    title: 'Pembrolizumab 100mg/4mL Solution',
    subtitle: 'Keytruda • Merck & Co. (MSD) • Anti-PD-1 Oncology • PROD-2026-000004',
    category: 'Product',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products',
    keywords: ['pembrolizumab', 'keytruda', 'merck', 'msd', 'oncology', 'immunotherapy', 'infusion'],
    badge: 'Oncology',
    badgeVariant: 'warning'
  },
  {
    id: 'ent-prod-empagliflozin',
    title: 'Empagliflozin 10mg Film-Coated Tablets',
    subtitle: 'Jardiance • Boehringer Ingelheim • SGLT2 Inhibitor • PROD-2026-000005',
    category: 'Product',
    icon: <Pill className="w-4 h-4 text-foreground" />,
    path: '/products',
    keywords: ['empagliflozin', 'jardiance', 'boehringer', 'sglt2', 'diabetes', 'heart failure'],
    badge: 'Molecule',
    badgeVariant: 'warning'
  },

  // 4. Commercial Deals & Opportunities
  {
    id: 'ent-opp-cardio-eu',
    title: 'EU Tier-1 Dossier Out-Licensing (Cardio)',
    subtitle: 'Partner: Novartis Commercial • Deal Size: $4.2M • Stage: Technical Due Diligence',
    category: 'Opportunity',
    icon: <Briefcase className="w-4 h-4 text-foreground" />,
    path: '/opportunities',
    keywords: ['novartis', 'cardio', 'out-licensing', 'dossier', 'europe', 'deal'],
    badge: '$4.2M Deal',
    badgeVariant: 'success'
  },
  {
    id: 'ent-opp-oral-solid-us',
    title: 'US Generic Market Entry - Oral Solid Dosage',
    subtitle: 'Partner: Sandoz US • Deal Size: $7.8M • Stage: Commercial Negotiation',
    category: 'Opportunity',
    icon: <Briefcase className="w-4 h-4 text-foreground" />,
    path: '/opportunities',
    keywords: ['sandoz', 'us generic', 'oral solid', 'entry', 'commercial negotiation'],
    badge: '$7.8M Deal',
    badgeVariant: 'success'
  },

  // 5. Operational Tasks
  {
    id: 'ent-task-ctd-module3',
    title: 'Prepare CTD Module 3 Stability Report',
    subtitle: 'Assigned: CMC Regulatory • Due: Tomorrow • Priority: High',
    category: 'Task',
    icon: <FileText className="w-4 h-4 text-foreground" />,
    path: '/tasks',
    keywords: ['ctd', 'stability', 'module 3', 'cmc', 'regulatory submission'],
    badge: 'Urgent Task',
    badgeVariant: 'primary'
  },
  {
    id: 'ent-task-line-clearance',
    title: 'Validate Cleanroom Line 4 Line Clearance',
    subtitle: 'Assigned: QA Operations • Due: In 3 days • Priority: High',
    category: 'Task',
    icon: <CheckSquare className="w-4 h-4 text-foreground" />,
    path: '/tasks',
    keywords: ['cleanroom', 'qa', 'line 4', 'line clearance', 'validation'],
    badge: 'QA Task',
    badgeVariant: 'neutral'
  }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSelectedCategory('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter commands by query and category
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();

    return STATIC_COMMANDS.filter(cmd => {
      // 1. Filter by category tab
      if (selectedCategory === 'navigation' && cmd.category !== 'Navigation') return false;
      if (selectedCategory === 'actions' && cmd.category !== 'Quick Action') return false;
      if (selectedCategory === 'products' && cmd.category !== 'Product') return false;
      if (selectedCategory === 'deals_tasks' && cmd.category !== 'Opportunity' && cmd.category !== 'Task') return false;

      // 2. Filter by search query
      if (!q) return true;

      const titleMatch = cmd.title.toLowerCase().includes(q);
      const subtitleMatch = cmd.subtitle?.toLowerCase().includes(q);
      const categoryMatch = cmd.category.toLowerCase().includes(q);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(q));

      return titleMatch || subtitleMatch || categoryMatch || keywordMatch;
    });
  }, [query, selectedCategory]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Group filtered commands for structured presentation
  const groupedSections = useMemo(() => {
    const groups: { title: string; category: string; items: CommandItem[] }[] = [];
    
    const navItems = filteredCommands.filter(c => c.category === 'Navigation');
    const actionItems = filteredCommands.filter(c => c.category === 'Quick Action');
    const productItems = filteredCommands.filter(c => c.category === 'Product');
    const opportunityItems = filteredCommands.filter(c => c.category === 'Opportunity');
    const taskItems = filteredCommands.filter(c => c.category === 'Task');

    if (actionItems.length > 0) {
      groups.push({ title: 'Quick Actions & Commands', category: 'actions', items: actionItems });
    }
    if (navItems.length > 0) {
      groups.push({ title: 'Modules & Navigation', category: 'navigation', items: navItems });
    }
    if (productItems.length > 0) {
      groups.push({ title: 'Pharmaceutical Products & Catalog', category: 'products', items: productItems });
    }
    if (opportunityItems.length > 0) {
      groups.push({ title: 'Active Deals & Commercial Opportunities', category: 'opportunities', items: opportunityItems });
    }
    if (taskItems.length > 0) {
      groups.push({ title: 'Operational Tasks & Follow-ups', category: 'tasks', items: taskItems });
    }

    return groups;
  }, [filteredCommands]);

  // Flattened array for index-based keyboard navigation
  const flatItems = useMemo(() => {
    return groupedSections.flatMap(g => g.items);
  }, [groupedSections]);

  // Keyboard navigation & execution
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (flatItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (flatItems.length || 1)) % (flatItems.length || 1));
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Cycle categories: all -> navigation -> actions -> products -> deals_tasks
        const categories: CategoryType[] = ['all', 'navigation', 'actions', 'products', 'deals_tasks'];
        const nextIdx = (categories.indexOf(selectedCategory) + 1) % categories.length;
        setSelectedCategory(categories[nextIdx]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems[selectedIndex]) {
          const item = flatItems[selectedIndex];
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
  }, [isOpen, flatItems, selectedIndex, selectedCategory, navigate, onClose]);

  // Keep active item in view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[data-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getBadgeClass = (variant?: CommandItem['badgeVariant']) => {
    switch (variant) {
      case 'primary':
        return 'bg-foreground text-background font-semibold';
      case 'success':
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 border border-amber-500/20 font-medium';
      case 'info':
        return 'bg-sky-500/10 text-sky-600 border border-sky-500/20 font-medium';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        
        {/* Top Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border bg-card">
          <Search className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands, modules, molecules, deals or tasks..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-1"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Close (ESC)"
          >
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted">ESC</span>
          </button>
        </div>

        {/* Category Tabs for Fast Ergonomic Filtering (Solves UX mixing) */}
        <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
          <span className="text-[11px] font-mono text-muted-foreground mr-1 uppercase">Filter:</span>
          
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All ({STATIC_COMMANDS.length})
          </button>

          <button
            onClick={() => setSelectedCategory('navigation')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedCategory === 'navigation'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Modules & Navigation
          </button>

          <button
            onClick={() => setSelectedCategory('actions')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedCategory === 'actions'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Quick Actions
          </button>

          <button
            onClick={() => setSelectedCategory('products')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedCategory === 'products'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Products & Catalog
          </button>

          <button
            onClick={() => setSelectedCategory('deals_tasks')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
              selectedCategory === 'deals_tasks'
                ? 'bg-foreground text-background shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Deals & Tasks
          </button>
        </div>

        {/* Grouped Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-4 max-h-[55vh]">
          {groupedSections.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <Search className="w-8 h-8 text-muted-foreground mx-auto opacity-40 mb-2" />
              <div className="text-sm font-semibold text-foreground">
                No matching results found
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No commands, modules, or entities matched &quot;{query}&quot;. Try searching for &quot;market&quot;, &quot;meeting&quot;, &quot;atorvastatin&quot;, or &quot;task&quot;.
              </p>
            </div>
          ) : (
            groupedSections.map(section => {
              return (
                <div key={section.title} className="space-y-1">
                  {/* Category Section Header */}
                  <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
                    <span>{section.title}</span>
                    <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded border border-border">
                      {section.items.length}
                    </span>
                  </div>

                  {/* Section Items */}
                  {section.items.map(item => {
                    const itemGlobalIndex = flatItems.findIndex(f => f.id === item.id);
                    const isSelected = selectedIndex === itemGlobalIndex;

                    return (
                      <div
                        key={item.id}
                        data-selected={isSelected}
                        onClick={() => {
                          if (item.action) item.action();
                          else if (item.path) navigate(item.path);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-100 ${
                          isSelected
                            ? 'bg-muted border-l-2 border-foreground text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-card border-border text-foreground'
                              : 'bg-muted/50 border-border/60 text-muted-foreground'
                          }`}>
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                              <span>{item.title}</span>
                            </div>
                            {item.subtitle && (
                              <div className="text-xs text-muted-foreground truncate">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {item.badge && (
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${getBadgeClass(item.badgeVariant)}`}>
                              {item.badge}
                            </span>
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 transition-transform ${
                            isSelected ? 'text-foreground translate-x-0.5' : 'text-muted-foreground opacity-30'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation & Shortcut Guide */}
        <div className="px-4 py-2.5 border-t border-border bg-muted/30 text-[11px] font-mono text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-card border border-border text-foreground font-semibold shadow-2xs">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-card border border-border text-foreground font-semibold shadow-2xs">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1 hidden sm:flex">
              <kbd className="px-1.5 py-0.5 rounded bg-card border border-border text-foreground font-semibold shadow-2xs">Tab</kbd>
              Filter Tab
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-card border border-border text-foreground font-semibold shadow-2xs">ESC</kbd>
              Close
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-foreground font-medium">
            <span className="text-[10px] text-muted-foreground hidden md:inline">
              {flatItems.length} available items
            </span>
            <span className="px-2 py-0.5 rounded bg-card border border-border text-[10px] font-mono">
              BDIQ Command Center
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
