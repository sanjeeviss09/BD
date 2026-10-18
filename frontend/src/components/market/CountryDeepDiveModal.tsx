import React, { useState, useEffect } from 'react';
import { X, MapPin, Building, Package, ExternalLink, ShieldCheck, PieChart, Activity } from 'lucide-react';
import { getApiBaseUrl, authHeaders } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface CountryDeepDiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  iso2: string;
  analysisContext: any;
}

export const CountryDeepDiveModal: React.FC<CountryDeepDiveModalProps> = ({ isOpen, onClose, iso2, analysisContext }) => {
  const { session } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !iso2 || !analysisContext) return;

    const fetchDeepDive = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBaseUrl()}/market-data/analysis/country/${iso2}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(session?.access_token)
          },
          body: JSON.stringify(analysisContext)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch country deep dive');
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDeepDive();
  }, [isOpen, iso2, analysisContext]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card w-full max-w-5xl max-h-[90vh] rounded-xl border border-border shadow-xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Country Deep Dive: {data?.country || iso2}</h2>
              <div className="text-xs text-muted-foreground">
                Subject: {analysisContext?.subject?.name} • Dataset: {data?.dataset || 'Loading...'}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-foreground text-sm space-y-8 font-sans">
          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Extracting comprehensive market intelligence...</p>
            </div>
          ) : error ? (
            <div className="py-24 text-center text-destructive">
              <p className="font-semibold mb-2">Error Loading Analysis</p>
              <p>{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-8 animate-in slide-in-from-bottom-4">
              
              {/* Snapshot Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Market Sales</div>
                  <div className="text-xl font-bold font-mono">{data.snapshot.salesFormatted}</div>
                  <div className="text-xs text-primary font-medium mt-1">{data.snapshot.salesGrowth}</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Dispensed Volume</div>
                  <div className="text-xl font-bold font-mono">{data.snapshot.volumeFormatted}</div>
                  <div className="text-xs text-muted-foreground mt-1">{data.snapshot.volumeUnit}</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Competitor Count</div>
                  <div className="text-xl font-bold font-mono">{data.snapshot.competitorCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">Identified Entities</div>
                </div>
                <div className="p-4 rounded-xl border border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Data Quality</div>
                  <div className="text-xl font-bold font-mono text-emerald-600 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5"/> {data.dataQuality}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">As of {data.latestPeriod}</div>
                </div>
              </div>

              {/* Companies and Products */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Company Landscape */}
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center gap-2 bg-muted/10">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">Company Landscape</h3>
                  </div>
                  <div className="p-0 max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/30 text-muted-foreground font-mono sticky top-0">
                        <tr>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Company</th>
                          <th className="p-3 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.companies?.map((c: any) => (
                          <tr key={c.rank} className="hover:bg-muted/30">
                            <td className="p-3 font-mono text-muted-foreground">{c.rank}</td>
                            <td className="p-3 font-medium">{c.company}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono">{c.share}%</span>
                                <div className="w-12 h-1.5 rounded-full bg-border overflow-hidden">
                                  <div className="h-full bg-foreground" style={{ width: `${c.share}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Product Performance */}
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center gap-2 bg-muted/10">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">Product Performance</h3>
                  </div>
                  <div className="p-0 max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/30 text-muted-foreground font-mono sticky top-0">
                        <tr>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.products?.map((p: any) => (
                          <tr key={p.rank} className="hover:bg-muted/30">
                            <td className="p-3 font-mono text-muted-foreground">{p.rank}</td>
                            <td className="p-3 font-medium">{p.product}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-mono">{p.share}%</span>
                                <div className="w-12 h-1.5 rounded-full bg-border overflow-hidden">
                                  <div className="h-full bg-foreground" style={{ width: `${p.share}%` }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Concentration and Implications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Competitor Concentration */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChart className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">Competitor Concentration</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-border pb-4">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase font-mono mb-1">HHI Index</div>
                        <div className="text-xl font-bold font-mono">{data.concentration?.hhi}</div>
                      </div>
                      <div className="text-xs font-semibold px-2 py-1 rounded bg-muted text-muted-foreground border border-border">
                        {data.concentration?.classification}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Top 3 Share</div>
                        <div className="text-base font-semibold">{data.concentration?.top3Share}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Largest Player</div>
                        <div className="text-base font-semibold truncate" title={data.concentration?.largestCompany}>{data.concentration?.largestCompany} ({data.concentration?.largestCompanyShare}%)</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Commercial Implications */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">Commercial Implications</h3>
                  </div>
                  <div className="space-y-3">
                    {data.commercialImplications?.map((imp: any, i: number) => (
                      <div key={i} className="p-3 rounded-md border border-border bg-muted/10">
                        <div className="text-xs font-semibold text-primary uppercase font-mono tracking-wide mb-1">{imp.type.replace('_', ' ')}</div>
                        <div className="text-xs text-muted-foreground">{imp.evidence}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Linked Opportunities (if any) */}
              {data.linkedOpportunities?.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-border bg-muted/10">
                    <h3 className="font-semibold text-sm">Linked Active BD Opportunities in {data.country}</h3>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    {data.linkedOpportunities.map((opp: any) => (
                      <div key={opp.id} className="flex flex-wrap items-center justify-between p-3 rounded-md border border-border bg-background hover:bg-muted/50 transition">
                        <div>
                          <div className="font-medium text-sm text-foreground">{opp.title}</div>
                          <div className="text-xs text-muted-foreground mt-1">Stage: {opp.stage} • Value: {opp.currency} {opp.estimated_value.toLocaleString()}</div>
                        </div>
                        <button className="text-xs font-medium px-3 py-1.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1 transition">
                          View Deal <ExternalLink className="w-3 h-3"/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
