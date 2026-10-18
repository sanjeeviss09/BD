import React, { useState, useEffect } from 'react';
import { Globe, MapPin, ExternalLink } from 'lucide-react';

export interface MarketDataPoint {
  code: string;
  name: string;
  region: string;
  marketSizeUSD: string;
  cagrPercent: string;
  competitorsCount: number;
  activeOpportunities: number;
  xPercent: number;
  yPercent: number;
}

const COORDINATE_MAP: Record<string, { xPercent: number, yPercent: number }> = {
  'US': { xPercent: 24, yPercent: 35 },
  'DE': { xPercent: 51, yPercent: 28 },
  'FR': { xPercent: 49, yPercent: 32 },
  'UK': { xPercent: 47, yPercent: 25 },
  'GB': { xPercent: 47, yPercent: 25 },
  'JP': { xPercent: 86, yPercent: 36 },
  'BR': { xPercent: 34, yPercent: 68 },
  'IN': { xPercent: 71, yPercent: 46 },
  'AU': { xPercent: 88, yPercent: 76 },
  'CN': { xPercent: 77, yPercent: 36 },
  'CA': { xPercent: 20, yPercent: 20 },
};

interface GlobalMarketMapProps {
  className?: string;
  countries?: any[];
  onOpenDeepDive?: (iso2: string) => void;
}

export const GlobalMarketMap: React.FC<GlobalMarketMapProps> = ({ className = '', countries = [], onOpenDeepDive }) => {
  const [hubs, setHubs] = useState<MarketDataPoint[]>([]);
  const [selectedHub, setSelectedHub] = useState<MarketDataPoint | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!countries || countries.length === 0) {
      setHubs([]);
      setSelectedHub(null);
      return;
    }

    const mapped: MarketDataPoint[] = countries.map(c => {
      const coords = COORDINATE_MAP[c.iso2] || { xPercent: 50, yPercent: 50 };
      return {
        code: c.iso2,
        name: c.country,
        region: c.region,
        marketSizeUSD: c.marketValueFormatted || (typeof c.marketValue === 'number' ? (c.marketValue >= 1e9 ? '$' + (c.marketValue / 1e9).toFixed(2) + 'B' : '$' + (c.marketValue / 1e6).toFixed(1) + 'M') : 'N/A'),
        cagrPercent: c.salesGrowth || 'N/A',
        competitorsCount: c.competitorCount || 0,
        activeOpportunities: c.activeOpportunities || 0,
        ...coords
      };
    });

    setHubs(mapped);
    if (!selectedHub || !mapped.find(m => m.code === selectedHub.code)) {
      setSelectedHub(mapped[0] || null);
    }
  }, [countries]);

  if (hubs.length === 0) {
    return (
      <div className={`rounded-xl border border-border bg-card p-5 text-center text-muted-foreground ${className}`}>
        No geographic data available for this subject.
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-wide uppercase font-mono">
            Geographic Market Radar
          </h3>
        </div>
        <button
          onClick={() => setShowTable(!showTable)}
          className="text-xs font-medium px-3 py-1.5 rounded border border-border bg-secondary hover:bg-muted transition-colors text-foreground"
        >
          {showTable ? 'View Graphic Map' : 'View Tabular Radar'}
        </button>
      </div>

      {!showTable ? (
        <div className="relative w-full aspect-[2/1] max-h-[380px] bg-muted/20 rounded-lg border border-border overflow-hidden">
          {/* Abstract SVG Map Background - Grayscale */}
          <svg viewBox="0 0 1000 500" className="w-full h-full opacity-20 pointer-events-none">
            <path d="M 150 120 Q 220 100 280 140 T 320 220 T 260 260 T 170 200 Z" fill="currentColor" />
            <path d="M 280 280 Q 340 320 330 420 T 250 460 T 230 350 Z" fill="currentColor" />
            <path d="M 450 100 Q 550 80 580 180 T 500 230 T 430 160 Z" fill="currentColor" />
            <path d="M 460 220 Q 560 240 540 380 T 470 410 T 420 300 Z" fill="currentColor" />
            <path d="M 600 100 Q 820 90 880 200 T 780 320 T 630 220 Z" fill="currentColor" />
            <path d="M 800 350 Q 890 340 880 430 T 800 450 T 780 380 Z" fill="currentColor" />
            <line x1="0" y1="250" x2="1000" y2="250" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
            <line x1="500" y1="0" x2="500" y2="500" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
          </svg>

          {/* Interactive Market Pins */}
          {hubs.map(hub => {
            const isSelected = selectedHub?.code === hub.code;
            return (
              <button
                key={hub.code}
                onClick={() => setSelectedHub(hub)}
                style={{ left: `${hub.xPercent}%`, top: `${hub.yPercent}%` }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-10 focus:outline-none"
              >
                <div className="relative flex items-center justify-center">
                  <span
                    className={`w-3 h-3 rounded-full border transition duration-200 flex items-center justify-center ${
                      isSelected
                        ? 'bg-foreground border-background ring-2 ring-foreground scale-125'
                        : 'bg-muted-foreground border-background hover:bg-foreground hover:scale-110'
                    }`}
                  />
                  {isSelected && (
                    <span className="absolute -bottom-6 text-[10px] font-mono font-bold tracking-wider text-background bg-foreground px-1.5 py-0.5 rounded shadow">
                      {hub.code}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Accessible Table Radar */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-border rounded-lg">
            <thead className="bg-muted/30 text-muted-foreground uppercase font-mono border-b border-border">
              <tr>
                <th className="p-3">Country</th>
                <th className="p-3">Region</th>
                <th className="p-3">Market Value</th>
                <th className="p-3">CAGR</th>
                <th className="p-3">Competitors</th>
                <th className="p-3">Opportunities</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {hubs.map(hub => (
                <tr
                  key={hub.code}
                  onClick={() => setSelectedHub(hub)}
                  className={`cursor-pointer transition ${
                    selectedHub?.code === hub.code ? 'bg-muted/50 font-medium' : 'hover:bg-muted/20'
                  }`}
                >
                  <td className="p-3">{hub.name} ({hub.code})</td>
                  <td className="p-3">{hub.region}</td>
                  <td className="p-3 font-mono">{hub.marketSizeUSD}</td>
                  <td className="p-3 font-mono">{hub.cagrPercent}</td>
                  <td className="p-3 font-mono">{hub.competitorsCount}</td>
                  <td className="p-3 font-mono">{hub.activeOpportunities}</td>
                  <td className="p-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenDeepDive?.(hub.code); }}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Deep Dive <ExternalLink className="w-3 h-3"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Market Detail Ribbon */}
      {selectedHub && (
        <div className="mt-4 p-4 rounded-lg bg-card border border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-secondary text-foreground">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold">
                {selectedHub.name} ({selectedHub.code})
              </div>
              <div className="text-xs text-muted-foreground">Region: {selectedHub.region}</div>
            </div>
          </div>

          <div className="flex flex-1 justify-around gap-6 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">Market Addressable Size</span>
              <span className="font-mono font-bold text-sm">{selectedHub.marketSizeUSD}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">Growth (CAGR)</span>
              <span className="font-mono font-bold text-sm">{selectedHub.cagrPercent}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-mono">Active BD Deals</span>
              <span className="font-mono font-bold text-sm">{selectedHub.activeOpportunities} Opportunities</span>
            </div>
          </div>

          <div>
            <button
              onClick={() => onOpenDeepDive?.(selectedHub.code)}
              className="px-4 py-2 rounded-lg bg-foreground text-background font-semibold text-xs flex items-center gap-2 hover:bg-foreground/90 transition-colors shadow-sm"
            >
              Open Country Deep Dive <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
