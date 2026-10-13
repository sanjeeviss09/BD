import { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  Building2,
  Layers,
  Cpu
} from 'lucide-react';
import type { FacilityImportPreview } from '@/types/production-feasibility';

interface FacilityImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  getHeaders: () => Record<string, string>;
  onImportCommitted?: () => void;
}

export default function FacilityImportModal({
  isOpen,
  onClose,
  getHeaders,
  onImportCommitted,
}: FacilityImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<FacilityImportPreview | null>(null);
  const [committing, setCommitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'facilities' | 'lines' | 'equipment'>('facilities');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    window.open('http://localhost:4000/api/production-feasibility/facilities/template/download', '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const handleScanAndPreview = async () => {
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:4000/api/production-feasibility/facilities/import/preview', {
        method: 'POST',
        headers: getHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to parse facility document');
      }

      const data = await res.json();
      setPreview(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scan uploaded document');
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview || !preview.sessionId) return;
    setCommitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('http://localhost:4000/api/production-feasibility/facilities/import/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({ session_id: preview.sessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to commit verified configuration');
      }

      const result = await res.json();
      setSuccessMsg(`Successfully published ${result.committedFacilities} facilities, ${result.committedLines} lines, and ${result.committedEquipment} equipment to active configuration!`);
      if (onImportCommitted) onImportCommitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit configuration');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Manufacturing Configuration Importer (Excel & Word)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Upload facility, line, and equipment capabilities once and reuse across all RFQ assessments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1 bg-emerald-600 text-white rounded font-medium text-xs hover:bg-emerald-700"
              >
                Close & Return
              </button>
            </div>
          )}

          {!preview && !successMsg && (
            <div className="space-y-4">
              {/* Template Download Box */}
              <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Download Verified Facility Template</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Standard multi-sheet workbook containing Facilities, Production Lines, and Equipment schema.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .XLSX Template
                </button>
              </div>

              {/* Upload Drag & Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-border hover:border-foreground/40 rounded-xl cursor-pointer text-center bg-card hover:bg-muted/10 transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls,.csv,.docx,.doc"
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium text-foreground">
                  {file ? file.name : 'Click to browse or drag & drop facility workbook'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Supported formats: XLSX, XLS, CSV, DOCX. Multi-sheet workbooks automatically mapped.
                </p>
              </div>

              {file && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleScanAndPreview}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
                    {uploading ? 'Scanning & Validating...' : 'Scan & Preview Configuration'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview State */}
          {preview && !successMsg && (
            <div className="space-y-4">
              {/* Summary KPIs */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Source Document</div>
                  <div className="text-xs font-semibold text-foreground truncate mt-0.5">{preview.fileName}</div>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Facilities</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{preview.totalFacilities}</div>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Production Lines</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{preview.totalLines}</div>
                </div>
                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase font-medium">Equipment Items</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">{preview.totalEquipment}</div>
                </div>
              </div>

              {/* Errors & Warnings Callout */}
              {preview.errors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    {preview.errors.length} Validation Errors Identified
                  </div>
                  <ul className="text-[11px] text-red-700 list-disc list-inside space-y-0.5">
                    {preview.errors.map((err, i) => (
                      <li key={i}>
                        [{err.sheet} Row {err.row}] {err.field}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tabs for Extracted Data */}
              <div className="flex items-center gap-2 border-b border-border text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('facilities')}
                  className={`pb-2 px-3 flex items-center gap-1.5 ${activeTab === 'facilities' ? 'border-b-2 border-foreground text-foreground font-semibold' : 'text-muted-foreground'}`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Facilities ({preview.facilities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('lines')}
                  className={`pb-2 px-3 flex items-center gap-1.5 ${activeTab === 'lines' ? 'border-b-2 border-foreground text-foreground font-semibold' : 'text-muted-foreground'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Lines ({preview.lines.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('equipment')}
                  className={`pb-2 px-3 flex items-center gap-1.5 ${activeTab === 'equipment' ? 'border-b-2 border-foreground text-foreground font-semibold' : 'text-muted-foreground'}`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Equipment ({preview.equipment.length})
                </button>
              </div>

              {/* Data Table */}
              <div className="border border-border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {activeTab === 'facilities' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 font-medium">Code</th>
                        <th className="py-2 px-3 font-medium">Facility Name</th>
                        <th className="py-2 px-3 font-medium">Type</th>
                        <th className="py-2 px-3 font-medium">City, Country</th>
                        <th className="py-2 px-3 font-medium">Regulatory Approvals</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.facilities.map((f, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-mono font-medium">{f.facility_code}</td>
                          <td className="py-2 px-3">{f.facility_name}</td>
                          <td className="py-2 px-3">{f.site_type}</td>
                          <td className="py-2 px-3">{f.city}, {f.country_iso2}</td>
                          <td className="py-2 px-3 text-[11px] text-muted-foreground">
                            {f.regulatory_approvals?.join(', ') || 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'lines' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 font-medium">Facility</th>
                        <th className="py-2 px-3 font-medium">Line Code</th>
                        <th className="py-2 px-3 font-medium">Line Name</th>
                        <th className="py-2 px-3 font-medium">Mfg Type</th>
                        <th className="py-2 px-3 font-medium">Batch Range</th>
                        <th className="py-2 px-3 font-medium">Annual Capacity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.lines.map((l, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-mono">{l.facility_code}</td>
                          <td className="py-2 px-3 font-mono font-medium">{l.line_code}</td>
                          <td className="py-2 px-3">{l.line_name}</td>
                          <td className="py-2 px-3">{l.manufacturing_type}</td>
                          <td className="py-2 px-3">
                            {l.batch_size_min?.toLocaleString()} - {l.batch_size_max?.toLocaleString()} {l.batch_size_unit}
                          </td>
                          <td className="py-2 px-3">{l.nominal_annual_capacity?.toLocaleString()} units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'equipment' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 font-medium">Code</th>
                        <th className="py-2 px-3 font-medium">Equipment Name</th>
                        <th className="py-2 px-3 font-medium">Type</th>
                        <th className="py-2 px-3 font-medium">Facility / Line</th>
                        <th className="py-2 px-3 font-medium">Qualification</th>
                        <th className="py-2 px-3 font-medium">Calibration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {preview.equipment.map((eq, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="py-2 px-3 font-mono font-medium">{eq.equipment_code}</td>
                          <td className="py-2 px-3">{eq.equipment_name}</td>
                          <td className="py-2 px-3">{eq.equipment_type}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                            {eq.facility_code} / {eq.line_code || 'All'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600">
                              {eq.qualification_status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]">{eq.calibration_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setFile(null);
                  }}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg bg-card"
                >
                  Upload Different Document
                </button>

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={committing || preview.errors.length > 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {committing ? 'Publishing Configuration...' : 'Confirm & Publish Configuration'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
