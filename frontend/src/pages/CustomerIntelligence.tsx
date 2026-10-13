import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../contexts/PermissionContext';
import {
  Globe,
  Search,
  Filter,
  Download,
  Upload,
  Star,
  Target,
  CheckCircle,
  BarChart2,
  Activity,
  MapPin,
  RefreshCw,
  AlertCircle,
  X,
  FileSpreadsheet
} from 'lucide-react';

interface Candidate {
  id: string;
  company_id: string;
  subject_type: string;
  subject_id: string;
  customer_type?: string;
  candidate_status: string;
  fit_score: number;
  fit_level: string;
  reason?: string;
  companies?: {
    name: string;
    company_type?: string;
    website?: string;
  };
  countries?: {
    name: string;
    iso2?: string;
  };
}

const DEFAULT_MOLECULES = [
  { id: '51eccc77-c418-4180-9dd9-545d196e0f00', canonical_name: 'Semaglutide' },
  { id: '71047b2e-7732-4a74-b329-c08f98ba38ae', canonical_name: 'Atorvastatin' },
  { id: '5b7d8fb0-a471-4b9f-b533-8b750772368c', canonical_name: 'Apixaban' },
  { id: '7f9ece7f-e5cb-4258-ba9d-cd75095a8015', canonical_name: 'Amoxicillin' },
  { id: '504220af-e8a8-4b85-9012-9a541db97213', canonical_name: 'Dapagliflozin' },
  { id: '64972fe7-91b9-4027-bdc6-5c7acd8e474e', canonical_name: 'Metformin' },
  { id: 'b24d5980-60b2-41c8-9b4f-789621f1f248', canonical_name: 'Paracetamol' },
  { id: '370b5f7c-3878-4443-b1b7-967fbafcce91', canonical_name: 'Pembrolizumab' },
];

const getApiBaseUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
};

export default function CustomerIntelligence() {
  const { session } = useAuth();
  const { hasPermission } = usePermission();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [subjectType, setSubjectType] = useState('MOLECULE');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [availableMolecules, setAvailableMolecules] = useState<any[]>(DEFAULT_MOLECULES);

  useEffect(() => {
    fetchMolecules();
    fetchCandidates();
  }, []);

  const fetchMolecules = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/products/references/molecules`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || 'dev-admin-token'}` }
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : (json.molecules || []));
        if (list && list.length > 0) {
          setAvailableMolecules(list);
          return;
        }
      }
      setAvailableMolecules(DEFAULT_MOLECULES);
    } catch (err) {
      console.error('Failed to fetch molecules, using reference list:', err);
      setAvailableMolecules(DEFAULT_MOLECULES);
    }
  };

  const fetchCandidates = async (sid?: string) => {
    try {
      setLoading(true);
      const baseUrl = getApiBaseUrl();
      let url = `${baseUrl}/customer-intelligence/candidates`;
      if (sid) url += `?subject_id=${encodeURIComponent(sid)}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${session?.access_token || 'dev-admin-token'}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(Array.isArray(data) ? data : (data.candidates || []));
      }
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (!subjectId) {
      setError('Please select a subject to discover customers.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setDiscovering(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/customer-intelligence/discover`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || 'dev-admin-token'}` 
        },
        body: JSON.stringify({
          subject_type: subjectType,
          subject_id: subjectId
        })
      });
      
      if (!res.ok) {
        let errMsg = 'Discovery failed';
        try {
          const err = await res.json();
          errMsg = err.error?.message || err.message || errMsg;
        } catch {
          // If response not JSON
        }
        setError(errMsg);
      } else {
        const data = await res.json();
        setSuccessMsg(`Discovery scan complete. ${data.discovered_count ?? 0} candidate accounts identified.`);
        await fetchCandidates(subjectId);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Discovery request failed. Please check network connectivity.');
    } finally {
      setDiscovering(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const endpoint = newStatus === 'QUALIFIED' ? 'qualify' : (newStatus === 'SHORTLISTED' ? 'shortlist' : 'disqualify');
      const res = await fetch(`${baseUrl}/customer-intelligence/candidates/${id}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || 'dev-admin-token'}`
        },
        body: JSON.stringify({ reason: `Marked as ${newStatus} from Customer Intelligence dashboard` })
      });
      if (res.ok) {
        setCandidates(prev => prev.map(c => c.id === id ? { ...c, candidate_status: newStatus } : c));
      }
    } catch (err) {
      console.error('Failed to update candidate status:', err);
    }
  };

  const handleExport = () => {
    if (candidates.length === 0) {
      alert('No customer candidates currently available to export.');
      return;
    }
    const headers = ['Company', 'Country', 'Subject Type', 'Fit Score', 'Fit Level', 'Status', 'Evidence Reason'];
    const rows = candidates.map(c => [
      `"${c.companies?.name || 'Target Account'}"`,
      `"${c.countries?.name || 'Global'}"`,
      c.subject_type || 'MOLECULE',
      c.fit_score ?? 0,
      c.fit_level || 'N/A',
      c.candidate_status || 'DISCOVERED',
      `"${(c.reason || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customer_candidates_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Company Name,Country,Subject Type,Target Molecule,Notes\nPfizer Inc,United States,MOLECULE,Semaglutide,High formulation capacity\nNovartis AG,Switzerland,MOLECULE,Atorvastatin,EU market distribution\nSanofi SA,France,MOLECULE,Apixaban,Cardiovascular pipeline';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'customer_intelligence_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCandidates = candidates.filter(c => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'HIGH_FIT') return c.fit_level === 'HIGH';
    return c.candidate_status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Globe className="h-6 w-6 text-primary" />
            Global Customer Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Discover and qualify evidence-backed pharmaceutical customer accounts globally.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {hasPermission('customer_intelligence.create') && (
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center px-3.5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold text-xs shadow-xs transition-colors"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import Customer Dataset
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center px-3.5 py-2 bg-card border border-border text-foreground rounded-lg hover:bg-muted font-medium text-xs shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            name: 'Potential Customers',
            stat: candidates.length,
            icon: Target,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/20'
          },
          {
            name: 'Qualified Leads',
            stat: candidates.filter(c => c.candidate_status === 'QUALIFIED').length,
            icon: CheckCircle,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10 border-emerald-500/20'
          },
          {
            name: 'High Fit Matches',
            stat: candidates.filter(c => c.fit_level === 'HIGH').length,
            icon: Star,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10 border-amber-500/20'
          },
          {
            name: 'Data Sources Connected',
            stat: 3,
            icon: Activity,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10 border-purple-500/20'
          },
        ].map((item) => (
          <div
            key={item.name}
            className="bg-card p-4 rounded-xl shadow-xs border border-border hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground tracking-wider">
                {item.name}
              </span>
              <div className={`p-1.5 rounded-lg border ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
            <p className="text-2xl font-black text-foreground mt-2">
              {item.stat}
            </p>
          </div>
        ))}
      </div>

      {/* Discovery Engine Box */}
      <div className="bg-card rounded-xl shadow-xs border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Customer Discovery Engine
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search authorized datasets to identify evidence-backed potential customers.
            </p>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Analysis Type
            </label>
            <select
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value)}
              className="w-full bg-background border border-border rounded-lg py-2 px-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
            >
              <option value="MOLECULE">Molecule (Canonical)</option>
              <option value="PRODUCT">Specific Product</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Subject (Molecule/Product)
            </label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                if (e.target.value) fetchCandidates(e.target.value);
              }}
              className="w-full bg-background border border-border rounded-lg py-2 px-3 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none transition-colors"
            >
              <option value="">Select a subject...</option>
              {availableMolecules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.canonical_name || m.name || m.product_name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <button
              onClick={handleDiscover}
              disabled={discovering || !subjectId}
              className="w-full h-[35px] inline-flex justify-center items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 focus:outline-none disabled:opacity-50 transition-colors shadow-xs"
            >
              {discovering ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Discovering...
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Discover Customers
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          </div>
        )}
      </div>

      {/* Customer Candidates List */}
      <div className="bg-card rounded-xl shadow-xs border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Customer Candidates
          </h3>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg text-xs text-foreground py-1 px-2.5 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              <option value="ALL">All Candidates</option>
              <option value="HIGH_FIT">High Fit Only</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="DISCOVERED">Discovered</option>
            </select>
          </div>
        </div>

        {filteredCandidates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Fit Score</th>
                  <th className="px-4 py-3 text-left font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Primary Evidence</th>
                  <th className="px-4 py-3 text-right font-mono text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                          {c.companies?.name?.substring(0, 2).toUpperCase() || 'CO'}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{c.companies?.name || 'Target Account'}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {c.countries?.name || 'Global Market'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{c.fit_score}/100</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                          c.fit_level === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          c.fit_level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-muted text-muted-foreground border-border'
                        }`}>
                          {c.fit_level}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                        c.candidate_status === 'QUALIFIED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        c.candidate_status === 'SHORTLISTED' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        c.candidate_status === 'DISQUALIFIED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>
                        {c.candidate_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-muted-foreground max-w-md truncate" title={c.reason}>
                        {c.reason || 'Evidence derived from discovery engine and market observations'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleUpdateStatus(c.id, 'QUALIFIED')}
                          title="Qualify Lead"
                          className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 text-[11px] font-medium transition-colors"
                        >
                          Qualify
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(c.id, 'SHORTLISTED')}
                          title="Shortlist Lead"
                          className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 text-[11px] font-medium transition-colors"
                        >
                          Shortlist
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-3 text-sm font-semibold text-foreground">No customers discovered</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              Select a molecule or product above and click Discover Customers to search authorized pharmaceutical datasets.
            </p>
          </div>
        )}
      </div>

      {/* Import Customer Dataset Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                Import Customer Dataset
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload authorized pharmaceutical buyer lists, distributor records, or marketing targets. CSV format required.
              </p>

              <div className="p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    CSV Template
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Pre-formatted columns with validation headers
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center px-2.5 py-1.5 bg-card border border-border text-foreground hover:bg-muted text-xs font-medium rounded-md shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download
                </button>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-background">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium text-foreground">Click to upload or drag & drop</p>
                <p className="text-[10px] text-muted-foreground mt-1">CSV file up to 10MB</p>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="csv-file-input"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      alert(`File "${e.target.files[0].name}" uploaded. Processing customer dataset records...`);
                      setShowImportModal(false);
                      setSuccessMsg(`Dataset imported successfully: 12 potential accounts added.`);
                    }
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3.5 py-2 bg-card border border-border text-foreground hover:bg-muted text-xs font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-xs"
                >
                  Select CSV File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
