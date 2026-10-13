import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errors';
import { MarketDataService } from './market-data.service';

export interface CompetitorRelationship {
  id: string;
  subject_type: string;
  subject_id: string;
  competitor_type: string;
  competitor_entity_id: string;
  relationship_type: string;
  relationship_strength?: number;
  evidence_type?: string;
  evidence_source_id?: string;
  confidence_score?: number;
  competitor_name?: string; // Resolved canonical name
  market_share?: number;
  sales?: number;
  volume?: number;
  growth?: string;
  status: string;
}

export interface CountryMarketProfile {
  id: string;
  country_id: string;
  country_name?: string;
  iso2?: string;
  market_sales?: number;
  market_volume?: number;
  growth_pct?: number;
  cagr_pct?: number;
  competitor_count?: number;
  hhi_value?: number;
  hhi_classification?: string;
  regulatory_status?: string;
  market_access_status?: string;
  opportunity_score?: number;
  recommendation?: string;
  confidence_score?: number;
}

export class IntelligenceService {
  private supabase: SupabaseClient;
  private organizationId: string;
  private userId: string;
  private marketDataService: MarketDataService;

  constructor(organizationId: string, userId: string) {
    this.organizationId = organizationId;
    this.userId = userId;
    
    // Use environment variables for Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
    this.marketDataService = new MarketDataService(this.supabase);
  }

  // --- Competitor Intelligence ---

  async getCompetitors(subjectType: string, subjectId: string): Promise<CompetitorRelationship[]> {
    // 1. Resolve canonical competitors from competitor_relationships table
    let relationships: CompetitorRelationship[] = [];
    
    try {
      const { data, error } = await this.supabase
        .from('competitor_relationships')
        .select(`*`)
        .eq('organization_id', this.organizationId)
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .eq('status', 'ACTIVE');
        
      if (!error && data) {
        relationships = data as CompetitorRelationship[];
      }
    } catch (e) {
      // In-memory fallback / empty state if table doesn't exist
    }

    return relationships;
  }

  async analyzeCompetitors(context: any): Promise<any> {
    const { subject, datasetVersionId, period } = context;
    if (!subject || !datasetVersionId) {
      throw new AppError('Invalid analysis context', 400);
    }

    // Determine dataset capabilities
    let ds: any;
    try {
      const list = await this.marketDataService.listDatasets(this.organizationId);
      ds = list.find((d: any) => d.id === datasetVersionId);
    } catch (e) {
      // Ignore
    }

    if (!ds) {
      return {
        competitorState: 'NO_DATA',
        competitors: [],
        concentration: null,
        capabilities: null
      };
    }

    const capabilities = ds.capabilities || {};
    
    // Ensure company dimension exists
    if (!capabilities.company) {
      return {
        competitorState: 'COMPETITOR_DATA_NOT_AVAILABLE_IN_SELECTED_DATASET',
        competitors: [],
        concentration: null,
        capabilities
      };
    }

    // Pull observations from marketDataService to calculate shares and HHI dynamically
    const allObs = this.marketDataService.getObservationsForOrg(this.organizationId);
    const obs = allObs.filter((o: any) => 
      o.dataset_version_id === datasetVersionId && 
      (o.molecule === subject.name || o.external_product_name === subject.name)
    );

    if (obs.length === 0) {
      return {
        competitorState: 'NO_COMPETITORS_IDENTIFIED_IN_DATA',
        competitors: [],
        concentration: null,
        capabilities
      };
    }

    // Calculate dynamic market share and HHI
    const companyTotals: Record<string, number> = {};
    const companyVolumes: Record<string, number> = {};
    let totalSales = 0;

    obs.forEach((o: any) => {
      const company = o.external_company_name || 'UNKNOWN';
      const sales = parseFloat(o.sales_value) || 0;
      const volume = parseFloat(o.volume_value) || 0;
      
      companyTotals[company] = (companyTotals[company] || 0) + sales;
      companyVolumes[company] = (companyVolumes[company] || 0) + volume;
      totalSales += sales;
    });

    const competitors = Object.keys(companyTotals).map(company => {
      const sales = companyTotals[company];
      const share = totalSales > 0 ? (sales / totalSales) * 100 : 0;
      return {
        company,
        revenueUSD: `$${(sales / 1000000).toFixed(1)}M`,
        volumeUnits: `${(companyVolumes[company] / 1000).toFixed(1)}K`,
        sharePct: share.toFixed(1),
        shareRaw: share,
        trend: '+0.0%'
      };
    }).sort((a, b) => b.shareRaw - a.shareRaw);

    let hhi = 0;
    let classification = 'NOT CALCULABLE';
    if (capabilities.market_share && totalSales > 0) {
      hhi = competitors.reduce((acc, comp) => acc + (comp.shareRaw * comp.shareRaw), 0);
      if (hhi < 1500) classification = 'UNCONCENTRATED';
      else if (hhi < 2500) classification = 'MODERATE';
      else classification = 'HIGHLY CONCENTRATED';
    }

    return {
      competitorState: 'COMPETITOR_DATA_AVAILABLE',
      competitors,
      concentration: hhi > 0 ? {
        hhi: Math.round(hhi),
        classification
      } : null,
      capabilities,
      dataset: ds
    };
  }

  // --- Country Intelligence ---

  async getCountries(subjectType: string, subjectId: string): Promise<CountryMarketProfile[]> {
    let profiles: CountryMarketProfile[] = [];
    try {
      const { data, error } = await this.supabase
        .from('country_market_profiles')
        .select(`*`)
        .eq('organization_id', this.organizationId)
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId);
        
      if (!error && data) {
        profiles = data as CountryMarketProfile[];
      }
    } catch (e) {
      // fallback
    }
    return profiles;
  }

  async analyzeCountries(context: any): Promise<any> {
    const { subject, datasetVersionId, period } = context;
    if (!subject || !datasetVersionId) {
      throw new AppError('Invalid analysis context', 400);
    }

    let ds: any;
    try {
      const list = await this.marketDataService.listDatasets(this.organizationId);
      ds = list.find((d: any) => d.id === datasetVersionId);
    } catch (e) {}

    if (!ds) {
      return {
        mode: 'NO_DATA',
        countries: [],
        capabilities: null
      };
    }

    const capabilities = ds.capabilities || {};
    if (!capabilities.country) {
      return {
        mode: 'COUNTRY_DATA_NOT_AVAILABLE',
        countries: [],
        capabilities
      };
    }

    const allObs = this.marketDataService.getObservationsForOrg(this.organizationId);
    const obs = allObs.filter((o: any) => 
      o.dataset_version_id === datasetVersionId && 
      (o.molecule === subject.name || o.external_product_name === subject.name)
    );

    if (obs.length === 0) {
      return {
        mode: 'NO_DATA',
        countries: [],
        capabilities
      };
    }

    // Aggregate by country dynamically
    const countryTotals: Record<string, { sales: number; volume: number; companies: Set<string> }> = {};
    obs.forEach((o: any) => {
      const c = o.country_iso || o.country_name || 'UNKNOWN';
      if (!countryTotals[c]) countryTotals[c] = { sales: 0, volume: 0, companies: new Set() };
      countryTotals[c].sales += parseFloat(o.sales_value) || 0;
      countryTotals[c].volume += parseFloat(o.volume_value) || 0;
      if (o.external_company_name) countryTotals[c].companies.add(o.external_company_name);
    });

    const countries = Object.keys(countryTotals).map(c => ({
      iso2: c,
      name: c,
      marketSales: countryTotals[c].sales,
      marketVolume: countryTotals[c].volume,
      competitorCount: countryTotals[c].companies.size,
      regulatoryStatus: 'UNKNOWN',
      opportunityScore: 50,
      recommendation: 'REVIEW'
    }));

    return {
      mode: 'DATA_AVAILABLE',
      countries,
      capabilities,
      dataset: ds
    };
  }
}
