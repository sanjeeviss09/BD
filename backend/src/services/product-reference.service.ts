import { SupabaseClient } from '@supabase/supabase-js';

export interface DosageFormRecord {
  id: string;
  key: string;
  name: string;
  category: string;
  compatible_routes: string[];
  sort_order: number;
}

export interface RouteRecord {
  id: string;
  key: string;
  name: string;
  description?: string;
  sort_order: number;
}

export interface StrengthUnitRecord {
  id: string;
  key: string;
  name: string;
  symbol: string;
  unit_type: string;
  sort_order: number;
}

export interface CountryRecord {
  id: string;
  iso2: string;
  iso3: string;
  name: string;
  region?: string;
  subregion?: string;
}

export interface TherapeuticCategoryRecord {
  id: string;
  code: string;
  name: string;
  parent_id?: string | null;
  level: number;
  description?: string;
}

export interface MoleculeRecord {
  id: string;
  canonical_name: string;
  normalized_name: string;
  cas_number?: string;
  description?: string;
  status: string;
  organization_id?: string | null;
}

export class ProductReferenceService {
  constructor(private supabase: SupabaseClient) {}

  public async getDosageForms(): Promise<DosageFormRecord[]> {
    const { data, error } = await this.supabase
      .from('dosage_forms')
      .select('id, key, name, category, compatible_routes, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch dosage forms: ${error.message}`);
    return (data || []).map(d => ({
      ...d,
      compatible_routes: Array.isArray(d.compatible_routes) ? d.compatible_routes : [],
    }));
  }

  public async getRoutes(): Promise<RouteRecord[]> {
    const { data, error } = await this.supabase
      .from('routes_of_administration')
      .select('id, key, name, description, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch routes: ${error.message}`);
    return data || [];
  }

  public async getStrengthUnits(): Promise<StrengthUnitRecord[]> {
    const { data, error } = await this.supabase
      .from('strength_units')
      .select('id, key, name, symbol, unit_type, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch strength units: ${error.message}`);
    return data || [];
  }

  public async getCountries(): Promise<CountryRecord[]> {
    const { data, error } = await this.supabase
      .from('countries')
      .select('id, iso2, iso3, name, region, subregion')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to fetch countries: ${error.message}`);
    return data || [];
  }

  public async getTherapeuticCategories(): Promise<TherapeuticCategoryRecord[]> {
    const { data, error } = await this.supabase
      .from('therapeutic_categories')
      .select('id, code, name, parent_id, level, description')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch therapeutic categories: ${error.message}`);
    return data || [];
  }

  public async getMolecules(search?: string, orgId?: string): Promise<MoleculeRecord[]> {
    let query = this.supabase
      .from('molecules')
      .select('id, canonical_name, normalized_name, cas_number, description, status, organization_id')
      .eq('status', 'ACTIVE');

    if (orgId) {
      query = query.or(`organization_id.is.null,organization_id.eq.${orgId}`);
    } else {
      query = query.is('organization_id', null);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query = query.ilike('canonical_name', term);
    }

    let data: any[] | null = null;
    try {
      const res = await query.order('canonical_name', { ascending: true }).limit(100);
      data = res.data;
    } catch (e) {
      console.warn('DB query for molecules failed, using fallback catalogue:', e);
    }

    const defaultMolecules: MoleculeRecord[] = [
      { id: 'm-mesa', canonical_name: 'Mesalamine', normalized_name: 'mesalamine', cas_number: '89-57-6', description: '5-Aminosalicylic acid (5-ASA) anti-inflammatory for Ulcerative Colitis', status: 'ACTIVE' },
      { id: 'm-ator', canonical_name: 'Atorvastatin', normalized_name: 'atorvastatin', cas_number: '134523-00-5', description: 'HMG-CoA reductase inhibitor for dyslipidemia and cardiovascular risk reduction', status: 'ACTIVE' },
      { id: 'm-sema', canonical_name: 'Semaglutide', normalized_name: 'semaglutide', cas_number: '910463-68-2', description: 'GLP-1 receptor agonist for type 2 diabetes and chronic weight management', status: 'ACTIVE' },
      { id: 'm-amox', canonical_name: 'Amoxicillin', normalized_name: 'amoxicillin', cas_number: '26787-78-0', description: 'Broad-spectrum beta-lactam aminopenicillin antibiotic', status: 'ACTIVE' },
      { id: 'm-met', canonical_name: 'Metformin', normalized_name: 'metformin', cas_number: '657-24-9', description: 'Biguanide antihyperglycemic agent for type 2 diabetes mellitus', status: 'ACTIVE' },
      { id: 'm-para', canonical_name: 'Paracetamol', normalized_name: 'paracetamol', cas_number: '103-90-2', description: 'Analgesic and antipyretic agent', status: 'ACTIVE' },
      { id: 'm-apix', canonical_name: 'Apixaban', normalized_name: 'apixaban', cas_number: '503612-47-3', description: 'Direct factor Xa inhibitor anticoagulant', status: 'ACTIVE' },
      { id: 'm-pemb', canonical_name: 'Pembrolizumab', normalized_name: 'pembrolizumab', cas_number: '1374853-91-4', description: 'Humanized anti-PD-1 monoclonal antibody for oncology indications', status: 'ACTIVE' },
      { id: 'm-empa', canonical_name: 'Empagliflozin', normalized_name: 'empagliflozin', cas_number: '864070-44-0', description: 'Selective SGLT2 inhibitor for glycemic control and cardiovascular risk', status: 'ACTIVE' },
      { id: 'm-dapa', canonical_name: 'Dapagliflozin', normalized_name: 'dapagliflozin', cas_number: '461432-26-8', description: 'SGLT2 inhibitor for diabetes, heart failure, and CKD', status: 'ACTIVE' },
      { id: 'm-omep', canonical_name: 'Omeprazole', normalized_name: 'omeprazole', cas_number: '73590-58-6', description: 'Proton pump inhibitor for GERD and peptic ulcer disease', status: 'ACTIVE' },
      { id: 'm-rosu', canonical_name: 'Rosuvastatin', normalized_name: 'rosuvastatin', cas_number: '287714-41-4', description: 'HMG-CoA reductase inhibitor for hypercholesterolemia', status: 'ACTIVE' },
      { id: 'm-riva', canonical_name: 'Rivaroxaban', normalized_name: 'rivaroxaban', cas_number: '366789-02-8', description: 'Direct oral factor Xa anticoagulant', status: 'ACTIVE' },
      { id: 'm-losa', canonical_name: 'Losartan', normalized_name: 'losartan', cas_number: '114798-26-4', description: 'Angiotensin II receptor blocker (ARB) for hypertension', status: 'ACTIVE' },
      { id: 'm-adal', canonical_name: 'Adalimumab', normalized_name: 'adalimumab', cas_number: '331731-18-1', description: 'Anti-TNF-alpha human monoclonal antibody for rheumatoid arthritis and IBD', status: 'ACTIVE' },
    ];

    const results = [...(data || [])];
    defaultMolecules.forEach(dm => {
      if (!results.some(r => r.canonical_name.toLowerCase() === dm.canonical_name.toLowerCase())) {
        if (!search || dm.canonical_name.toLowerCase().includes(search.toLowerCase()) || dm.description?.toLowerCase().includes(search.toLowerCase())) {
          results.push(dm);
        }
      }
    });

    return results;
  }

  public async createCustomMolecule(
    orgId: string,
    canonicalName: string,
    casNumber?: string,
    description?: string
  ): Promise<MoleculeRecord> {
    const normalizedName = canonicalName.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ');
    const { data, error } = await this.supabase
      .from('molecules')
      .insert({
        organization_id: orgId,
        canonical_name: canonicalName.trim(),
        normalized_name: normalizedName,
        cas_number: casNumber?.trim() || null,
        description: description?.trim() || null,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create custom molecule: ${error.message}`);
    return data;
  }
}
