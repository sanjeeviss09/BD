import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle2, Package, Building, AlertCircle, FileText, Plus, Trash2, ArrowRight,
  Download, Upload, FileSpreadsheet, Paperclip, X
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import * as xlsx from 'xlsx';

export default function RFQCreateWizard() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const templateFileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);

  const [form, setForm] = useState({
    rfq_number: `RFQ-${year}-${randomSuffix}`,
    customer_name: '',
    rfq_type: 'NEW_PRODUCT',
    rfq_date: new Date().toISOString().split('T')[0],
    response_due_date: '',
    priority: 'MEDIUM',
    description: '',
    line_items: [
      { product_name_as_received: '', target_country: 'Global', annual_volume: '', unit: 'Pack', dosage_form: 'TABLET', target_launch_date: '' }
    ]
  });

  const nextStep = () => {
    if (step === 1 && !form.customer_name.trim()) {
      setError('Customer Name is required');
      return;
    }
    setError(null);
    setStep(step + 1);
  };

  const submit = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('http://localhost:4000/api/rfqs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || localStorage.getItem('token')}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create RFQ');
      
      navigate(`/rfqs/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const addLineItem = () => {
    setForm(f => ({
      ...f,
      line_items: [...f.line_items, { product_name_as_received: '', target_country: 'Global', annual_volume: '', unit: 'Pack', dosage_form: 'TABLET', target_launch_date: '' }]
    }));
  };

  const removeLineItem = (idx: number) => {
    setForm(f => ({
      ...f,
      line_items: f.line_items.filter((_, i) => i !== idx)
    }));
  };

  // 1. Download formatted Excel template
  const handleDownloadTemplate = () => {
    const headers = ['Product Name', 'Dosage Form', 'Target Country', 'Annual Volume', 'Unit', 'Target Launch Date'];
    const sampleRows = [
      ['Amoxicillin 500mg Capsules', 'CAPSULE', 'United States', 1000000, 'Pack', '2027-01-15'],
      ['Paracetamol 650mg Tablets', 'TABLET', 'European Union', 2500000, 'Pack', '2026-11-01'],
      ['Ceftriaxone 1g Injection', 'INJECTION', 'Global', 500000, 'Vials', '2027-06-30'],
      ['Ciprofloxacin Eye Drops 0.3%', 'STERILE_LIQUID', 'United Kingdom', 350000, 'Bottles', '2027-03-01'],
      ['Diclofenac Sodium Gel 1%', 'TOPICAL', 'Australia', 400000, 'Tubes', '2026-12-15']
    ];

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...sampleRows]);

    // Set column widths for readability
    ws['!cols'] = [
      { wch: 32 }, // Product Name
      { wch: 18 }, // Dosage Form
      { wch: 18 }, // Target Country
      { wch: 16 }, // Annual Volume
      { wch: 12 }, // Unit
      { wch: 20 }, // Target Launch Date
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Products');
    xlsx.writeFile(wb, 'BDIQ_RFQ_Products_Template.xlsx');
  };

  // 2. Parse uploaded Excel/CSV spreadsheet into line items
  const parseSpreadsheetFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = xlsx.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setError('Spreadsheet contains no sheets.');
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
        if (rows.length === 0) {
          setError('Spreadsheet contains no data rows.');
          return;
        }

        // Helper to locate columns
        const keys = Object.keys(rows[0] || {});
        const findKey = (patterns: string[]): string | undefined => {
          for (const p of patterns) {
            const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p));
            if (found) return found;
          }
          return undefined;
        };

        const prodKey = findKey(['product', 'item', 'name', 'molecule', 'description']) || keys[0];
        const dosageKey = findKey(['dosage', 'form', 'format']);
        const countryKey = findKey(['country', 'market', 'region', 'destination', 'territory']);
        const volKey = findKey(['volume', 'quantity', 'qty', 'demand', 'units', 'packs']);
        const unitKey = findKey(['unit', 'uom', 'pack']);
        const dateKey = findKey(['date', 'launch', 'timeline', 'delivery']);

        const parsedItems: any[] = [];
        for (const r of rows) {
          const rawName = String(r[prodKey] || '').trim();
          if (!rawName) continue;

          const rawVol = volKey ? r[volKey] : '';
          const volNum = rawVol !== '' ? parseFloat(String(rawVol).replace(/[^0-9.]/g, '')) : '';

          parsedItems.push({
            product_name_as_received: rawName,
            dosage_form: dosageKey && r[dosageKey] ? String(r[dosageKey]).toUpperCase().trim() : 'TABLET',
            target_country: countryKey && r[countryKey] ? String(r[countryKey]).trim() : 'Global',
            annual_volume: !isNaN(volNum as any) ? volNum : '',
            unit: unitKey && r[unitKey] ? String(r[unitKey]).trim() : 'Pack',
            target_launch_date: dateKey && r[dateKey] ? String(r[dateKey]).trim() : ''
          });
        }

        if (parsedItems.length === 0) {
          setError('No valid product rows could be detected from the file.');
          return;
        }

        setForm(prev => ({
          ...prev,
          line_items: parsedItems
        }));
        setError(null);
        setImportSuccess(`Successfully imported ${parsedItems.length} product(s) from "${file.name}"`);
        setTimeout(() => setImportSuccess(null), 5000);
      } catch (err: any) {
        setError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleTemplateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseSpreadsheetFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseSpreadsheetFile(file);
    }
  };

  // Step 1 document attachment handler
  const handleDocFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeKb = (file.size / 1024).toFixed(1);
      setAttachedFile({ name: file.name, size: `${sizeKb} KB` });
      
      // If user uploaded an Excel file on Step 1, auto-import items as well!
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        parseSpreadsheetFile(file);
      }
      e.target.value = '';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3 font-sans">
      {/* Hidden file inputs */}
      <input 
        type="file" 
        ref={templateFileInputRef} 
        onChange={handleTemplateFileUpload} 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={docFileInputRef} 
        onChange={handleDocFileUpload} 
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.zip" 
        className="hidden" 
      />

      {/* Compact Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/rfqs')} 
            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Back to RFQ list"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Create New RFQ</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              {form.rfq_number}
            </span>
          </div>
        </div>

        {/* Compact Steps Pill Indicator */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border text-xs font-medium">
          <div 
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
              step === 1 ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-background/20 flex items-center justify-center text-[10px] font-mono">1</span>
            <span>Basic Info</span>
          </div>
          <div 
            onClick={() => form.customer_name.trim() && setStep(2)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              step === 2 
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                : step > 2 
                ? 'text-emerald-500 cursor-pointer' 
                : 'text-muted-foreground cursor-pointer'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-background/20 flex items-center justify-center text-[10px] font-mono">2</span>
            <span>Line Items ({form.line_items.length})</span>
          </div>
          <div 
            onClick={() => form.customer_name.trim() && setStep(3)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              step === 3 ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground cursor-pointer'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-background/20 flex items-center justify-center text-[10px] font-mono">3</span>
            <span>Review</span>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-xs text-destructive animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {importSuccess && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between text-xs text-emerald-500 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{importSuccess}</span>
          </div>
          <button type="button" onClick={() => setImportSuccess(null)} className="text-emerald-500 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STEP 1: Basic Information */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Customer & Commercial Details
              </h2>
            </div>
            
            {/* Quick Template Download shortcut on Step 1 */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border border-border transition-colors cursor-pointer"
              title="Download standard Excel format for products"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Get Products Template</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Customer Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">
                Customer Name <span className="text-destructive">*</span>
              </label>
              <input 
                type="text" 
                value={form.customer_name}
                onChange={e => setForm({...form, customer_name: e.target.value})}
                className="w-full h-9 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                placeholder="e.g. Pfizer, Novartis, Teva Commercial"
                autoFocus
              />
            </div>

            {/* RFQ Type */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">RFQ Type</label>
              <select
                value={form.rfq_type}
                onChange={e => setForm({...form, rfq_type: e.target.value})}
                className="w-full h-9 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              >
                <option value="NEW_PRODUCT">New Product Introduction</option>
                <option value="TECH_TRANSFER">Technology Transfer</option>
                <option value="COMMERCIAL_SUPPLY">Commercial Supply</option>
                <option value="CLINICAL_TRIAL">Clinical Trial Supply</option>
              </select>
            </div>

            {/* Received Date */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Received Date</label>
              <input 
                type="date" 
                value={form.rfq_date}
                onChange={e => setForm({...form, rfq_date: e.target.value})}
                className="w-full h-9 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors font-mono"
              />
            </div>

            {/* Response Due Date */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Response Due Date</label>
              <input 
                type="date" 
                value={form.response_due_date}
                onChange={e => setForm({...form, response_due_date: e.target.value})}
                className="w-full h-9 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors font-mono"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({...form, priority: e.target.value})}
                className="w-full h-9 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors font-mono"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {/* Description / Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Description / Notes</label>
              <textarea 
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                className="w-full h-16 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none"
                placeholder="Add any customer background, packaging constraints, or commercial context..."
              />
            </div>

            {/* Document Attachment Upload Zone */}
            <div className="sm:col-span-1 flex flex-col justify-end">
              <label className="block text-xs font-medium text-foreground mb-1">Attach Tender / RFQ File</label>
              {attachedFile ? (
                <div className="h-16 p-2 rounded-lg border border-border bg-muted/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="w-4 h-4 text-primary shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-xs text-foreground block truncate">{attachedFile.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{attachedFile.size}</span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setAttachedFile(null)} 
                    className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-muted"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => docFileInputRef.current?.click()}
                  className="h-16 border border-dashed border-border hover:border-primary/60 rounded-lg p-2 flex flex-col items-center justify-center text-center cursor-pointer bg-background hover:bg-muted/20 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
                  <span className="text-[11px] font-medium text-foreground">Attach Document / Excel</span>
                  <span className="text-[9px] text-muted-foreground">PDF, Word, or Excel</span>
                </div>
              )}
            </div>
          </div>

          {/* Docked Card Footer */}
          <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-mono">
              Step 1 of 3 · Customer & Commercial Specs
            </span>
            <button 
              type="button"
              onClick={nextStep} 
              className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Continue to Line Items</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Products / Line Items (With Template Download & Upload) */}
      {step === 2 && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`bg-card border rounded-xl p-4 sm:p-5 shadow-xs animate-in fade-in duration-150 transition-colors ${
            isDragging ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border'
          }`}
        >
          {/* Header with Template Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-border gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Products & Target Quantities ({form.line_items.length})
              </h2>
            </div>

            {/* Template Download & Upload Action Group */}
            <div className="flex items-center flex-wrap gap-1.5">
              <button 
                type="button"
                onClick={handleDownloadTemplate} 
                className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Download sample Excel template"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Download Template</span>
              </button>

              <button 
                type="button"
                onClick={() => templateFileInputRef.current?.click()} 
                className="h-8 px-2.5 rounded-lg border border-border bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Upload filled Excel or CSV template"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Template</span>
              </button>

              <button 
                type="button"
                onClick={addLineItem} 
                className="h-8 px-2.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          {/* Quick Helper Dropzone Strip */}
          <div 
            onClick={() => templateFileInputRef.current?.click()}
            className="mb-2.5 px-3 py-1.5 bg-muted/30 border border-dashed border-border rounded-lg flex items-center justify-between text-xs text-muted-foreground hover:border-primary/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Have a list of products? Click to upload or drag & drop <strong>.xlsx / .csv</strong> file</span>
            </div>
            <span className="text-[11px] font-mono text-primary underline">Browse files</span>
          </div>
          
          {/* Scrollable container for line items */}
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {form.line_items.map((item, idx) => (
              <div key={idx} className="p-2.5 bg-muted/40 rounded-lg border border-border text-xs relative">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-mono font-bold text-foreground">
                    Item #{idx + 1}
                  </span>
                  {form.line_items.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeLineItem(idx)} 
                      className="text-destructive hover:text-destructive/80 text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">
                      Product Name (As Received)
                    </label>
                    <input 
                      type="text" 
                      value={item.product_name_as_received}
                      onChange={e => {
                        const newItems = [...form.line_items];
                        newItems[idx].product_name_as_received = e.target.value;
                        setForm({...form, line_items: newItems});
                      }}
                      className="w-full h-8 bg-background border border-border rounded px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="e.g. Paracetamol 500mg Tablets"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Dosage Form</label>
                    <select
                      value={item.dosage_form}
                      onChange={e => {
                        const newItems = [...form.line_items];
                        newItems[idx].dosage_form = e.target.value;
                        setForm({...form, line_items: newItems});
                      }}
                      className="w-full h-8 bg-background border border-border rounded px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="TABLET">TABLET</option>
                      <option value="CAPSULE">CAPSULE</option>
                      <option value="ORAL_LIQUID">ORAL LIQUID</option>
                      <option value="INJECTION">INJECTION</option>
                      <option value="LYOPHILIZED_INJECTION">LYO INJECTION</option>
                      <option value="STERILE_LIQUID">STERILE LIQUID</option>
                      <option value="TOPICAL">TOPICAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Target Country</label>
                    <input 
                      type="text" 
                      value={item.target_country}
                      onChange={e => {
                        const newItems = [...form.line_items];
                        newItems[idx].target_country = e.target.value;
                        setForm({...form, line_items: newItems});
                      }}
                      className="w-full h-8 bg-background border border-border rounded px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Global / US / EU"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Annual Volume</label>
                    <input 
                      type="number" 
                      value={item.annual_volume}
                      onChange={e => {
                        const newItems = [...form.line_items];
                        newItems[idx].annual_volume = e.target.value;
                        setForm({...form, line_items: newItems});
                      }}
                      className="w-full h-8 bg-background border border-border rounded px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                      placeholder="e.g. 500000"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Unit</label>
                    <input 
                      type="text" 
                      value={item.unit}
                      onChange={e => {
                        const newItems = [...form.line_items];
                        newItems[idx].unit = e.target.value;
                        setForm({...form, line_items: newItems});
                      }}
                      className="w-full h-8 bg-background border border-border rounded px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Pack / Units / Vials"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Docked Card Footer */}
          <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
            <button 
              type="button"
              onClick={() => setStep(1)} 
              className="h-9 px-4 border border-border hover:bg-muted text-foreground text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Back
            </button>
            <button 
              type="button"
              onClick={() => setStep(3)} 
              className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Review Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Submit */}
      {step === 3 && (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Review RFQ Dossier & Commit
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Customer Summary Card */}
            <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
              <span className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
                Commercial Summary
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Customer</span>
                  <span className="font-semibold text-foreground text-xs">{form.customer_name}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">RFQ Number</span>
                  <span className="font-mono text-foreground text-xs">{form.rfq_number}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">RFQ Type</span>
                  <span className="font-mono text-foreground text-xs">{form.rfq_type}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Priority</span>
                  <span className="font-mono text-foreground text-xs">{form.priority}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Received Date</span>
                  <span className="font-mono text-foreground text-xs">{form.rfq_date}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Response Due</span>
                  <span className="font-mono text-foreground text-xs">{form.response_due_date || 'Not specified'}</span>
                </div>
                {attachedFile && (
                  <div className="col-span-2 pt-1 border-t border-border">
                    <span className="text-[11px] text-muted-foreground block">Attached File</span>
                    <span className="font-medium text-foreground text-xs flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-primary" />
                      {attachedFile.name} ({attachedFile.size})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Summary Card */}
            <div className="bg-muted/30 rounded-lg border border-border p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-mono uppercase text-muted-foreground font-semibold">
                    Products ({form.line_items.length})
                  </span>
                </div>
                <div className="space-y-1.5 pt-1 max-h-[140px] overflow-y-auto pr-1">
                  {form.line_items.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 px-2 rounded bg-background border border-border text-[11px]">
                      <span className="font-medium text-foreground truncate max-w-[150px]">
                        {i.product_name_as_received || 'Unnamed Product'}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {i.annual_volume ? `${Number(i.annual_volume).toLocaleString()} ${i.unit}` : 'Vol TBD'} · {i.target_country}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Docked Card Footer */}
          <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
            <button 
              type="button"
              onClick={() => setStep(2)} 
              className="h-9 px-4 border border-border hover:bg-muted text-foreground text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Back
            </button>
            <button 
              type="button"
              onClick={submit} 
              disabled={loading}
              className="h-9 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? 'Creating...' : 'Create RFQ'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
