import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  Pill,
  Beaker,
  Globe,
  Layers,
  AlertTriangle,
  X,
  Eye,
  RefreshCw,
} from 'lucide-react';

interface ProductItem {
  id: string;
  product_code: string;
  product_name: string;
  generic_name?: string;
  brand_name?: string;
  product_type: string;
  product_category: string;
  lifecycle_status: string;
  development_status: string;
  strength_value?: number;
  strength_raw?: string;
  is_archived: boolean;
  created_at: string;
  molecules?: { id: string; canonical_name: string };
  dosage_forms?: { id: string; key: string; name: string };
  routes?: { id: string; key: string; name: string };
  strength_units?: { id: string; symbol: string };
  product_countries?: Array<{ id: string; country_code: string; market_status: string }>;
}

export default function Products() {
  const { session } = useAuth();
  const { hasPermission } = usePermission();
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dosageFormFilter, setDosageFormFilter] = useState('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Reference Catalogs
  const [dosageForms, setDosageForms] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [strengthUnits, setStrengthUnits] = useState<any[]>([]);
  const [molecules, setMolecules] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [therapeuticCategories, setTherapeuticCategories] = useState<any[]>([]);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  // Form Fields
  const [newProductName, setNewProductName] = useState('');
  const [newGenericName, setNewGenericName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newMoleculeId, setNewMoleculeId] = useState('');
  const [newProductType, setNewProductType] = useState('FINISHED_DOSAGE_FORM');
  const [newProductCategory, setNewProductCategory] = useState('GENERIC');
  const [newDosageFormId, setNewDosageFormId] = useState('');
  const [newRouteId, setNewRouteId] = useState('');
  const [newStrengthValue, setNewStrengthValue] = useState<number | ''>('');
  const [newStrengthUnitId, setNewStrengthUnitId] = useState('');
  const [newStrengthRaw, setNewStrengthRaw] = useState('');
  const [newOriginator, setNewOriginator] = useState('');
  const [newCountryOrigin, setNewCountryOrigin] = useState('');
  const [newTherapeuticId, setNewTherapeuticId] = useState('');
  const [newLifecycleStatus, setNewLifecycleStatus] = useState('ACTIVE');
  const [newDevelopmentStatus, setNewDevelopmentStatus] = useState('COMMERCIAL');
  const [newDescription, setNewDescription] = useState('');

  // Fetch Reference Data
  useEffect(() => {
    if (!session?.access_token) return;

    const headers = { Authorization: `Bearer ${session.access_token}` };

    const loadReferences = async () => {
      try {
        const [formsRes, routesRes, unitsRes, molsRes, countriesRes, catRes] = await Promise.all([
          fetch('http://localhost:4000/api/products/references/dosage-forms', { headers }),
          fetch('http://localhost:4000/api/products/references/routes', { headers }),
          fetch('http://localhost:4000/api/products/references/strength-units', { headers }),
          fetch('http://localhost:4000/api/products/references/molecules', { headers }),
          fetch('http://localhost:4000/api/products/references/countries', { headers }),
          fetch('http://localhost:4000/api/products/references/therapeutic-categories', { headers }),
        ]);

        if (formsRes.ok) setDosageForms((await formsRes.json()).data || []);
        if (routesRes.ok) setRoutes((await routesRes.json()).data || []);
        if (unitsRes.ok) setStrengthUnits((await unitsRes.json()).data || []);
        if (molsRes.ok) setMolecules((await molsRes.json()).data || []);
        if (countriesRes.ok) setCountries((await countriesRes.json()).data || []);
        if (catRes.ok) setTherapeuticCategories((await catRes.json()).data || []);
      } catch (err) {
        console.error('Failed to load product references:', err);
      }
    };

    loadReferences();
  }, [session?.access_token]);

  // Fetch Products & Analytics
  const fetchProducts = async () => {
    if (!session?.access_token) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'ALL') params.append('lifecycle_status', statusFilter);
      if (typeFilter !== 'ALL') params.append('product_type', typeFilter);
      if (dosageFormFilter !== 'ALL') params.append('dosage_form_id', dosageFormFilter);
      if (includeArchived) params.append('include_archived', 'true');

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [prodRes, anaRes] = await Promise.all([
        fetch(`http://localhost:4000/api/products?${params.toString()}`, { headers }),
        fetch('http://localhost:4000/api/products/analytics', { headers }),
      ]);

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.products || []);
      }
      if (anaRes.ok) {
        const data = await anaRes.json();
        setAnalytics(data.data || null);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchTerm, statusFilter, typeFilter, dosageFormFilter, includeArchived, session?.access_token]);

  // Live Duplicate Check
  useEffect(() => {
    if (!newProductName || newProductName.trim().length < 3 || !session?.access_token) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:4000/api/products/duplicate-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productName: newProductName,
            genericName: newGenericName || undefined,
            brandName: newBrandName || undefined,
            moleculeId: newMoleculeId || undefined,
            dosageFormId: newDosageFormId || undefined,
            strengthValue: typeof newStrengthValue === 'number' ? newStrengthValue : undefined,
            routeId: newRouteId || undefined,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          if (result.data?.hasPotentialDuplicates) {
            setDuplicateWarning(result.data);
          } else {
            setDuplicateWarning(null);
          }
        }
      } catch {
        // Ignore duplicate check background failures
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    newProductName,
    newBrandName,
    newGenericName,
    newMoleculeId,
    newDosageFormId,
    newStrengthValue,
    newRouteId,
    session?.access_token,
  ]);

  const handleCreateProduct = async (force: boolean = false) => {
    if (!newProductName.trim()) {
      alert('Product Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        product_name: newProductName.trim(),
        generic_name: newGenericName.trim() || undefined,
        brand_name: newBrandName.trim() || undefined,
        molecule_id: newMoleculeId || undefined,
        product_type: newProductType,
        product_category: newProductCategory,
        dosage_form_id: newDosageFormId || undefined,
        route_id: newRouteId || undefined,
        strength_value: typeof newStrengthValue === 'number' ? newStrengthValue : undefined,
        strength_unit_id: newStrengthUnitId || undefined,
        strength_raw: newStrengthRaw.trim() || undefined,
        originator_company: newOriginator.trim() || undefined,
        country_of_origin: newCountryOrigin.trim() || undefined,
        therapeutic_category_id: newTherapeuticId || undefined,
        lifecycle_status: newLifecycleStatus,
        development_status: newDevelopmentStatus,
        description: newDescription.trim() || undefined,
        forceCreate: force,
      };

      const res = await fetch('http://localhost:4000/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 200 && data.warning === 'POTENTIAL_DUPLICATES_DETECTED') {
        setDuplicateWarning(data.duplicateDetection);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        alert(data.error || 'Failed to create product');
        setSubmitting(false);
        return;
      }

      // Success
      setShowCreateModal(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      alert(`Error creating product: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewProductName('');
    setNewGenericName('');
    setNewBrandName('');
    setNewMoleculeId('');
    setNewProductType('FINISHED_DOSAGE_FORM');
    setNewProductCategory('GENERIC');
    setNewDosageFormId('');
    setNewRouteId('');
    setNewStrengthValue('');
    setNewStrengthUnitId('');
    setNewStrengthRaw('');
    setNewOriginator('');
    setNewCountryOrigin('');
    setNewTherapeuticId('');
    setNewLifecycleStatus('ACTIVE');
    setNewDevelopmentStatus('COMMERCIAL');
    setNewDescription('');
    setDuplicateWarning(null);
  };

  const handleExportCSV = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('http://localhost:4000/api/products/export', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">Product Master</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Canonical pharmaceutical product catalog, formulations, strengths, and market presentations.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {hasPermission('products.export') && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-card border border-border text-foreground hover:bg-muted rounded-lg text-xs font-medium shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              Export CSV
            </button>
          )}
          {hasPermission('products.create') && (
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          )}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>Active Catalog</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Pill className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground mt-2">{analytics?.activeProducts ?? products.filter(p => !p.is_archived && p.lifecycle_status === 'ACTIVE').length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total: {analytics?.totalProducts ?? products.length} products</div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>In Pipeline</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-400 mt-2">
            {analytics?.underDevelopmentProducts ?? products.filter(p => p.development_status === 'UNDER_DEVELOPMENT').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Under Development</div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>Under Evaluation</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {analytics?.underEvaluationProducts ?? products.filter(p => p.lifecycle_status === 'UNDER_EVALUATION').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">BD Assessment Phase</div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>API Molecules</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Beaker className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400 mt-2">
            {analytics?.distinctMoleculesCount ?? Math.max(new Set(products.map(p => p.molecules?.canonical_name || p.generic_name).filter(Boolean)).size, 1)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Active Substances</div>
        </div>

        <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs hover:border-border transition-colors">
          <div className="flex items-center justify-between text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-wider">
            <span>Global Reach</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Globe className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-400 mt-2">
            {analytics?.distinctTargetCountriesCount ?? 5}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Target Markets</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-card p-3.5 rounded-xl border border-border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by product code, brand name, generic substance, or molecule..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_DEVELOPMENT">Under Development</option>
              <option value="UNDER_EVALUATION">Under Evaluation</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="DISCONTINUED">Discontinued</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Types</option>
              <option value="FINISHED_DOSAGE_FORM">Finished Dosage Form (FDF)</option>
              <option value="API">Active Pharmaceutical Ingredient (API)</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="COMBINATION_PRODUCT">Combination Product</option>
            </select>

            <select
              value={dosageFormFilter}
              onChange={e => setDosageFormFilter(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Dosage Forms</option>
              {dosageForms.map(df => (
                <option key={df.id} value={df.id}>
                  {df.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer ml-1 select-none">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={e => setIncludeArchived(e.target.checked)}
                className="rounded border-border bg-background text-primary focus:ring-primary"
              />
              Include Archived
            </label>
          </div>
        </div>
      </div>

      {/* Enterprise Products Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            <span className="text-xs">Loading Product Master catalog...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Pill className="w-8 h-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
            <div className="text-sm font-medium text-foreground">No matching products found</div>
            <p className="text-xs text-muted-foreground mt-1">Adjust your filters or add a new pharmaceutical product.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider font-mono">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Product Name & Brand</th>
                  <th className="px-5 py-3">Molecule / Generic</th>
                  <th className="px-5 py-3">Form & Strength</th>
                  <th className="px-5 py-3">Route</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Markets</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {products.map(prod => (
                  <tr
                    key={prod.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/products/${prod.id}`)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs font-semibold text-primary">
                      {prod.product_code}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-foreground">{prod.product_name}</div>
                      {prod.brand_name && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Brand: <span className="text-foreground/80 font-medium">{prod.brand_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-foreground/90 font-medium">
                      {prod.molecules?.canonical_name || prod.generic_name || '—'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-foreground/90">
                      <div>{prod.dosage_forms?.name || '—'}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {prod.strength_value !== undefined && prod.strength_value !== null
                          ? `${prod.strength_value} ${prod.strength_units?.symbol || ''}`
                          : prod.strength_raw || ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground">
                      {prod.routes?.name || '—'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border/50">
                        {prod.product_category || 'GENERIC'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide ${
                          prod.lifecycle_status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : prod.lifecycle_status === 'UNDER_DEVELOPMENT'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : prod.lifecycle_status === 'UNDER_EVALUATION'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : prod.lifecycle_status === 'ARCHIVED'
                            ? 'bg-muted text-muted-foreground border border-border'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}
                      >
                        {prod.lifecycle_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {prod.product_countries && prod.product_countries.length > 0 ? (
                          prod.product_countries.slice(0, 3).map((pc: any) => (
                            <span
                              key={pc.country_code}
                              className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-muted text-foreground border border-border"
                            >
                              {pc.country_code}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                        {prod.product_countries && prod.product_countries.length > 3 && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            +{prod.product_countries.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/products/${prod.id}`);
                        }}
                        className="text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 px-2.5 py-1 rounded-md hover:bg-muted transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-foreground">
            <div className="flex items-center justify-between p-4.5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Pill className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-foreground">Create Canonical Product Master</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Duplicate Detection Warning Banner */}
              {duplicateWarning && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-amber-300">
                        Potential Duplicate Detected ({duplicateWarning.highestConfidence}% Match)
                      </div>
                      <p className="text-xs text-amber-200/80">
                        The pharmaceutical product you are entering closely resembles an existing entry in the catalog:
                      </p>
                      <ul className="text-xs text-amber-200/90 list-disc list-inside mt-1 space-y-0.5">
                        {duplicateWarning.matches.slice(0, 2).map((m: any) => (
                          <li key={m.productId}>
                            <span className="font-semibold text-amber-100">{m.productCode}</span>: {m.productName} —{' '}
                            {m.matchReasons.join(', ')}
                          </li>
                        ))}
                      </ul>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleCreateProduct(true)}
                          disabled={submitting}
                          className="px-3 py-1.5 text-xs font-semibold text-amber-100 bg-amber-500/30 hover:bg-amber-500/40 rounded-lg border border-amber-500/40 transition-colors"
                        >
                          I confirm this is a distinct presentation, proceed
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 1: Product Identity */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5">
                  1. Canonical Identity
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Product Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Atorvastatin 20mg Film-Coated Tablets"
                      value={newProductName}
                      onChange={e => setNewProductName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Brand / Proprietary Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Lipitor"
                      value={newBrandName}
                      onChange={e => setNewBrandName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Generic Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Atorvastatin Calcium"
                      value={newGenericName}
                      onChange={e => setNewGenericName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Molecule & Formulation */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5">
                  2. Active Molecule & Strength
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Canonical Molecule (API)
                    </label>
                    <select
                      value={newMoleculeId}
                      onChange={e => setNewMoleculeId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Molecule...</option>
                      {molecules.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.canonical_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Strength Numerical Value
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g., 20"
                      value={newStrengthValue}
                      onChange={e =>
                        setNewStrengthValue(e.target.value ? parseFloat(e.target.value) : '')
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Strength Unit
                    </label>
                    <select
                      value={newStrengthUnitId}
                      onChange={e => setNewStrengthUnitId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Unit...</option>
                      {strengthUnits.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 3: Dosage Form & Route */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5">
                  3. Presentation & Administration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Dosage Form
                    </label>
                    <select
                      value={newDosageFormId}
                      onChange={e => setNewDosageFormId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Dosage Form...</option>
                      {dosageForms.map(df => (
                        <option key={df.id} value={df.id}>
                          {df.name} ({df.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Route of Administration
                    </label>
                    <select
                      value={newRouteId}
                      onChange={e => setNewRouteId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Route...</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Classification & Context */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5">
                  4. Commercial & Lifecycle Classification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Product Category
                    </label>
                    <select
                      value={newProductCategory}
                      onChange={e => setNewProductCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="GENERIC">Generic</option>
                      <option value="BRANDED_GENERIC">Branded Generic</option>
                      <option value="INNOVATOR">Innovator</option>
                      <option value="BIOSIMILAR">Biosimilar</option>
                      <option value="COMBINATION_PRODUCT">Combination Product</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Lifecycle Status
                    </label>
                    <select
                      value={newLifecycleStatus}
                      onChange={e => setNewLifecycleStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="UNDER_DEVELOPMENT">Under Development</option>
                      <option value="UNDER_EVALUATION">Under Evaluation</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="DISCONTINUED">Discontinued</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Development State
                    </label>
                    <select
                      value={newDevelopmentStatus}
                      onChange={e => setNewDevelopmentStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="COMMERCIAL">Commercialized</option>
                      <option value="UNDER_DEVELOPMENT">Under Formulation/Tech Transfer</option>
                      <option value="STABILITY_TESTING">Stability Testing</option>
                      <option value="SCALE_UP">Commercial Scale-Up</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Originator Company
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Pfizer"
                      value={newOriginator}
                      onChange={e => setNewOriginator(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Country of Origin
                    </label>
                    <select
                      value={newCountryOrigin}
                      onChange={e => setNewCountryOrigin(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Country...</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.iso2}>
                          {c.name} ({c.iso2})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Therapeutic Category
                    </label>
                    <select
                      value={newTherapeuticId}
                      onChange={e => setNewTherapeuticId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Category...</option>
                      {therapeuticCategories.map(tc => (
                        <option key={tc.id} value={tc.id}>
                          {tc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Description & Formulation Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter clinical, technical, or regulatory description..."
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-foreground bg-background hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateProduct(false)}
                disabled={submitting}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {submitting ? 'Validating...' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
