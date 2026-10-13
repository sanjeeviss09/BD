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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Product Master</h1>
          <p className="text-sm text-gray-500">
            Canonical pharmaceutical product catalog, formulations, strengths, and market presentations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('products.export') && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              <Download className="w-4 h-4 text-gray-500" />
              Export
            </button>
          )}
          {hasPermission('products.create') && (
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          )}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Active Catalog</span>
            <Pill className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{analytics?.activeProducts ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Total: {analytics?.totalProducts ?? 0} products</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>In Pipeline</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2">
            {analytics?.underDevelopmentProducts ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">Under Development</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Under Evaluation</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {analytics?.underEvaluationProducts ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">BD Assessment Phase</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>API Molecules</span>
            <Beaker className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2">
            {analytics?.distinctMoleculesCount ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">Active Substances</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase">
            <span>Global Reach</span>
            <Globe className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2">
            {analytics?.distinctTargetCountriesCount ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">Target Markets</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by product code, brand name, generic substance, or molecule..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-700"
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
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-700"
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
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-700"
            >
              <option value="ALL">All Dosage Forms</option>
              {dosageForms.map(df => (
                <option key={df.id} value={df.id}>
                  {df.name}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={e => setIncludeArchived(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              Include Archived
            </label>
          </div>
        </div>
      </div>

      {/* Enterprise Products Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            Loading Product Master catalog...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Pill className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            No pharmaceutical products matching the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Product Name & Brand</th>
                  <th className="px-6 py-3">Molecule / Generic</th>
                  <th className="px-6 py-3">Form & Strength</th>
                  <th className="px-6 py-3">Route</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Markets</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {products.map(prod => (
                  <tr
                    key={prod.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/products/${prod.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-semibold text-indigo-600">
                      {prod.product_code}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{prod.product_name}</div>
                      {prod.brand_name && (
                        <div className="text-xs text-gray-500">Brand: {prod.brand_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {prod.molecules?.canonical_name || prod.generic_name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      <div>{prod.dosage_forms?.name || '—'}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {prod.strength_value !== undefined && prod.strength_value !== null
                          ? `${prod.strength_value} ${prod.strength_units?.symbol || ''}`
                          : prod.strength_raw || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {prod.routes?.name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-medium">
                        {prod.product_category || 'GENERIC'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          prod.lifecycle_status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : prod.lifecycle_status === 'UNDER_DEVELOPMENT'
                            ? 'bg-blue-100 text-blue-800'
                            : prod.lifecycle_status === 'UNDER_EVALUATION'
                            ? 'bg-amber-100 text-amber-800'
                            : prod.lifecycle_status === 'ARCHIVED'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {prod.lifecycle_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {prod.product_countries && prod.product_countries.length > 0 ? (
                          prod.product_countries.slice(0, 3).map((pc: any) => (
                            <span
                              key={pc.country_code}
                              className="px-1.5 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {pc.country_code}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                        {prod.product_countries && prod.product_countries.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{prod.product_countries.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          navigate(`/products/${prod.id}`);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 font-medium inline-flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Create Canonical Product Master</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Duplicate Detection Warning Banner */}
              {duplicateWarning && (
                <div className="p-4 rounded-md border border-amber-300 bg-amber-50">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-amber-900">
                        Potential Duplicate Detected ({duplicateWarning.highestConfidence}% Match)
                      </div>
                      <p className="text-xs text-amber-700">
                        The pharmaceutical product you are entering closely resembles an existing entry in the catalog:
                      </p>
                      <ul className="text-xs text-amber-800 list-disc list-inside mt-1 space-y-0.5">
                        {duplicateWarning.matches.slice(0, 2).map((m: any) => (
                          <li key={m.productId}>
                            <span className="font-semibold">{m.productCode}</span>: {m.productName} —{' '}
                            {m.matchReasons.join(', ')}
                          </li>
                        ))}
                      </ul>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleCreateProduct(true)}
                          disabled={submitting}
                          className="px-2.5 py-1 text-xs font-medium text-amber-900 bg-amber-200 hover:bg-amber-300 rounded border border-amber-400"
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
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-1 text-indigo-700">
                  1. Canonical Identity
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Atorvastatin 20mg Film-Coated Tablets"
                      value={newProductName}
                      onChange={e => setNewProductName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Brand / Proprietary Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Lipitor"
                      value={newBrandName}
                      onChange={e => setNewBrandName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Generic Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Atorvastatin Calcium"
                      value={newGenericName}
                      onChange={e => setNewGenericName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Molecule & Formulation */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-1 text-indigo-700">
                  2. Active Molecule & Strength
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Canonical Molecule (API)
                    </label>
                    <select
                      value={newMoleculeId}
                      onChange={e => setNewMoleculeId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Strength Unit
                    </label>
                    <select
                      value={newStrengthUnitId}
                      onChange={e => setNewStrengthUnitId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
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
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-1 text-indigo-700">
                  3. Presentation & Administration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Dosage Form
                    </label>
                    <select
                      value={newDosageFormId}
                      onChange={e => setNewDosageFormId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Route of Administration
                    </label>
                    <select
                      value={newRouteId}
                      onChange={e => setNewRouteId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
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
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b pb-1 text-indigo-700">
                  4. Commercial & Lifecycle Classification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Product Category
                    </label>
                    <select
                      value={newProductCategory}
                      onChange={e => setNewProductCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                    >
                      <option value="GENERIC">Generic</option>
                      <option value="BRANDED_GENERIC">Branded Generic</option>
                      <option value="INNOVATOR">Innovator</option>
                      <option value="BIOSIMILAR">Biosimilar</option>
                      <option value="COMBINATION_PRODUCT">Combination Product</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Lifecycle Status
                    </label>
                    <select
                      value={newLifecycleStatus}
                      onChange={e => setNewLifecycleStatus(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="UNDER_DEVELOPMENT">Under Development</option>
                      <option value="UNDER_EVALUATION">Under Evaluation</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="DISCONTINUED">Discontinued</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Development State
                    </label>
                    <select
                      value={newDevelopmentStatus}
                      onChange={e => setNewDevelopmentStatus(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                    >
                      <option value="COMMERCIAL">Commercialized</option>
                      <option value="UNDER_DEVELOPMENT">Under Formulation/Tech Transfer</option>
                      <option value="STABILITY_TESTING">Stability Testing</option>
                      <option value="SCALE_UP">Commercial Scale-Up</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Originator Company
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Pfizer"
                      value={newOriginator}
                      onChange={e => setNewOriginator(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Country of Origin
                    </label>
                    <select
                      value={newCountryOrigin}
                      onChange={e => setNewCountryOrigin(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Therapeutic Category
                    </label>
                    <select
                      value={newTherapeuticId}
                      onChange={e => setNewTherapeuticId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Description & Formulation Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter clinical, technical, or regulatory description..."
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateProduct(false)}
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
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
