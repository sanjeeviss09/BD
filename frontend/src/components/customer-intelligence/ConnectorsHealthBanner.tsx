import React, { useState, useEffect } from 'react';
import { 
  Database, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { getApiBaseUrl } from '../../lib/api';

interface ConnectorStatus {
  connector_code: string;
  name: string;
  category: string;
  status: 'CONNECTED' | 'ACTIVE_REALTIME' | 'ISOLATED_SANDBOX' | 'OFFLINE';
  coverage_description: string;
  refresh_policy: string;
  last_sync_at: string;
  last_error: string | null;
  total_records_ingested: number;
  latency_ms: number;
}

interface ConnectorsHealthBannerProps {
  sessionToken?: string;
}

export const ConnectorsHealthBanner: React.FC<ConnectorsHealthBannerProps> = ({ sessionToken }) => {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/customer-intelligence/connectors`, {
        headers: { Authorization: `Bearer ${sessionToken || 'dev-admin-token'}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConnectors(Array.isArray(data) ? data : (data.value || []));
      }
    } catch (err) {
      console.error('Failed to load connector status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, [sessionToken]);

  const activeConnectorsCount = connectors.filter(c => c.status === 'CONNECTED' || c.status === 'ACTIVE_REALTIME').length;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs transition-all">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-muted/20 hover:bg-muted/30 cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-border/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground tracking-tight">Source Ingestion & Evidence Connectors</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {activeConnectorsCount}/{connectors.length} Pipelines Verified
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Multi-source pharmaceutical synchronization pipeline (U.S. FDA, EMA EPAR, SEC 10-K, Internal BDIQ Vault, Sandbox)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fetchConnectors();
            }}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh pipeline health"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-[11px] text-muted-foreground font-mono">
            {isExpanded ? 'Hide Details' : 'View Connectors'}
          </span>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-background/50">
          {connectors.map((c) => {
            const isLive = c.status === 'CONNECTED' || c.status === 'ACTIVE_REALTIME';
            const isSandbox = c.status === 'ISOLATED_SANDBOX';

            return (
              <div 
                key={c.connector_code}
                className="p-3.5 rounded-lg border border-border/70 bg-card hover:border-border transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-semibold text-xs text-foreground leading-tight">
                      {c.name}
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 border ${
                      isLive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      isSandbox ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-destructive/10 text-destructive border-destructive/20'
                    }`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
                    {c.coverage_description}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Sync Policy:</span>
                    <span className="text-foreground">{c.refresh_policy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Records Ingested:</span>
                    <span className="text-foreground">{c.total_records_ingested.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pipeline Latency:</span>
                    <span className="text-foreground">{c.latency_ms} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Refreshed:</span>
                    <span className="text-foreground">{new Date(c.last_sync_at).toLocaleDateString()}</span>
                  </div>
                  {c.last_error && (
                    <div className="text-amber-400 flex items-center gap-1 pt-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.last_error}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
