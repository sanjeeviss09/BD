import { useState } from 'react';
import { Download, X, GripVertical } from 'lucide-react';

interface ExportBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisContext: any;
}

export function ExportBuilderModal({ isOpen, onClose, analysisContext }: ExportBuilderModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [includeSummary, setIncludeSummary] = useState(true);

  if (!isOpen) return null;

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
              <Download className="w-5 h-5 text-muted-foreground" />
              Custom Excel Export
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure the scope, sheets, and fields for the market data export.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Steps Sidebar & Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-border bg-muted/10 p-6 flex flex-col gap-4">
            {[
              { id: 1, label: 'Export Scope' },
              { id: 2, label: 'Select Fields' },
              { id: 3, label: 'Column Order' },
              { id: 4, label: 'Sheet Configuration' },
              { id: 5, label: 'Preview & Export' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id as any)}
                className={`text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  step === s.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {s.id}. {s.label}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-8 overflow-y-auto bg-background">
            
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-semibold">Export Scope</h3>
                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <h4 className="text-sm font-medium mb-2">Current Analysis Context</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><span className="text-foreground">Subject:</span> {analysisContext?.subject?.name || 'None'}</li>
                    <li><span className="text-foreground">Jurisdictions:</span> {analysisContext?.jurisdictions?.join(', ') || 'All Available'}</li>
                    <li><span className="text-foreground">Period:</span> {analysisContext?.period || 'Not selected'}</li>
                    <li><span className="text-foreground">Datasets:</span> {analysisContext?.datasets?.join(', ') || 'Not selected'}</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/30 cursor-pointer">
                    <input type="radio" name="scope" defaultChecked className="w-4 h-4" />
                    <span className="text-sm font-medium">Export Current Filtered View</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/30 cursor-pointer">
                    <input type="radio" name="scope" className="w-4 h-4" />
                    <span className="text-sm font-medium">Export Full Analysis Scope</span>
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-semibold">Select Information</h3>
                <p className="text-sm text-muted-foreground">Choose which fields to include in the primary data sheets.</p>
                
                <div className="space-y-6">
                  {/* Category: Product */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium border-b border-border pb-1">Product Information</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['Product Name', 'Molecule', 'Manufacturer', 'Dosage Form'].map(field => (
                        <label key={field} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" defaultChecked className="rounded border-input" />
                          {field}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Category: Market */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium border-b border-border pb-1">Market Information</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['Country', 'Reporting Period', 'Sales Value', 'Volume', 'Market Share'].map(field => (
                        <label key={field} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" defaultChecked className="rounded border-input" />
                          {field}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Category: Provenance */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium border-b border-border pb-1">Source & Provenance</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['Source Provider', 'Dataset Version', 'Original File Name', 'Import Date', 'Data Quality Status'].map(field => (
                        <label key={field} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input type="checkbox" defaultChecked className="rounded border-input" />
                          {field}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-semibold">Column Order</h3>
                <p className="text-sm text-muted-foreground">Drag and drop to reorder columns in the generated sheets.</p>
                
                <div className="space-y-2 max-w-md">
                  {['Product Name', 'Country', 'Reporting Period', 'Sales Value', 'Volume'].map((col, idx) => (
                    <div key={col} className="flex items-center gap-3 p-3 bg-card border border-border rounded-md hover:border-primary transition-colors cursor-move">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{idx + 1}.</span>
                      <span className="text-sm font-medium">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-semibold">Sheet Configuration</h3>
                <p className="text-sm text-muted-foreground">Select and configure the worksheets to include in the Excel workbook.</p>
                
                <div className="p-4 rounded-lg border border-border bg-muted/10 space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={includeSummary} 
                      onChange={e => setIncludeSummary(e.target.checked)}
                      className="mt-1 rounded border-input" 
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground">Include Summary Sheet as Sheet 1</div>
                      <div className="text-xs text-muted-foreground">Executive overview of market size, competitors, and growth.</div>
                    </div>
                  </label>

                  {includeSummary && (
                    <div className="ml-6 p-4 rounded bg-background border border-border space-y-3">
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Summary Blocks</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Report Title</label>
                        <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> KPI Cards</label>
                        <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Top 5 Competitors</label>
                        <label className="flex items-center gap-2"><input type="checkbox" defaultChecked /> Source Coverage</label>
                      </div>
                      <div className="pt-3 border-t border-border mt-3">
                        <label className="block text-sm font-medium mb-1">Custom Management Notes</label>
                        <textarea className="w-full h-20 p-2 rounded-md border border-input bg-background text-sm resize-none" placeholder="Add business commentary..." />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Data Sheets</h4>
                  {[
                    { name: 'Market Overview', desc: 'Aggregated regional sales and volume' },
                    { name: 'Competitor Analysis', desc: 'Company-level share and growth' },
                    { name: 'Raw / Source Data', desc: 'Unaggregated observation rows' },
                    { name: 'Source & Provenance', desc: 'Dataset tracking and lineage' }
                  ].map(sheet => (
                    <label key={sheet.name} className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/30 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" defaultChecked className="rounded border-input" />
                        <span className="text-sm font-medium">{sheet.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{sheet.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-semibold">Preview & Export</h3>
                <p className="text-sm text-muted-foreground">Review your configuration before generating the workbook.</p>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/20 border border-border">
                      <h4 className="text-sm font-medium border-b border-border pb-2 mb-2">Workbook Details</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex justify-between"><span className="text-muted-foreground">Filename:</span> <span className="font-mono">BDIQ_Export_ProductX.xlsx</span></li>
                        <li className="flex justify-between"><span className="text-muted-foreground">Sheets:</span> <span>{includeSummary ? '5' : '4'} selected</span></li>
                        <li className="flex justify-between"><span className="text-muted-foreground">Estimated Rows:</span> <span>~4,250</span></li>
                        <li className="flex justify-between"><span className="text-muted-foreground">Provenance:</span> <span className="text-emerald-600 dark:text-emerald-400">Included</span></li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/20 border border-border">
                      <h4 className="text-sm font-medium border-b border-border pb-2 mb-2">Save as Template</h4>
                      <p className="text-xs text-muted-foreground mb-3">Save this exact configuration for future one-click exports.</p>
                      <input type="text" placeholder="Template Name (e.g. Standard Monthly Mkt)" className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background mb-2" />
                      <button className="text-xs font-medium text-primary border border-border px-3 py-1.5 rounded bg-card hover:bg-muted transition-colors">Save Template</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            All exports are audited and subject to organization data governance policies.
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors">
              Cancel
            </button>
            {step < 5 ? (
              <button 
                onClick={() => setStep(step + 1 as any)}
                className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
              >
                Next Step
              </button>
            ) : (
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('http://localhost:4000/api/market-data/export', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${localStorage.getItem('token')}` // use Auth token
                      },
                      body: JSON.stringify({
                        context: analysisContext,
                        includeSummary: includeSummary,
                        includeProvenance: true // Mocked selected config
                      })
                    });
                    
                    if (!res.ok) throw new Error('Export failed');
                    
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Market_Export_${analysisContext?.subject?.name || 'Data'}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    onClose();
                  } catch (e) {
                    console.error('Export error:', e);
                    alert('Export failed.');
                  }
                }}
                className="px-6 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Generate Excel
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
