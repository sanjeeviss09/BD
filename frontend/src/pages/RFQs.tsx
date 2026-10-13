import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Plus, 
  Upload, 
  Settings,
  X,
  Trash2,
  Calendar,
  Building,
  CheckCircle2,
  Download,
  Layers,
  RefreshCw,
  Scale
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import * as xlsx from 'xlsx';


interface LineItemInput {
  product_name: string;
  target_country: string;
  quantity: number | string;
  unit: string;
  required_date: string;
}

import { useNavigate } from 'react-router-dom';

export default function RFQs() {
  const { session } = useAuth();
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<any | null>(null);

  // Create Form State
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    rfq_number: '',
    customer_name: '',
    rfq_date: new Date().toISOString().split('T')[0],
    response_due_date: '',
    priority: 'MEDIUM',
    description: '',
    line_items: [
      { product_name: '', target_country: 'Global', quantity: '', unit: 'Pack', required_date: '' }
    ] as LineItemInput[],
  });

  // Upload Wizard State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadedAxxelentFile, setUploadedAxxelentFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState({
    rfq_number: '',
    customer_name: '',
    response_due_date: '',
    priority: 'MEDIUM',
    sheetName: '',
  });
  const [inspectionData, setInspectionData] = useState<any | null>(null);
  const [columnMapping, setColumnMapping] = useState({
    productField: '',
    countryField: '',
    quantityField: '',
    unitField: '',
    dateField: '',
  });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'SELECT' | 'PREVIEW' | 'IMPORTING'>('SELECT');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCode, setNewTemplateCode] = useState('');

  const getAuthToken = () => {
    return session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
  };

  const getHeaders = () => ({
    'Authorization': `Bearer ${getAuthToken()}`,
  });

  useEffect(() => {
    fetchRFQs();
  }, [session?.access_token]);

  const fetchRFQs = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/rfqs', {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setRfqs(data || []);
      }
    } catch (error) {
      console.error('Error fetching RFQs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/rfqs/templates', {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data || []);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const navigate = useNavigate();

  // Open Create Modal & generate initial RFQ number
  const openCreateModal = () => {
    navigate('/rfqs/create');
  };

  const addLineItem = () => {
    setCreateForm(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        { product_name: '', target_country: 'Global', quantity: '', unit: 'Pack', required_date: '' }
      ]
    }));
  };

  const removeLineItem = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, idx) => idx !== index)
    }));
  };

  const updateLineItem = (index: number, field: keyof LineItemInput, value: any) => {
    setCreateForm(prev => {
      const nextItems = [...prev.line_items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, line_items: nextItems };
    });
  };

  const handleDownloadTemplate = () => {
    const ws = xlsx.utils.json_to_sheet([
      { Product: 'Atorvastatin 20mg', Country: 'Global', Quantity: 50000, Unit: 'Pack' },
      { Product: 'Semaglutide 1mg', Country: 'US', Quantity: 10000, Unit: 'Vial' }
    ]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Line_Items");
    xlsx.writeFile(wb, "BDIQ_Commercial_Line_Items_Template.xlsx");
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        try {
          const data = await file.arrayBuffer();
          const workbook = xlsx.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = xlsx.utils.sheet_to_json(worksheet) as any[];
          
          const newItems = json.map(row => ({
            product_name: row.Product || '',
            target_country: row.Country || 'Global',
            quantity: row.Quantity ? String(row.Quantity) : '',
            unit: row.Unit || 'Pack',
            required_date: ''
          })).filter(item => item.product_name.trim() !== '');
          
          if (newItems.length > 0) {
            setCreateForm(prev => {
              // If there's only one empty item, replace it
              if (prev.line_items.length === 1 && prev.line_items[0].product_name === '') {
                return { ...prev, line_items: newItems };
              }
              return { ...prev, line_items: [...prev.line_items, ...newItems] };
            });
          }
        } catch (err) {
          console.error('Failed to parse line items template', err);
        }
      }
      // Reset input
      e.target.value = '';
    }
  };


  const handleCreateRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.rfq_number.trim() || !createForm.customer_name.trim()) {
      alert('RFQ Number and Customer Name are required.');
      return;
    }

    setCreateSubmitting(true);
    try {
      const payload = {
        rfq_number: createForm.rfq_number.trim(),
        customer_name: createForm.customer_name.trim(),
        rfq_date: createForm.rfq_date,
        response_due_date: createForm.response_due_date || null,
        priority: createForm.priority,
        description: createForm.description,
        line_items: createForm.line_items
          .filter(item => item.product_name.trim() !== '')
          .map(item => ({
            product_name: item.product_name.trim(),
            target_country: item.target_country.trim() || 'Global',
            quantity: item.quantity ? Number(item.quantity) : 0,
            unit: item.unit || 'Pack',
            required_date: item.required_date || null,
          })),
      };

      const res = await fetch('http://localhost:4000/api/rfqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowCreateModal(false);
        fetchRFQs();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to create RFQ: ${errData.error?.message || errData.error || 'Server error'}`);
      }
    } catch (err: any) {
      console.error('Error creating RFQ:', err);
      alert('Failed to connect to server to create RFQ.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Upload & File Inspection Flow
  const handleFileSelect = async (file: File) => {
    setUploadFile(file);
    const suggestedRfqNumber = `RFQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const suggestedCustomer = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    setUploadMeta(prev => ({
      ...prev,
      rfq_number: suggestedRfqNumber,
      customer_name: suggestedCustomer,
    }));

    // Inspect file in backend
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:4000/api/rfqs/templates/inspect', {
        method: 'POST',
        headers: getHeaders(),
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setInspectionData(data);
        if (data.sheets && data.sheets.length > 0) {
          const primary = data.sheets[0];
          setUploadMeta(prev => ({ ...prev, sheetName: primary.sheetName }));
          const findH = (patterns: string[]) => {
            const found = primary.headers?.find((h: string) => {
              const cleaned = h.toLowerCase().replace(/[^a-z0-9]/g, '');
              return patterns.some(p => cleaned.includes(p));
            });
            return found || '';
          };

          setColumnMapping({
            productField: findH(['product', 'molecule', 'drug', 'item', 'description', 'name', 'api']),
            countryField: findH(['country', 'market', 'region', 'target', 'destination', 'territory']),
            quantityField: findH(['quantity', 'qty', 'volume', 'demand', 'units', 'packs']),
            unitField: findH(['unit', 'uom', 'pack', 'dosage', 'format', 'measure']),
            dateField: findH(['date', 'due', 'delivery', 'required', 'timeline']),
          });
        }
        setUploadStep('PREVIEW');
      } else {
        alert('Could not parse the selected file. Please ensure it is a valid Excel or CSV spreadsheet.');
      }
    } catch (err) {
      console.error('File inspect error:', err);
      alert('Error parsing uploaded file format.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadStep('IMPORTING');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadMeta.rfq_number && uploadMeta.rfq_number !== 'undefined') {
        formData.append('rfqNumber', uploadMeta.rfq_number);
      }
      if (uploadMeta.customer_name && uploadMeta.customer_name !== 'undefined') {
        formData.append('customerName', uploadMeta.customer_name);
      }
      if (uploadMeta.response_due_date && uploadMeta.response_due_date !== 'undefined') {
        formData.append('responseDueDate', uploadMeta.response_due_date);
      }
      if (uploadMeta.priority && uploadMeta.priority !== 'undefined') {
        formData.append('priority', uploadMeta.priority);
      }
      if (uploadMeta.sheetName && uploadMeta.sheetName !== 'undefined') {
        formData.append('sheetName', uploadMeta.sheetName);
      }
      if (columnMapping) {
        formData.append('mapping', JSON.stringify(columnMapping));
      }

      const res = await fetch('http://localhost:4000/api/rfqs/import', {
        method: 'POST',
        headers: getHeaders(),
        body: formData,
      });

      if (res.ok) {
        await res.json();
        setShowUploadModal(false);
        setUploadFile(null);
        setInspectionData(null);
        setUploadStep('SELECT');
        fetchRFQs();
      } else {
        const err = await res.json().catch(() => ({}));
        const errMsg = err.error?.message || err.error || err.message || 'Server error occurred during import';
        alert(`Import failed: ${errMsg}`);
        setUploadStep('PREVIEW');
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import RFQ file.');
      setUploadStep('PREVIEW');
    } finally {
      setUploadLoading(false);
    }
  };

  // Export RFQ Excel
  const handleExportRfq = async (rfqId: string, rfqNumber: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/rfqs/${rfqId}/export`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${rfqNumber}_Export.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Could not export RFQ.');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to download RFQ Excel export.');
    }
  };

  // Status Updater in Detail View
  const handleUpdateStatus = async (rfqId: string, newStatus: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/rfqs/${rfqId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedRfq(updated);
        setRfqs(prev => prev.map(r => r.id === rfqId ? { ...r, status: newStatus } : r));
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  // Create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;

    try {
      const res = await fetch('http://localhost:4000/api/rfqs/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({
          template_name: newTemplateName.trim(),
          template_code: newTemplateCode.trim() || `TPL-${Date.now().toString(36).toUpperCase()}`,
          description: 'Custom commercial RFQ template specification',
        }),
      });
      if (res.ok) {
        setNewTemplateName('');
        setNewTemplateCode('');
        fetchTemplates();
      }
    } catch (err) {
      console.error('Create template error:', err);
    }
  };

  // Filtering
  const filteredRfqs = rfqs.filter(rfq => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || (
      (rfq.rfq_number || '').toLowerCase().includes(q) ||
      (rfq.customer_name || '').toLowerCase().includes(q) ||
      (rfq.description || '').toLowerCase().includes(q) ||
      (rfq.line_items || []).some((item: any) => 
        (item.product_name || item.target_country || '').toLowerCase().includes(q)
      )
    );

    const matchStatus = statusFilter === 'ALL' || rfq.status === statusFilter;
    const matchPriority = priorityFilter === 'ALL' || rfq.priority === priorityFilter;

    return matchSearch && matchStatus && matchPriority;
  });

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in">
      {/* Top Header */}
      <header className="flex-none px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Request For Quotation (RFQ)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage commercial requirements, configurations, and customer formats
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setUploadStep('SELECT');
                setUploadFile(null);
                setInspectionData(null);
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shadow-sm cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload RFQ
            </button>
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create RFQ
            </button>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search RFQs by number, customer, product..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                showFilters || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => { setRefreshing(true); fetchRFQs(); }}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors cursor-pointer"
              title="Refresh RFQs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                fetchTemplates();
                setShowTemplatesModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              Manage Templates
            </button>
          </div>
        </div>

        {/* Filter Drawer / Dropdowns */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-4 text-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Status:</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-background border border-border rounded px-2.5 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="QUOTED">Quoted</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Priority:</span>
              <select 
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-background border border-border rounded px-2.5 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => { setStatusFilter('ALL'); setPriorityFilter('ALL'); setSearchQuery(''); }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-xs text-muted-foreground">Loading commercial RFQ portfolio...</p>
          </div>
        ) : filteredRfqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 max-w-md mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6 shadow-sm">
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'No matching RFQs found'
                : 'No RFQs have been created yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-8">
              {searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'Try adjusting your filters or search keywords to find specific RFQs.'
                : 'Create an RFQ manually or upload a completed customer format to begin the commercial evaluation process.'}
            </p>
            <div className="flex items-center gap-4">
              <button 
                onClick={openCreateModal}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
              >
                Create RFQ
              </button>
              <button 
                onClick={() => {
                  setUploadStep('SELECT');
                  setUploadFile(null);
                  setInspectionData(null);
                  setShowUploadModal(true);
                }}
                className="px-6 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors shadow-sm cursor-pointer"
              >
                Upload RFQ
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border text-xs uppercase font-mono text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">RFQ Number</th>
                    <th className="px-6 py-3 font-semibold">Customer</th>
                    <th className="px-6 py-3 font-semibold">Items & Products</th>
                    <th className="px-6 py-3 font-semibold">Due Date</th>
                    <th className="px-6 py-3 font-semibold">Priority</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRfqs.map((rfq) => {
                    const lineItems = rfq.line_items || [];
                    const firstProduct = lineItems[0]?.product_name || lineItems[0]?.product?.product_name;

                    return (
                      <tr key={rfq.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4 font-mono font-medium text-foreground">
                          <button
                            onClick={() => navigate('/rfqs/' + rfq.id)}
                            className="text-primary hover:underline font-bold text-left cursor-pointer"
                          >
                            {rfq.rfq_number}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Building className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{rfq.customer_name || 'Generic Customer'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          <div className="text-foreground font-medium">
                            {firstProduct || `${lineItems.length} items`}
                          </div>
                          {lineItems.length > 1 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              +{lineItems.length - 1} more items
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                          {rfq.response_due_date ? (
                            <div className="flex items-center gap-1.5 text-foreground">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              {rfq.response_due_date}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">Not specified</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            rfq.priority === 'URGENT' ? 'bg-destructive/15 text-destructive border border-destructive/20' :
                            rfq.priority === 'HIGH' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/20' :
                            rfq.priority === 'LOW' ? 'bg-muted text-muted-foreground border border-border' :
                            'bg-primary/10 text-primary border border-primary/20'
                          }`}>
                            {rfq.priority || 'MEDIUM'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider bg-secondary/50 text-secondary-foreground border border-border">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              rfq.status === 'WON' ? 'bg-emerald-500' :
                              rfq.status === 'LOST' ? 'bg-destructive' :
                              rfq.status === 'QUOTED' ? 'bg-blue-500' :
                              rfq.status === 'IN_REVIEW' ? 'bg-amber-500' :
                              'bg-muted-foreground'
                            }`} />
                            {rfq.status || 'DRAFT'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href="/commercial-evaluation"
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors cursor-pointer"
                              title="Evaluate Commercial Feasibility (Step 18)"
                            >
                              <Scale className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleExportRfq(rfq.id, rfq.rfq_number)}
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors cursor-pointer"
                              title="Export Excel"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSelectedRfq(rfq)}
                              className="px-3 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded hover:bg-secondary/80 transition-colors cursor-pointer"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
              <span>Showing {filteredRfqs.length} of {rfqs.length} total RFQs</span>
              <span>Template-driven multi-tenant architecture</span>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* CREATE RFQ MODAL */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Create Request For Quotation</h2>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRFQ} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider font-mono">
                    RFQ Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.rfq_number}
                    onChange={(e) => setCreateForm({ ...createForm, rfq_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                    placeholder="e.g. RFQ-2026-0042"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider font-mono">
                    Customer / Organization *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.customer_name}
                    onChange={(e) => setCreateForm({ ...createForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                    placeholder="e.g. Novartis Commercial AG"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider font-mono">
                    Response Due Date
                  </label>
                  <input
                    type="date"
                    value={createForm.response_due_date}
                    onChange={(e) => setCreateForm({ ...createForm, response_due_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-1 focus:ring-primary focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider font-mono">
                    Priority
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-end mb-1">
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                  Description / Commercial Scope
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">or upload customer RFQ</span>
                  <label className="flex items-center gap-1.5 px-3 py-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[10px] font-semibold rounded-md cursor-pointer transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload Axxelent RFQ Format</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".xlsx,.xls,.pdf,.docx" 
                      onChange={async (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const file = e.target.files[0];
                          setUploadedAxxelentFile(file);
                          
                          // If it's an Excel file, try to extract some text
                          if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                            try {
                              const data = await file.arrayBuffer();
                              const workbook = xlsx.read(data);
                              const firstSheetName = workbook.SheetNames[0];
                              const worksheet = workbook.Sheets[firstSheetName];
                              // Convert sheet to text, joining cells with space and rows with newline
                              const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                              const text = json.map((row: any) => row.join(' ')).join('\n');
                              
                              if (text.trim()) {
                                setCreateForm(prev => ({
                                  ...prev,
                                  description: prev.description ? prev.description + '\n\n---\nExtracted from ' + file.name + ':\n' + text : 'Extracted from ' + file.name + ':\n' + text
                                }));
                              }
                            } catch (err) {
                              console.error('Failed to parse excel file', err);
                            }
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              
              <textarea
                rows={2}
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-1 focus:ring-primary focus:outline-none mb-2"
                placeholder="Outline client evaluation terms, delivery requirements, or tenders..."
              />
              {uploadedAxxelentFile && (
                <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-md">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 bg-primary/10 rounded-md text-primary shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-foreground truncate">{uploadedAxxelentFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(uploadedAxxelentFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedAxxelentFile(null)}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Line Items Builder */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      Commercial Line Items ({createForm.line_items.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Specify products, target jurisdictions, delivery quantities, and packaging units.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Template
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Upload
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".xlsx,.xls" 
                        onChange={handleUploadTemplate}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Line
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {createForm.line_items.map((item, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-muted/30 border border-border rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                    >
                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                          Product / Molecule *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.product_name}
                          onChange={(e) => updateLineItem(idx, 'product_name', e.target.value)}
                          placeholder="e.g. Atorvastatin 20mg"
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                          Country / Market
                        </label>
                        <input
                          type="text"
                          value={item.target_country}
                          onChange={(e) => updateLineItem(idx, 'target_country', e.target.value)}
                          placeholder="e.g. Germany"
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                          placeholder="50000"
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                          Unit
                        </label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="Pack">Pack</option>
                          <option value="Vials">Vials</option>
                          <option value="Tablets">Tablets</option>
                          <option value="Capsules">Capsules</option>
                          <option value="Kilograms">Kilograms</option>
                          <option value="Litres">Litres</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          disabled={createForm.line_items.length === 1}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title="Remove Line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setUploadedAxxelentFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {createSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {createSubmitting ? 'Creating RFQ...' : 'Create RFQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UPLOAD RFQ WIZARD MODAL */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Upload Customer RFQ File</h2>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {uploadStep === 'SELECT' && (
                <div className="space-y-6">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/20"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Click to choose an Excel or CSV file
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Supports customer formats (.xlsx, .xls, .csv up to 25MB)
                    </p>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium rounded-full bg-secondary text-secondary-foreground border border-border">
                      Multi-Sheet & Automated Column Mapping Engine
                    </div>
                  </div>

                  {uploadLoading && (
                    <div className="flex items-center justify-center gap-3 p-4 bg-muted/30 rounded-lg">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs font-medium text-foreground">Inspecting template format and parsing sheet columns...</span>
                    </div>
                  )}
                </div>
              )}

              {uploadStep === 'PREVIEW' && inspectionData && (
                <div className="space-y-6">
                  {/* RFQ Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 border border-border rounded-lg">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                        Assigned RFQ Number
                      </label>
                      <input
                        type="text"
                        value={uploadMeta.rfq_number}
                        onChange={(e) => setUploadMeta({ ...uploadMeta, rfq_number: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded font-mono text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={uploadMeta.customer_name}
                        onChange={(e) => setUploadMeta({ ...uploadMeta, customer_name: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground"
                      />
                    </div>
                  </div>

                  {/* Sheet Selector */}
                  {inspectionData.sheets.length > 1 && (
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Select Target Sheet
                      </label>
                      <select
                        value={uploadMeta.sheetName}
                        onChange={(e) => {
                          const sName = e.target.value;
                          setUploadMeta({ ...uploadMeta, sheetName: sName });
                        }}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground"
                      >
                        {inspectionData.sheets.map((s: any) => (
                          <option key={s.sheetName} value={s.sheetName}>
                            {s.sheetName} ({s.rowCount} rows)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Column Mapping Matrix */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center justify-between">
                      <span>Column Mapping Configuration</span>
                      <span className="text-xs font-normal text-muted-foreground font-mono">
                        Auto-detected from file headers
                      </span>
                    </h3>

                    {(() => {
                      const curSheet = inspectionData.sheets.find((s: any) => s.sheetName === uploadMeta.sheetName) || inspectionData.primarySheet;
                      const availableHeaders: string[] = curSheet?.headers || [];

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/10 p-4 border border-border rounded-lg">
                          <div>
                            <label className="block text-xs text-foreground mb-1">
                              Product / Molecule Column *
                            </label>
                            <select
                              value={columnMapping.productField}
                              onChange={(e) => setColumnMapping({ ...columnMapping, productField: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground"
                            >
                              <option value="">-- Choose Column --</option>
                              {availableHeaders.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-foreground mb-1">
                              Target Country Column
                            </label>
                            <select
                              value={columnMapping.countryField}
                              onChange={(e) => setColumnMapping({ ...columnMapping, countryField: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground"
                            >
                              <option value="">-- Choose Column --</option>
                              {availableHeaders.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-foreground mb-1">
                              Quantity Column
                            </label>
                            <select
                              value={columnMapping.quantityField}
                              onChange={(e) => setColumnMapping({ ...columnMapping, quantityField: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground"
                            >
                              <option value="">-- Choose Column --</option>
                              {availableHeaders.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-foreground mb-1">
                              Unit / Pack Column
                            </label>
                            <select
                              value={columnMapping.unitField}
                              onChange={(e) => setColumnMapping({ ...columnMapping, unitField: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground"
                            >
                              <option value="">-- Choose Column --</option>
                              {availableHeaders.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Sample Rows Preview */}
                  {(() => {
                    const curSheet = inspectionData.sheets.find((s: any) => s.sheetName === uploadMeta.sheetName) || inspectionData.primarySheet;
                    const sampleRows = curSheet?.sampleRows || [];

                    if (sampleRows.length === 0) return null;

                    const previewCols = Object.keys(sampleRows[0] || {}).slice(0, 5);

                    return (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 font-mono">
                          File Preview (First {sampleRows.length} rows)
                        </h4>
                        <div className="overflow-x-auto border border-border rounded-lg">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted text-muted-foreground font-mono">
                              <tr>
                                {previewCols.map(col => (
                                  <th key={col} className="px-3 py-2 border-b border-border">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {sampleRows.map((r: any, idx: number) => (
                                <tr key={idx} className="hover:bg-muted/30">
                                  {previewCols.map(col => (
                                    <td key={col} className="px-3 py-1.5 text-foreground">{String(r[col] ?? '')}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setUploadStep('SELECT')}
                      className="px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-muted cursor-pointer"
                    >
                      Back to file select
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      disabled={uploadLoading}
                      className="px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
                    >
                      {uploadLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Importing & Creating RFQ...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm & Import RFQ
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MANAGE TEMPLATES MODAL */}
      {/* ========================================================================= */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">RFQ Template Architecture</h2>
              </div>
              <button 
                onClick={() => setShowTemplatesModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Existing Templates */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Active Organization Templates</h3>
                {templatesLoading ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="p-4 bg-muted/20 border border-border rounded-lg text-center text-xs text-muted-foreground">
                    No custom templates configured. Default template is automatically provided.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(tpl => (
                      <div key={tpl.id} className="p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <span>{tpl.template_name}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {tpl.template_code}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {tpl.status || 'ACTIVE'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create Template Form */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">Register Custom Template Format</h3>
                <form onSubmit={handleCreateTemplate} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                        Template Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="e.g. EU Tender Format"
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted-foreground mb-1">
                        Template Code
                      </label>
                      <input
                        type="text"
                        value={newTemplateCode}
                        onChange={(e) => setNewTemplateCode(e.target.value)}
                        placeholder="e.g. TPL-EU-01"
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
                  >
                    Save Template
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RFQ DETAIL SLIDE-OVER DRAWER */}
      {/* ========================================================================= */}
      {selectedRfq && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border-l border-border shadow-2xl w-full max-w-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold text-foreground font-mono">{selectedRfq.rfq_number}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{selectedRfq.customer_name}</span>
                    <span>•</span>
                    <span>{selectedRfq.rfq_date}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportRfq(selectedRfq.id, selectedRfq.rfq_number)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .XLSX
                </button>
                <button 
                  onClick={() => setSelectedRfq(null)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status & Priority Badge Strip */}
              <div className="p-4 bg-muted/20 border border-border rounded-lg flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Status:</span>
                  <select
                    value={selectedRfq.status || 'DRAFT'}
                    onChange={(e) => handleUpdateStatus(selectedRfq.id, e.target.value)}
                    className="bg-background border border-border rounded px-2.5 py-1 text-xs font-mono font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="IN_REVIEW">IN REVIEW</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="QUOTED">QUOTED</option>
                    <option value="WON">WON</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Priority:</span>
                  <span className="text-xs font-mono font-semibold text-foreground px-2 py-0.5 rounded bg-primary/10">
                    {selectedRfq.priority || 'MEDIUM'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Due Date:</span>
                  <span className="text-xs font-mono text-foreground">
                    {selectedRfq.response_due_date || 'None'}
                  </span>
                </div>
              </div>

              {/* Description */}
              {selectedRfq.description && (
                <div>
                  <h4 className="text-xs font-mono uppercase text-muted-foreground mb-1">Scope & Notes</h4>
                  <p className="text-sm text-foreground bg-muted/10 p-3 rounded-lg border border-border">
                    {selectedRfq.description}
                  </p>
                </div>
              )}

              {/* Line Items Table */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-2 flex items-center justify-between">
                  <span>Line Items ({(selectedRfq.line_items || []).length})</span>
                </h4>

                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-mono">
                      <tr>
                        <th className="px-4 py-2.5">Product / Molecule</th>
                        <th className="px-4 py-2.5">Country</th>
                        <th className="px-4 py-2.5">Quantity</th>
                        <th className="px-4 py-2.5">Required Date</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(selectedRfq.line_items || []).map((item: any, idx: number) => (
                        <tr key={item.id || idx} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {item.product_name || item.product?.product_name || 'Commercial Item'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {item.target_country || 'Global'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-foreground">
                            {item.quantity ? `${item.quantity.toLocaleString()} ${item.unit || ''}` : 'N/A'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground">
                            {item.required_date || 'N/A'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary text-secondary-foreground">
                              {item.line_item_status || 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
