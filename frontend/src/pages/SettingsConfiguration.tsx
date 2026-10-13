import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Server,
  List,
  CheckCircle,
  Building2,
  CheckSquare,
  Calendar,
  AlertTriangle,
  Bell,
  Cpu,
  Shield,
  Sliders,
  UserCheck,
  Sparkles
} from 'lucide-react';
import ResponsibilitySettings from './ResponsibilitySettings';

export default function SettingsConfiguration() {
  const { session } = useAuth();
  const [activeCategory, setActiveCategory] = useState<'GENERAL' | 'TASKS' | 'MEETINGS' | 'RISK' | 'NOTIFICATIONS' | 'INTELLIGENCE' | 'SECURITY' | 'SYSTEM' | 'AI_PROVIDERS'>('TASKS');
  const [activeSubTab, setActiveSubTab] = useState<'RESPONSIBILITY' | 'OPTIONS' | 'OTHER'>('RESPONSIBILITY');
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroupTab, setActiveGroupTab] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/configuration/groups', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
          if (data.length > 0) setActiveGroupTab(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch config', error);
      }
    };
    if (session) fetchConfig();
  }, [session]);

  const activeGroup = groups.find(g => g.id === activeGroupTab);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Platform Administration & Configuration</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure central responsibility rules, organizational hierarchies, SLAs, workflows, and platform parameters.
          </p>
        </div>
      </div>

      {/* Main Settings Category Tabs */}
      <div className="border-b border-border overflow-x-auto">
        <nav className="flex space-x-6">
          <button
            onClick={() => { setActiveCategory('TASKS'); setActiveSubTab('RESPONSIBILITY'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'TASKS'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            TASK MANAGEMENT
          </button>

          <button
            onClick={() => { setActiveCategory('GENERAL'); setActiveSubTab('OPTIONS'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'GENERAL'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building2 className="w-4 h-4" />
            GENERAL & ORG
          </button>

          <button
            onClick={() => { setActiveCategory('MEETINGS'); setActiveSubTab('OTHER'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'MEETINGS'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Calendar className="w-4 h-4" />
            MEETINGS
          </button>

          <button
            onClick={() => { setActiveCategory('RISK'); setActiveSubTab('OTHER'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'RISK'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            RISK RULES
          </button>

          <button
            onClick={() => { setActiveCategory('NOTIFICATIONS'); setActiveSubTab('OTHER'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'NOTIFICATIONS'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bell className="w-4 h-4" />
            NOTIFICATIONS
          </button>

          <button
            onClick={() => { setActiveCategory('INTELLIGENCE'); setActiveSubTab('OTHER'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'INTELLIGENCE'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cpu className="w-4 h-4" />
            INTELLIGENCE
          </button>

          <button
            onClick={() => { setActiveCategory('SECURITY'); setActiveSubTab('OTHER'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'SECURITY'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="w-4 h-4" />
            SECURITY
          </button>

          <button
            onClick={() => { setActiveCategory('SYSTEM'); setActiveSubTab('OPTIONS'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'SYSTEM'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="w-4 h-4" />
            SYSTEM PARAMETERS
          </button>

          <button
            onClick={() => { setActiveCategory('AI_PROVIDERS'); setActiveSubTab('OPTIONS'); }}
            className={`py-3 px-1 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeCategory === 'AI_PROVIDERS'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI ASSISTANT & PROVIDERS
          </button>
        </nav>
      </div>

      {/* Render Category Content */}
      {activeCategory === 'TASKS' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveSubTab('RESPONSIBILITY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'RESPONSIBILITY'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Update Responsibility Rules
            </button>
            <button
              onClick={() => setActiveSubTab('OPTIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'OPTIONS'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Task Dropdown Values
            </button>
          </div>

          {activeSubTab === 'RESPONSIBILITY' ? (
            <ResponsibilitySettings />
          ) : (
            <div className="flex flex-col md:flex-row gap-6 pt-2">
              <div className="w-full md:w-64 space-y-1">
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setActiveGroupTab(group.id)}
                    className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-colors ${
                      activeGroupTab === group.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Server className="h-4 w-4" />
                    {group.name}
                  </button>
                ))}
              </div>

              <div className="flex-1">
                {activeGroup ? (
                  <div className="bg-card shadow-sm border border-border rounded-lg p-6">
                    <h2 className="text-lg font-bold text-foreground mb-1">{activeGroup.name} Configuration</h2>
                    <p className="text-xs text-muted-foreground mb-6">{activeGroup.description}</p>
                    <div className="space-y-4">
                      {activeGroup.configuration_definitions?.map((def: any) => (
                        <div key={def.id} className="border border-border rounded-md p-4">
                          <h3 className="font-semibold text-foreground text-sm">{def.label}</h3>
                          <p className="text-xs text-muted-foreground">{def.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-xs">Select a domain</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeCategory === 'GENERAL' && (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-foreground">Organization Hierarchy & Business Units</h2>
          <p className="text-xs text-muted-foreground">
            View canonical Business Units, Departments, and active member profiles used by the Responsibility Engine.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">Business Units</h3>
              <p className="text-2xl font-bold text-foreground mt-2">Active</p>
              <p className="text-xs text-muted-foreground mt-1">Multi-site operating units</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">Departments</h3>
              <p className="text-2xl font-bold text-foreground mt-2">Configured</p>
              <p className="text-xs text-muted-foreground mt-1">Regulatory, SCM, R&D, BD</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">Canonical Members</h3>
              <p className="text-2xl font-bold text-foreground mt-2">Synchronized</p>
              <p className="text-xs text-muted-foreground mt-1">User directory user_profiles</p>
            </div>
          </div>
        </div>
      )}

      {activeCategory === 'AI_PROVIDERS' && (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Enterprise AI Provider & Key Management
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure OpenAI, Anthropic, Gemini, or on-premise AI models with server-side encryption.
              </p>
            </div>
            <Link
              to="/production-feasibility/wizard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
            >
              Open Feasibility Engine
            </Link>
          </div>
          <div className="p-4 bg-muted/20 border border-border rounded-lg text-xs leading-relaxed text-foreground">
            API keys are encrypted using AES-256-GCM. Deterministic CDMO feasibility and cost calculations execute independently even if AI services are offline or rate-limited.
          </div>
        </div>
      )}

      {activeCategory !== 'TASKS' && activeCategory !== 'GENERAL' && activeCategory !== 'AI_PROVIDERS' && (
        <div className="bg-card p-8 rounded-xl border border-border shadow-sm text-center space-y-3">
          <CheckCircle className="w-8 h-8 text-primary mx-auto" />
          <h2 className="text-base font-bold text-foreground">{activeCategory} Configuration Engine</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Configured rules for {activeCategory.toLowerCase()} integrate with BDIQ workflow and central responsibility resolution.
          </p>
        </div>
      )}
    </div>
  );
}
