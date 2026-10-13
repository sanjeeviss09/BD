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

    const { data, error } = await query.order('canonical_name', { ascending: true }).limit(100);

    if (error) throw new Error(`Failed to fetch molecules: ${error.message}`);
    return data || [];
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
