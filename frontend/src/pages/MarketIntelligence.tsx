import { useState } from 'react';
import { GlobalMarketMap } from '@/components/visualization/GlobalMarketMap';
import { ExportBuilderModal } from '@/components/market/ExportBuilderModal';
import { DatasetImportWizard } from '@/components/market/DatasetImportWizard';
import { CountryDeepDiveModal } from '@/components/market/CountryDeepDiveModal';
import {
  Search,
  Upload,
  Download,
  Database,
  Calendar,
  Building,
  FileSpreadsheet,
  Layers,
  Settings2
} from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function MarketIntelligence() {
  const { session } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<{ id: string, name: string, type: string } | null>(null);
  
  // Analysis Configuration State
  const [jurisdiction, setJurisdiction] = useState('ALL');
  const [dataset, setDataset] = useState<string>('');
  const [availableDatasets, setAvailableDatasets] = useState<any[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [period, setPeriod] = useState('24M');
  
  const [analysisContext, setAnalysisContext] = useState<any>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deepDiveIso, setDeepDiveIso] = useState<string | null>(null);

  const [marketData, setMarketData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'competitor' | 'country' | 'regulatory' | 'provenance'>('overview');

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/market-data/datasets', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          setAvailableDatasets(data.data);
          if (data.data.length > 0) {
            setDataset(data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load datasets', err);
      } finally {
        setLoadingDatasets(false);
      }
    };
    if (session?.access_token) {
      fetchDatasets();
    }
  }, [session]);

  // Simulated search selection
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSelectedSubject({ id: '1', name: searchTerm, type: 'Molecule' });
      setAnalysisContext(null);
      setMarketData(null);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedSubject) return;
    setLoading(true);
    setError(null);
    
    const context = {
      subject: selectedSubject,
      jurisdictions: jurisdiction === 'ALL' ? ['US', 'EU', 'JP', 'APAC', 'LATAM'] : [jurisdiction],
      period: period,
      datasets: [dataset]
    };
    
    setAnalysisContext(context);
    
    try {
      const res = await fetch('http://localhost:4000/api/market-data/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(context)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch analysis');
      
      setMarketData(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-foreground font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze authorized market data by product, molecule, therapeutic category and geography.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import Dataset</span>
          </button>
        </div>
      </div>

      {/* Primary Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative max-w-3xl">
          <Search className="w-5 h-5 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search molecule, product, brand or therapeutic category..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input transition-shadow"
          />
          {searchTerm && !selectedSubject && (
            <div className="absolute right-3 top-2 text-xs text-muted-foreground">Press Enter to select</div>
          )}
        </form>
      </div>

      {/* State Machine: Empty / Configuration / Analysis */}
      {!selectedSubject ? (
        // STATE: NO SUBJECT SELECTED
        <div className="py-24 text-center border border-dashed border-border rounded-xl bg-muted/10">
          <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Market Analysis Selected</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Select a product, molecule, brand, or therapeutic category to begin analysis. Ensure you have the correct dataset imported.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground border border-border text-sm font-medium hover:bg-secondary/80 transition-colors">
              Browse Product Master
            </button>
          </div>
        </div>
      ) : !analysisContext ? (
        // STATE: SUBJECT SELECTED, PENDING ANALYSIS RUN
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Analysis Subject</h2>
                <div className="text-2xl font-bold">{selectedSubject.name}</div>
                <div className="text-sm text-muted-foreground mt-1">Type: {selectedSubject.type}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border">
              <div className="space-y-2">
                <label className="text-sm font-medium">Jurisdiction</label>
                <select 
                  value={jurisdiction}
                  onChange={e => setJurisdiction(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-input bg-background text-sm"
                >
                  <option value="ALL">All Available Jurisdictions</option>
                  <option value="US">North America</option>
                  <option value="EU">European Union</option>
                  <option value="JP">Japan</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dataset</label>
                {loadingDatasets ? (
                  <div className="text-sm text-muted-foreground py-2">Loading datasets...</div>
                ) : availableDatasets.length === 0 ? (
                  <div className="text-sm text-destructive py-2">NO MARKET DATASET CONNECTED</div>
                ) : (
                  <select 
                    value={dataset}
                    onChange={e => setDataset(e.target.value)}
                    className="w-full p-2.5 rounded-md border border-input bg-background text-sm"
                  >
                    {availableDatasets.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.dataset_name || d.id}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reporting Period</label>
                <select 
                  value={period}
                  onChange={e => setPeriod(e.target.value)}
                  className="w-full p-2.5 rounded-md border border-input bg-background text-sm"
                >
                  <option value="24M">24-Month Actuals (2024-2026)</option>
                  <option value="12M">12-Month Actuals</option>
                  <option value="YTD">Year to Date</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button 
                onClick={handleRunAnalysis}
                disabled={availableDatasets.length === 0}
                className="px-6 py-2.5 rounded-md bg-foreground text-background text-sm font-medium shadow-md hover:bg-foreground/90 disabled:opacity-50 transition-colors"
              >
                Run Analysis
              </button>
            </div>
          </div>
        </div>
      ) : (
        // STATE: ANALYSIS RUNNING / COMPLETE
        <div className="space-y-6 animate-in fade-in">
          
          {/* Analysis Context Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Subject</span>
                <span className="font-semibold">{analysisContext.subject.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Dataset</span>
                <span className="font-medium flex items-center gap-1"><Database className="w-3.5 h-3.5"/> {analysisContext.datasets[0]}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Period</span>
                <span className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> {analysisContext.period}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setAnalysisContext(null)}
                className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors flex items-center gap-2"
              >
                <Settings2 className="w-4 h-4" />
                Configure
              </button>
              <button 
                onClick={() => setShowExportModal(true)}
                className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border text-xs font-medium hover:bg-secondary/80 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Custom Export
              </button>
            </div>
          </div>

          {/* Module Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'overview' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              Market Overview
            </button>
            <button
              onClick={() => setActiveTab('competitor')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'competitor' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              Competitor Intelligence
            </button>
            <button
              onClick={() => setActiveTab('country')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'country' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              Country Intelligence
            </button>
            <button
              onClick={() => setActiveTab('regulatory')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'regulatory' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              Regulatory Context
            </button>
            <button
              onClick={() => setActiveTab('provenance')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'provenance' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              Data Lineage & Provenance
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="mb-6 fade-in animate-in duration-300">
              <GlobalMarketMap 
                countries={marketData?.countries || []} 
                onOpenDeepDive={(iso) => setDeepDiveIso(iso)}
              />
            </div>
          )}

          {activeTab === 'competitor' && (
            <div className="grid grid-cols-1 gap-6 fade-in animate-in duration-300">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide">
                      Competitor Market Concentration & Volume
                    </h3>
                  </div>
                  {marketData?.capabilities?.market_share && marketData?.competitors?.length > 0 ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      HERFINDAHL INDEX: {marketData?.concentration?.hhi ? `${marketData.concentration.hhi} (${marketData.concentration.classification})` : 'CALCULATING'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/50 text-muted-foreground border border-border">
                      HHI UNAVAILABLE
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 text-muted-foreground uppercase font-mono border-b border-border">
                      <tr>
                        <th className="p-3">Competitor Entity</th>
                        <th className="p-3">Market Share</th>
                        <th className="p-3">Annual Sales</th>
                        <th className="p-3">Volume Dispensed</th>
                        <th className="p-3 text-right">24M CAGR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {loading ? (
                        <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
                      ) : error ? (
                        <tr><td colSpan={5} className="p-4 text-center text-destructive">{error}</td></tr>
                      ) : marketData?.competitorState === 'COMPETITOR_DATA_NOT_AVAILABLE_IN_SELECTED_DATASET' ? (
                        <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Not supported by this dataset. (Company-level data unavailable)</td></tr>
                      ) : marketData?.competitorState === 'COMPETITOR_DATA_AVAILABLE_BUT_NOT_AUTHORIZED' ? (
                        <tr><td colSpan={5} className="p-4 text-center text-destructive">ACCESS RESTRICTED: Not authorized to view company level data for this dataset</td></tr>
                      ) : marketData?.competitorState === 'NO_COMPETITORS_IDENTIFIED_IN_DATA' || !marketData?.competitors?.length ? (
                        <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No competitor data found in selected source</td></tr>
                      ) : marketData.competitors.map((comp: any) => (
                        <tr key={comp.company} className="hover:bg-muted/50 transition">
                          <td className="p-3 font-semibold">{comp.company}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium">{comp.sharePct}%</span>
                              <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                                <div className="h-full bg-foreground" style={{ width: `${comp.sharePct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">{comp.revenueUSD}</td>
                          <td className="p-3 font-mono text-muted-foreground">{comp.volumeUnits}</td>
                          <td className="p-3 font-mono text-right">
                            {comp.trend}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'country' && (
            <div className="grid grid-cols-1 gap-6 fade-in animate-in duration-300">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide">
                      Country Market Profiles
                    </h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/30 text-muted-foreground uppercase font-mono border-b border-border">
                      <tr>
                        <th className="p-3">Country</th>
                        <th className="p-3">Market Value</th>
                        <th className="p-3">Volume Dispensed</th>
                        <th className="p-3">Competitors</th>
                        <th className="p-3">Active Opportunities</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {loading ? (
                        <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
                      ) : !marketData?.countries?.length ? (
                        <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No country intelligence data available.</td></tr>
                      ) : marketData.countries.map((c: any) => (
                        <tr key={c.iso2} className="hover:bg-muted/50 transition">
                          <td className="p-3 font-semibold">{c.country} ({c.iso2})</td>
                          <td className="p-3 font-mono">{c.marketValue ? `$${(c.marketValue / 1000000).toFixed(1)}M` : 'N/A'}</td>
                          <td className="p-3 font-mono">{c.volume ? `${(c.volume / 1000).toFixed(1)}K ${c.volumeUnit}` : 'N/A'}</td>
                          <td className="p-3">{c.competitorCount || '0'}</td>
                          <td className="p-3">
                            {c.activeOpportunities > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{c.activeOpportunities} OPEN</span>
                            ) : (
                              <span className="text-muted-foreground">NONE</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button 
                              onClick={() => setDeepDiveIso(c.iso2)}
                              className="text-primary hover:underline font-medium"
                            >
                              Deep Dive
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'regulatory' && (
            <div className="grid grid-cols-1 gap-6 fade-in animate-in duration-300">
              <div className="rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center shadow-sm">
                <Settings2 className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Regulatory Context Unavailable</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Regulatory intelligence modules (Clinical Trials, Approvals, Market Access) are not yet integrated with the Market Intelligence foundation for this subject.
                </p>
                <button disabled className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground border border-border text-sm font-medium opacity-50 cursor-not-allowed">
                  Connect Regulatory Data
                </button>
              </div>
            </div>
          )}

          {activeTab === 'provenance' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in animate-in duration-300">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide">
                      Data Lineage
                    </h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="p-3 rounded-md border border-border bg-muted/20 text-xs">
                    {marketData?.mode === 'NO_DATA' ? (
                      <>
                        <div className="font-medium mb-1">Status: No Data</div>
                        <div className="text-muted-foreground mb-2">No market observations found for this subject.</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium mb-1">Source Record Reference</div>
                        <div className="text-muted-foreground mb-2">
                          Dataset: {marketData?.dataset?.dataset_name || 'N/A'}<br/>
                          Provider: {marketData?.dataset?.provider || 'N/A'}<br/>
                          Coverage: {marketData?.dataset?.reporting_period || 'N/A'}<br/>
                        </div>
                        <button className="text-primary hover:underline font-medium">View Source Provenance →</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ExportBuilderModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        analysisContext={analysisContext} 
      />
      <DatasetImportWizard 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
      <CountryDeepDiveModal
        isOpen={!!deepDiveIso}
        onClose={() => setDeepDiveIso(null)}
        iso2={deepDiveIso || ''}
        analysisContext={analysisContext}
      />
    </div>
  );
}
