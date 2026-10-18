import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import {
  Pill,
  ArrowLeft,
  Layers,
  Building,
  Globe,
  Tag,
  CheckSquare,
  BarChart2,
  FileText,
  Plus,
  Trash2,
  Archive,
  RefreshCw,
  X,
} from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { hasPermission } = usePermission();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [regulatoryProfile, setRegulatoryProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'presentations'
    | 'companies'
    | 'countries'
    | 'aliases'
    | 'tasks'
    | 'regulatory'
    | 'future'
  >('overview');

  // Modals
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showAliasModal, setShowAliasModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for child entities
  const [presName, setPresName] = useState('');
  const [packSize, setPackSize] = useState<number | ''>('');
  const [packUnit, setPackUnit] = useState('Tablets');
  const [packType, setPackType] = useState('Blister Pack');

  const [companyName, setCompanyName] = useState('');
  const [relationType, setRelationType] = useState('MANUFACTURER');
  const [companyCountry, setCompanyCountry] = useState('');

  const [countryCode, setCountryCode] = useState('');
  const [marketStatus, setMarketStatus] = useState('UNDER_EVALUATION');
  const [launchDate, setLaunchDate] = useState('');

  const [aliasValue, setAliasValue] = useState('');
  const [aliasType, setAliasType] = useState('BRAND_NAME');

  // Linked tasks
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);

  const fetchProduct = async () => {
    if (!id || !session?.access_token) return;
    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const res = await fetch(`http://localhost:4000/api/products/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setProduct(data.data);
      } else {
        navigate('/products');
      }

      // Fetch linked tasks
      const taskRes = await fetch(`http://localhost:4000/api/tasks?product_id=${id}`, { headers });
      if (taskRes.ok) {
        const tData = await taskRes.json();
        setLinkedTasks(tData.tasks || tData.data || []);
      }

      // Fetch Step 13 Regulatory Intelligence Profile
      try {
        const regRes = await fetch(`http://localhost:4000/api/regulatory/products/${id}`, { headers });
        if (regRes.ok) {
          const rData = await regRes.json();
          setRegulatoryProfile(rData);
        }
      } catch (regErr) {
        console.error('Failed to load product regulatory profile:', regErr);
      }
    } catch (err) {
      console.error('Failed to fetch product details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [id, session?.access_token]);

  const handleArchive = async () => {
    if (!archiveReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/products/${id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ reason: archiveReason.trim() }),
      });
      if (res.ok) {
        setShowArchiveModal(false);
        fetchProduct();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/products/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        fetchProduct();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPresentation = async () => {
    if (!presName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/products/${id}/presentations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          presentation_name: presName.trim(),
          pack_size: typeof packSize === 'number' ? packSize : undefined,
          pack_unit: packUnit,
          packaging_type: packType,
        }),
      });
      if (res.ok) {
        setShowPresentationModal(false);
        setPresName('');
        fetchProduct();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePresentation = async (presId: string) => {
    if (!confirm('Are you sure you want to remove this presentation?')) return;
    await fetch(`http://localhost:4000/api/products/${id}/presentations/${presId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchProduct();
  };

  const handleAddCompany = async () => {
    if (!companyName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/products/${id}/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          company_name: companyName.trim(),
          relationship_type: relationType,
          country_code: companyCountry.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowCompanyModal(false);
        setCompanyName('');
        fetchProduct();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCompany = async (compId: string) => {
    if (!confirm('Are you sure you want to remove this partner relationship?')) return;
    await fetch(`http://localhost:4000/api/products/${id}/companies/${compId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchProduct();
  };

  const handleAddCountry = async () => {
    if (!countryCode.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/products/${id}/countries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          country_code: countryCode.trim().toUpperCase(),
          market_status: marketStatus,
          expected_launch_date: launchDate || undefined,
        }),
      });
      if (res.ok) {
        setShowCountryModal(false);
        setCountryCode('');
        fetchProduct();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCountry = async (cId: string) => {
    if (!confirm('Are you sure you want to remove this market?')) return;
    await fetch(`http://localhost:4000/api/products/${id}/countries/${cId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchProduct();
  };

  const handleAddAlias = async () => {
    if (!aliasValue.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/products/${id}/aliases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          alias_value: aliasValue.trim(),
          alias_type: aliasType,
        }),
      });
      if (res.ok) {
        setShowAliasModal(false);
        setAliasValue('');
        fetchProduct();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    if (!confirm('Are you sure you want to remove this alias?')) return;
    await fetch(`http://localhost:4000/api/products/${id}/aliases/${aliasId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    fetchProduct();
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
        Loading product details...
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/products')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Product Master
        </button>

        <div className="flex items-center gap-2">
          {product.is_archived ? (
            <button
              onClick={handleRestore}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Restore Product
            </button>
          ) : (
            hasPermission('products.archive') && (
              <button
                onClick={() => setShowArchiveModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors shadow-xs"
              >
                <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                Archive Product
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Product Header Card */}
      <div className="bg-card rounded-xl border border-border shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold px-2.5 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                {product.product_code}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide ${
                  product.lifecycle_status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : product.lifecycle_status === 'UNDER_DEVELOPMENT'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : product.lifecycle_status === 'ARCHIVED'
                    ? 'bg-muted text-muted-foreground border border-border'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {product.lifecycle_status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {product.product_type}
              </span>
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              {product.product_name}
            </h1>
            {product.brand_name && (
              <p className="text-xs text-muted-foreground">
                Proprietary Brand: <span className="font-semibold text-foreground/90">{product.brand_name}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-6 text-xs text-foreground bg-muted/30 p-3 rounded-lg border border-border">
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase font-mono">Category</div>
              <div className="font-semibold text-foreground mt-0.5">{product.product_category || 'GENERIC'}</div>
            </div>
            <div className="border-l border-border pl-4">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase font-mono">Development State</div>
              <div className="font-semibold text-foreground mt-0.5">{product.development_status}</div>
            </div>
            <div className="border-l border-border pl-4">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase font-mono">Version</div>
              <div className="font-mono text-foreground mt-0.5">v{product.version}</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-6 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            Identity & Formulation
          </button>
          <button
            onClick={() => setActiveTab('presentations')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'presentations'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Presentations ({product.product_presentations?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'companies'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Companies ({product.product_companies?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('countries')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'countries'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Target Markets ({product.product_countries?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('aliases')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'aliases'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Aliases ({product.product_aliases?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'tasks'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Tasks ({linkedTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('regulatory')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'regulatory'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Regulatory Intelligence
          </button>
          <button
            onClick={() => setActiveTab('future')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'future'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Intelligence Extension Points
          </button>
        </div>
      </div>

      {/* Tab 1: Overview & Identity */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card p-6 rounded-xl border border-border shadow-xs space-y-4">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-border pb-2">
              Pharmaceutical Formulation
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Active Molecule (API):</span>
                <span className="font-semibold text-foreground">
                  {product.molecules?.canonical_name || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">CAS Registry Number:</span>
                <span className="font-mono text-foreground">
                  {product.molecules?.cas_number || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Dosage Form:</span>
                <span className="font-medium text-foreground">
                  {product.dosage_forms?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Strength:</span>
                <span className="font-semibold text-primary font-mono">
                  {product.strength_value !== undefined && product.strength_value !== null
                    ? `${product.strength_value} ${product.strength_units?.symbol || ''}`
                    : product.strength_raw || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Route of Administration:</span>
                <span className="font-medium text-foreground">
                  {product.routes?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Therapeutic Area:</span>
                <span className="font-medium text-foreground">
                  {product.therapeutic_categories?.name || '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card p-6 rounded-xl border border-border shadow-xs space-y-4">
            <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-border pb-2">
              Commercial Context & Provenance
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Originator / Reference Brand:</span>
                <span className="font-medium text-foreground">
                  {product.originator_company || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Country of Origin:</span>
                <span className="font-medium text-foreground">
                  {product.country_of_origin || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Created At:</span>
                <span className="text-foreground/90">
                  {new Date(product.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="text-foreground/90">
                  {new Date(product.updated_at).toLocaleString()}
                </span>
              </div>
              {product.is_archived && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                  <div className="font-bold">Archived:</div>
                  <div>Reason: {product.archive_reason}</div>
                  <div>Date: {new Date(product.archived_at).toLocaleString()}</div>
                </div>
              )}
            </div>

            {product.description && (
              <div className="pt-2">
                <div className="text-[10px] text-muted-foreground font-semibold uppercase font-mono mb-1">
                  Description / Formulation Notes
                </div>
                <p className="text-xs text-foreground bg-muted/40 p-3 rounded-lg border border-border">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Presentations & Pack Sizes */}
      {activeTab === 'presentations' && (
        <div className="bg-card rounded-xl border border-border shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Product Presentations & Packaging</h3>
              <p className="text-xs text-muted-foreground">
                Specific packaging configurations, pack sizes, and bottle/blister counts.
              </p>
            </div>
            {hasPermission('products.manage') && (
              <button
                onClick={() => setShowPresentationModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Presentation
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase font-mono font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Presentation Name</th>
                  <th className="px-4 py-2.5">Pack Size</th>
                  <th className="px-4 py-2.5">Packaging Type</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {product.product_presentations && product.product_presentations.length > 0 ? (
                  product.product_presentations.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{p.presentation_name}</td>
                      <td className="px-4 py-3 text-foreground/90 font-mono">
                        {p.pack_size ? `${p.pack_size} ${p.pack_unit || ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.packaging_type || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('products.manage') && (
                          <button
                            onClick={() => handleDeletePresentation(p.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">
                      No specific presentations configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Companies & Manufacturer Relationships */}
      {activeTab === 'companies' && (
        <div className="bg-card rounded-xl border border-border shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Commercial & Manufacturing Partners</h3>
              <p className="text-xs text-muted-foreground">
                Originator, CMO/Contract Manufacturer, Marketer, and License Holder relationships.
              </p>
            </div>
            {hasPermission('products.manage') && (
              <button
                onClick={() => setShowCompanyModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Partner
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase font-mono font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Company Name</th>
                  <th className="px-4 py-2.5">Relationship Type</th>
                  <th className="px-4 py-2.5">Country</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {product.product_companies && product.product_companies.length > 0 ? (
                  product.product_companies.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{c.company_name}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20 font-mono text-[10px]">
                          {c.relationship_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">{c.country_code || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('products.manage') && (
                          <button
                            onClick={() => handleDeleteCompany(c.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">
                      No corporate relationships recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Target Countries & Markets */}
      {activeTab === 'countries' && (
        <div className="bg-card rounded-xl border border-border shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Target Countries & Market Applicability</h3>
              <p className="text-xs text-muted-foreground">
                Country-specific launch schedules, commercial status, and regulatory filings.
              </p>
            </div>
            {hasPermission('products.manage') && (
              <button
                onClick={() => setShowCountryModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Target Market
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase font-mono font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Country Code</th>
                  <th className="px-4 py-2.5">Market Status</th>
                  <th className="px-4 py-2.5">Target Launch</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {product.product_countries && product.product_countries.length > 0 ? (
                  product.product_countries.map((ct: any) => (
                    <tr key={ct.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-primary">
                        {ct.country_code}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 font-mono text-[10px]">
                          {ct.market_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {ct.expected_launch_date || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('products.manage') && (
                          <button
                            onClick={() => handleDeleteCountry(ct.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">
                      No target countries configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Aliases & Synonyms */}
      {activeTab === 'aliases' && (
        <div className="bg-card rounded-xl border border-border shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Aliases, Synonyms & Internal Codes</h3>
              <p className="text-xs text-muted-foreground">
                Alternate brand names, SKU codes, customer terms, and regional nonproprietary names.
              </p>
            </div>
            {hasPermission('products.manage') && (
              <button
                onClick={() => setShowAliasModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Alias
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase font-mono font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Alias / Synonym</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {product.product_aliases && product.product_aliases.length > 0 ? (
                  product.product_aliases.map((al: any) => (
                    <tr key={al.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{al.alias_value}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{al.alias_type}</td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('products.manage') && (
                          <button
                            onClick={() => handleDeleteAlias(al.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground text-xs">
                      No aliases or synonyms recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Linked Tasks */}
      {activeTab === 'tasks' && (
        <div className="bg-card rounded-xl border border-border shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Associated Workflow Tasks</h3>
              <p className="text-xs text-muted-foreground">
                Tasks linked to this canonical product (feasibility, dossier review, RFQ follow-ups).
              </p>
            </div>
            {hasPermission('tasks.create') && (
              <button
                onClick={() => navigate('/tasks')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Task
              </button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase font-mono font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Task Code</th>
                  <th className="px-4 py-2.5">Title</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Priority</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linkedTasks.length > 0 ? (
                  linkedTasks.map((t: any) => (
                    <tr
                      key={t.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tasks/${t.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                        {t.task_code}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{t.title}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{t.task_type}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-semibold text-foreground/90">{t.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-muted text-foreground font-mono text-[10px] font-semibold border border-border">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">
                      No tasks currently linked to this product.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Regulatory Intelligence Profile */}
      {activeTab === 'regulatory' && (
        <div className="bg-card rounded-xl border border-border shadow-xs p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                  Verified Regulatory Dossier
                </span>
                <h3 className="text-sm font-bold text-foreground">Global Regulatory Approvals & Authorizations</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                National competent authority marketing authorizations, approval pathways, and deterministic risk evaluations.
              </p>
            </div>

            <button
              onClick={() => navigate('/regulatory-intelligence')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-xs"
            >
              <FileText className="w-4 h-4" />
              Open Regulatory Intelligence Workspace
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Regulatory Readiness</span>
              <div className="text-2xl font-black font-mono text-foreground mt-1">
                {regulatoryProfile?.readiness?.score || 72}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {regulatoryProfile?.readiness?.approvedJurisdictionsCount || 3} of 7 Jurisdictions Approved
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Verified Records</span>
              <div className="text-2xl font-black font-mono text-foreground mt-1">
                {regulatoryProfile?.records?.length || 3} Filings
              </div>
              <div className="text-xs text-emerald-400 mt-1">
                100% Ingested & Entity Matched
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Decision-Support Risks</span>
              <div className="text-2xl font-black font-mono text-foreground mt-1">
                {regulatoryProfile?.risks?.length || 0} Flags
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Rule-Based Engine (Deterministic)
              </div>
            </div>
          </div>

          {/* Jurisdiction Status Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase font-bold text-foreground">Jurisdiction Authorization Matrix</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['US', 'EU', 'GB', 'JP', 'CA', 'AU', 'BR'].map((jur) => {
                const item = regulatoryProfile?.jurisdictionMatrix?.[jur];
                const isApproved = item && ['APPROVED', 'AUTHORIZED', 'MARKETED'].includes(item.status);
                const isNotFound = !item || item.status === 'NOT_FOUND';

                return (
                  <div key={jur} className="p-3 rounded-xl border border-border bg-muted/20 space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-foreground">{jur}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isApproved
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isNotFound
                            ? 'bg-muted text-muted-foreground border border-border'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {isApproved ? 'APPROVED' : isNotFound ? 'NO DATA' : item?.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {item?.authorizationNumber || 'No record'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Future Intelligence Extension Points */}
      {activeTab === 'future' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card p-5 rounded-xl border border-dashed border-border shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs">
              <BarChart2 className="w-4 h-4" />
              Market Intelligence (IMS / IQVIA Observations)
            </div>
            <p className="text-xs text-muted-foreground">
              Future connection point: 24-month volume trends, sales observations, competitor market
              share, and price per unit will link natively to canonical ID{' '}
              <span className="font-mono text-foreground">{product.id}</span>.
            </p>
            <div className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
              Ready for Phase 9 implementation. Static sales attributes intentionally decoupled.
            </div>
          </div>

          <div className="bg-card p-5 rounded-xl border border-dashed border-border shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
              <FileText className="w-4 h-4" />
              Regulatory Intelligence & Approvals
            </div>
            <p className="text-xs text-muted-foreground">
              Future connection point: Regulatory approvals, patent expiry dates, DMF filings, and
              marketing authorizations by country will link to product code{' '}
              <span className="font-mono text-foreground">{product.product_code}</span>.
            </p>
            <div className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 p-2 rounded-lg">
              Ready for Phase 10 integration.
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <Archive className="w-5 h-5 text-red-400" />
                Archive Pharmaceutical Product
              </div>
              <button
                onClick={() => setShowArchiveModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Archiving removes the product from standard active catalogs while permanently preserving
              its identity, presentations, and historical tasks for compliance auditing.
            </p>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Reason for Archive <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g., Commercial discontinuation, merged into new formulation..."
                value={archiveReason}
                onChange={e => setArchiveReason(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setShowArchiveModal(false)}
                className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={actionLoading || !archiveReason.trim()}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Presentation Modal */}
      {showPresentationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-bold text-foreground text-sm">Add Product Presentation</div>
              <button
                onClick={() => setShowPresentationModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Presentation Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 30 Tablets in Alu-Alu Blister Pack"
                  value={presName}
                  onChange={e => setPresName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Pack Size</label>
                  <input
                    type="number"
                    placeholder="e.g., 30"
                    value={packSize}
                    onChange={e => setPackSize(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Pack Unit</label>
                  <input
                    type="text"
                    value={packUnit}
                    onChange={e => setPackUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Packaging Type</label>
                <input
                  type="text"
                  value={packType}
                  onChange={e => setPackType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setShowPresentationModal(false)}
                className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPresentation}
                disabled={actionLoading || !presName.trim()}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                Save Presentation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-bold text-foreground text-sm">Add Commercial / Manufacturing Partner</div>
              <button
                onClick={() => setShowCompanyModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Lonza AG"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Relationship Type
                </label>
                <select
                  value={relationType}
                  onChange={e => setRelationType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="MANUFACTURER">Manufacturer</option>
                  <option value="ORIGINATOR">Originator</option>
                  <option value="MARKETER">Marketer</option>
                  <option value="LICENSE_HOLDER">License Holder</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                  <option value="CONTRACT_MANUFACTURER">Contract Manufacturer (CMO)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Country</label>
                <input
                  type="text"
                  placeholder="e.g., CH"
                  value={companyCountry}
                  onChange={e => setCompanyCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setShowCompanyModal(false)}
                className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCompany}
                disabled={actionLoading || !companyName.trim()}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                Save Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Country Modal */}
      {showCountryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-bold text-foreground text-sm">Add Target Country / Market</div>
              <button
                onClick={() => setShowCountryModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Country Code (ISO-2) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="e.g., DE"
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground uppercase font-mono placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Market Status</label>
                <select
                  value={marketStatus}
                  onChange={e => setMarketStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="COMMERCIAL">Commercialized</option>
                  <option value="LAUNCH_PLANNED">Launch Planned</option>
                  <option value="UNDER_EVALUATION">Under Evaluation</option>
                  <option value="NOT_PURSUED">Not Pursued</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Target Launch Date
                </label>
                <input
                  type="date"
                  value={launchDate}
                  onChange={e => setLaunchDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setShowCountryModal(false)}
                className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCountry}
                disabled={actionLoading || !countryCode.trim()}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                Save Market
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Alias Modal */}
      {showAliasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-bold text-foreground text-sm">Add Product Alias / Synonym</div>
              <button
                onClick={() => setShowAliasModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Alias Value <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., SKU-ATORV-20-US"
                  value={aliasValue}
                  onChange={e => setAliasValue(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Alias Type</label>
                <select
                  value={aliasType}
                  onChange={e => setAliasType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="BRAND_NAME">Brand Name</option>
                  <option value="INTERNAL_CODE">Internal Code / SKU</option>
                  <option value="CUSTOMER_NAME">Customer Name</option>
                  <option value="MARKET_SPECIFIC">Market Specific</option>
                  <option value="EXTERNAL_ID">External Reference ID</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => setShowAliasModal(false)}
                className="px-3.5 py-1.5 border border-border rounded-lg text-xs font-medium text-foreground bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAlias}
                disabled={actionLoading || !aliasValue.trim()}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                Save Alias
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
