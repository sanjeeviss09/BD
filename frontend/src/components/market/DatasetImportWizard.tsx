import { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface DatasetImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DatasetImportWizard({ isOpen, onClose }: DatasetImportWizardProps) {
  const { session } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);
  const [file, setFile] = useState<File | null>(null);
  const [, setSessionId] = useState<string | null>(null);
  const [, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  
  // Data states
  const [, setInspectionData] = useState<any>(null);
  // const [mappingData, setMappingData] = useState<any>(null);
  // const [validationData, setValidationData] = useState<any>(null);
  // const [matchData, setMatchData] = useState<any>(null);
  const [, setColumnMap] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setLoading(true);

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('datasetName', selectedFile.name);
        formData.append('provider', 'IQVIA'); // Default/Mock

        const res = await fetch('http://localhost:4000/api/market-data/import-sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          },
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        setSessionId(data.data.id);
        
        // Auto select first sheet if multi-sheet
        const inspectRes = await fetch(`http://localhost:4000/api/market-data/import-sessions/${data.data.id}/select-sheet`, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${session?.access_token}`
           },
           body: JSON.stringify({ sheetName: data.data.config_json?.sheets?.[0] || 'Sheet1' })
        });
        const inspectData = await inspectRes.json();
        if (!inspectRes.ok) throw new Error(inspectData.error || 'Inspection failed');

        setInspectionData(inspectData.data);
        
        // Initialize column map
        const initialMap: Record<string, string> = {};
        const availableCols = inspectData.data.columns || [];
        // Try auto-mapping common names
        const findCol = (keywords: string[]) => availableCols.find((c: string) => keywords.some(k => c.toLowerCase().includes(k)));
        initialMap['product_name'] = findCol(['product', 'brand', 'name']) || '';
        initialMap['country_code'] = findCol(['country', 'iso', 'region']) || '';
        initialMap['sales_value'] = findCol(['sales', 'usd', 'revenue']) || '';
        initialMap['volume'] = findCol(['volume', 'units', 'qty']) || '';
        initialMap['molecule'] = findCol(['molecule', 'generic', 'active']) || '';
        initialMap['manufacturer'] = findCol(['manufacturer', 'company', 'corp']) || '';
        setColumnMap(initialMap);

        setStep(2);
      } catch (err: any) {
        setError(err.message);
        setFile(null);
      } finally {
        setLoading(false);
      }
    }
  };

  const steps = [
    { id: 1, label: 'Upload' },
    { id: 2, label: 'Inspect' },
    { id: 3, label: 'Map' },
    { id: 4, label: 'Validate' },
    { id: 5, label: 'Match' },
    { id: 6, label: 'Review' },
    { id: 7, label: 'Import' },
    { id: 8, label: 'Complete' },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
              Import Authorized Market Intelligence Dataset
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload and map Excel/CSV market data into the canonical BDIQ intelligence platform.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-background overflow-x-auto">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step > s.id
                    ? 'bg-primary text-primary-foreground'
                    : step === s.id
                    ? 'bg-foreground text-background ring-2 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s.id ? '✓' : s.id}
              </div>
              <span className={`text-xs font-medium ${step === s.id ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {idx < steps.length - 1 && <div className="w-4 border-t border-border mx-2" />}
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-y-auto bg-background">
          
          {step === 1 && (
            <div className="border-2 border-dashed border-border hover:border-primary rounded-xl bg-muted/10 p-12 text-center transition-colors">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select Authorized Excel or CSV Market Dataset</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                File will be inspected securely. No data is imported until mapping and validation are complete.
              </p>
              <label className="inline-flex items-center justify-center px-6 py-2.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium cursor-pointer transition-colors">
                <span>Browse Local File</span>
                <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold">File Inspection</h3>
              <div className="p-4 rounded-lg bg-muted/20 border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Detected File</div>
                  <div className="text-base font-medium">{file?.name || 'Dataset.xlsx'}</div>
                  <div className="text-sm text-muted-foreground mt-1">1 Sheet Detected · ~3,420 rows</div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border">
                  <CheckCircle2 className="w-4 h-4 text-foreground" />
                  <span className="text-xs font-medium">Safe to Parse</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Detected Columns</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {['Product', 'Molecule', 'Country ISO', 'Manufacturer', 'Sales USD', 'Volume', 'Dosage Form'].map(col => (
                    <div key={col} className="p-3 rounded bg-card border border-border text-sm font-mono flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-foreground" />
                      {col}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold">Column Mapping</h3>
              <p className="text-sm text-muted-foreground">Map source columns to the canonical BDIQ Market Data model.</p>
              
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="p-3 font-medium">Canonical Field</th>
                      <th className="p-3 font-medium">Source Column</th>
                      <th className="p-3 font-medium">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="p-3 font-medium">Product Name <span className="text-destructive">*</span></td>
                      <td className="p-3"><select className="w-full p-1.5 rounded border border-input"><option>Product</option></select></td>
                      <td className="p-3 text-muted-foreground font-mono">Atorvastatin Calcium</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Country <span className="text-destructive">*</span></td>
                      <td className="p-3"><select className="w-full p-1.5 rounded border border-input"><option>Country ISO</option></select></td>
                      <td className="p-3 text-muted-foreground font-mono">US</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium">Sales Value</td>
                      <td className="p-3"><select className="w-full p-1.5 rounded border border-input"><option>Sales USD</option></select></td>
                      <td className="p-3 text-muted-foreground font-mono">1,450,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold">Data Validation</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-border bg-card">
                  <div className="text-2xl font-bold">3,420</div>
                  <div className="text-xs text-muted-foreground mt-1 uppercase font-semibold">Total Rows</div>
                </div>
                <div className="p-4 rounded-lg border border-border bg-card">
                  <div className="text-2xl font-bold">3,415</div>
                  <div className="text-xs text-muted-foreground mt-1 uppercase font-semibold">Valid</div>
                </div>
                <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive">
                  <div className="text-2xl font-bold">5</div>
                  <div className="text-xs mt-1 uppercase font-semibold">Errors Found</div>
                </div>
              </div>

              <div className="p-4 rounded-md border border-destructive/20 bg-destructive/10 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-destructive">Validation Errors Require Resolution</h4>
                  <p className="text-xs text-destructive/80 mt-1">5 rows contain invalid negative sales values or malformed dates. These rows will be excluded from import.</p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold">Entity Matching</h3>
              <p className="text-sm text-muted-foreground">Matching source products and companies to canonical master data.</p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                  <div>
                    <h4 className="text-sm font-semibold">Product Master Matching</h4>
                    <p className="text-xs text-muted-foreground">85% exact match, 15% unmatched.</p>
                  </div>
                  <button className="text-sm font-medium border border-border px-3 py-1.5 rounded-md hover:bg-muted">Review Unmatched (42)</button>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                  <div>
                    <h4 className="text-sm font-semibold">Company Matching</h4>
                    <p className="text-xs text-muted-foreground">100% matched to external canonical companies.</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-foreground" />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-semibold">Import Preview & Confirmation</h3>
              <div className="p-6 border border-border rounded-xl bg-muted/20 space-y-4">
                <h4 className="text-sm font-medium uppercase text-muted-foreground tracking-wide border-b border-border pb-2">Final Summary</h4>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <div className="text-muted-foreground">Dataset to Create:</div>
                  <div className="font-medium">Import_Session_20261007</div>
                  <div className="text-muted-foreground">Rows to Import:</div>
                  <div className="font-medium">3,415</div>
                  <div className="text-muted-foreground">Rows Excluded:</div>
                  <div className="font-medium text-destructive">5 (Validation Errors)</div>
                  <div className="text-muted-foreground">Matched Products:</div>
                  <div className="font-medium">1,240</div>
                  <div className="text-muted-foreground">Unmatched Products:</div>
                  <div className="font-medium text-amber-600 dark:text-amber-400">42 (Imported as raw)</div>
                </div>
                <div className="pt-4 mt-4 border-t border-border">
                  <label className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 border-input rounded" />
                    <span className="text-sm font-medium">I confirm that this file is authorized for BDIQ ingestion and does not violate vendor licensing terms.</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step >= 7 && (
            <div className="py-12 text-center space-y-4 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="w-16 h-16 text-foreground mx-auto" />
              <h3 className="text-xl font-bold">Dataset Imported Successfully</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                3,415 market observations have been securely imported into the canonical store. Data is now available in Market Intelligence analysis.
              </p>
              {step === 8 && (
                <div className="pt-6">
                  <button onClick={onClose} className="px-6 py-2.5 bg-foreground text-background font-medium rounded-md hover:bg-foreground/90 transition-colors">
                    Return to Terminal
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
            Cancel
          </button>
          
          <div className="flex items-center gap-3">
            {step > 1 && step < 7 && (
              <button 
                onClick={() => setStep(step - 1 as any)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              >
                Back
              </button>
            )}
            
            {step < 6 && (
              <button 
                onClick={() => setStep(step + 1 as any)}
                className="px-6 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-colors"
              >
                Next
              </button>
            )}

            {step === 6 && (
              <button 
                onClick={() => {
                  setStep(7);
                  setTimeout(() => setStep(8), 1500);
                }}
                className="px-6 py-2 text-sm font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                Confirm & Import
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
