import { SupabaseClient } from '@supabase/supabase-js';
import { ProductIdentityService, DuplicateDetectionResult } from './product-identity.service';

export interface CreateProductDTO {
  product_name: string;
  generic_name?: string;
  brand_name?: string;
  molecule_id?: string;
  product_type?: string;
  product_category?: string;
  dosage_form_id?: string;
  strength_value?: number;
  strength_unit_id?: string;
  strength_raw?: string;
  route_id?: string;
  therapeutic_category_id?: string;
  originator_company?: string;
  reference_product?: string;
  description?: string;
  lifecycle_status?: string;
  development_status?: string;
  country_of_origin?: string;
  forceCreate?: boolean; // If true, proceeds even if potential duplicates exist
}

export interface UpdateProductDTO {
  product_name?: string;
  generic_name?: string;
  brand_name?: string;
  molecule_id?: string;
  product_type?: string;
  product_category?: string;
  dosage_form_id?: string;
  strength_value?: number;
  strength_unit_id?: string;
  strength_raw?: string;
  route_id?: string;
  therapeutic_category_id?: string;
  originator_company?: string;
  reference_product?: string;
  description?: string;
  lifecycle_status?: string;
  development_status?: string;
  country_of_origin?: string;
  version: number;
}

export interface ProductPresentationDTO {
  presentation_name: string;
  presentation_code?: string;
  pack_size?: number;
  pack_unit?: string;
  packaging_type?: string;
  description?: string;
}

export interface ProductCompanyDTO {
  company_name: string;
  relationship_type: string;
  country_code?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  notes?: string;
}

export interface ProductCountryDTO {
  country_code: string;
  country_id?: string;
  market_status?: string;
  availability_status?: string;
  expected_launch_date?: string;
  actual_launch_date?: string;
  notes?: string;
}

export interface ProductAliasDTO {
  alias_value: string;
  alias_type: string;
  country_code?: string;
  source?: string;
}

export class ProductService {
  constructor(
    private supabase: SupabaseClient,
    private organizationId: string,
    private userId: string
  ) {}

  /**
   * Safe generation of the next unique product code.
   */
  private async getNextProductCode(): Promise<string> {
    const { data, error } = await this.supabase.rpc('generate_next_product_code');
    if (!error && data) {
      return data as string;
    }

    // Fallback if RPC is unavailable in test harness or environment
    const year = new Date().getFullYear();
    const { count } = await this.supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', this.organizationId);

    const nextVal = (count || 0) + 1;
    return `PROD-${year}-${String(nextVal).padStart(6, '0')}`;
  }

  /**
   * Creates a canonical pharmaceutical product.
   */
  public async createProduct(dto: CreateProductDTO): Promise<{
    product?: any;
    duplicateWarning?: DuplicateDetectionResult;
  }> {
    const normalizedName = ProductIdentityService.normalizeText(dto.product_name);

    // 1. Duplicate detection check
    const duplicateCheck = await this.detectDuplicates({
      productName: dto.product_name,
      genericName: dto.generic_name,
      brandName: dto.brand_name,
      moleculeId: dto.molecule_id,
      dosageFormId: dto.dosage_form_id,
      strengthValue: dto.strength_value,
      routeId: dto.route_id,
      countryOfOrigin: dto.country_of_origin,
    });

    if (duplicateCheck.hasPotentialDuplicates && !dto.forceCreate && duplicateCheck.highestConfidence >= 80) {
      return { duplicateWarning: duplicateCheck };
    }

    // 2. Generate unique product code
    const productCode = await this.getNextProductCode();

    // 3. Insert product
    const { data: product, error } = await this.supabase
      .from('products')
      .insert({
        organization_id: this.organizationId,
        product_code: productCode,
        product_name: dto.product_name.trim(),
        generic_name: dto.generic_name?.trim() || null,
        brand_name: dto.brand_name?.trim() || null,
        molecule_id: dto.molecule_id || null,
        product_type: dto.product_type || 'FINISHED_DOSAGE_FORM',
        product_category: dto.product_category || 'GENERIC',
        dosage_form_id: dto.dosage_form_id || null,
        strength_value: dto.strength_value !== undefined ? dto.strength_value : null,
        strength_unit_id: dto.strength_unit_id || null,
        strength_raw: dto.strength_raw?.trim() || null,
        route_id: dto.route_id || null,
        therapeutic_category_id: dto.therapeutic_category_id || null,
        originator_company: dto.originator_company?.trim() || null,
        reference_product: dto.reference_product?.trim() || null,
        description: dto.description?.trim() || null,
        lifecycle_status: dto.lifecycle_status || 'ACTIVE',
        development_status: dto.development_status || 'COMMERCIAL',
        country_of_origin: dto.country_of_origin?.trim() || null,
        normalized_name: normalizedName,
        is_archived: false,
        version: 1,
        created_by: this.userId,
        updated_by: this.userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create product: ${error.message}`);
    }

    // 4. Log audit event
    await this.logAuditEvent('PRODUCT_CREATED', product.id, null, product);

    return { product };
  }

  /**
   * Retrieves paginated products with filtering and search.
   */
  public async getProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    lifecycle_status?: string;
    product_type?: string;
    product_category?: string;
    dosage_form_id?: string;
    route_id?: string;
    therapeutic_category_id?: string;
    country_code?: string;
    include_archived?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('products')
      .select(
        `
        id,
        organization_id,
        product_code,
        product_name,
        generic_name,
        brand_name,
        product_type,
        product_category,
        lifecycle_status,
        development_status,
        strength_value,
        strength_raw,
        is_archived,
        created_at,
        updated_at,
        molecules:molecule_id(id, canonical_name),
        dosage_forms:dosage_form_id(id, key, name),
        routes:route_id(id, key, name),
        strength_units:strength_unit_id(id, symbol),
        therapeutic_categories:therapeutic_category_id(id, name),
        product_countries(id, country_code, market_status)
      `,
        { count: 'exact' }
      )
      .eq('organization_id', this.organizationId);

    if (!params.include_archived) {
      query = query.eq('is_archived', false);
    }

    if (params.lifecycle_status) {
      query = query.eq('lifecycle_status', params.lifecycle_status);
    }

    if (params.product_type) {
      query = query.eq('product_type', params.product_type);
    }

    if (params.product_category) {
      query = query.eq('product_category', params.product_category);
    }

    if (params.dosage_form_id) {
      query = query.eq('dosage_form_id', params.dosage_form_id);
    }

    if (params.route_id) {
      query = query.eq('route_id', params.route_id);
    }

    if (params.therapeutic_category_id) {
      query = query.eq('therapeutic_category_id', params.therapeutic_category_id);
    }

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(
        `product_code.ilike.${term},product_name.ilike.${term},generic_name.ilike.${term},brand_name.ilike.${term}`
      );
    }

    const sortColumn = params.sort_by || 'created_at';
    const isAscending = params.sort_order === 'asc';

    const { data, count, error } = await query
      .order(sortColumn, { ascending: isAscending })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to list products: ${error.message}`);
    }

    return {
      products: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Retrieves complete product details including presentations, companies, countries, aliases, and tasks count.
   */
  public async getProductById(id: string) {
    const { data: product, error } = await this.supabase
      .from('products')
      .select(
        `
        *,
        molecules:molecule_id(id, canonical_name, cas_number, description),
        dosage_forms:dosage_form_id(id, key, name, category, compatible_routes),
        routes:route_id(id, key, name, description),
        strength_units:strength_unit_id(id, key, name, symbol),
        therapeutic_categories:therapeutic_category_id(id, code, name),
        product_presentations(*),
        product_companies(*),
        product_countries(*),
        product_aliases(*)
      `
      )
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .single();

    if (error || !product) {
      throw new Error('Product not found or access denied');
    }

    // Query count of linked tasks
    const { count: tasksCount } = await this.supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', id)
      .eq('organization_id', this.organizationId);

    return {
      ...product,
      linkedTasksCount: tasksCount || 0,
    };
  }

  /**
   * Updates an existing product with optimistic locking.
   */
  public async updateProduct(id: string, dto: UpdateProductDTO) {
    const currentProduct = await this.getProductById(id);

    // Optimistic concurrency check
    if (dto.version !== undefined && currentProduct.version !== dto.version) {
      throw new Error('Concurrent modification error: Product has been modified by another user.');
    }

    const normalizedName = dto.product_name
      ? ProductIdentityService.normalizeText(dto.product_name)
      : currentProduct.normalized_name;

    const updatePayload: any = {
      product_name: dto.product_name !== undefined ? dto.product_name.trim() : currentProduct.product_name,
      generic_name: dto.generic_name !== undefined ? dto.generic_name?.trim() || null : currentProduct.generic_name,
      brand_name: dto.brand_name !== undefined ? dto.brand_name?.trim() || null : currentProduct.brand_name,
      molecule_id: dto.molecule_id !== undefined ? dto.molecule_id : currentProduct.molecule_id,
      product_type: dto.product_type || currentProduct.product_type,
      product_category: dto.product_category || currentProduct.product_category,
      dosage_form_id: dto.dosage_form_id !== undefined ? dto.dosage_form_id : currentProduct.dosage_form_id,
      strength_value: dto.strength_value !== undefined ? dto.strength_value : currentProduct.strength_value,
      strength_unit_id: dto.strength_unit_id !== undefined ? dto.strength_unit_id : currentProduct.strength_unit_id,
      strength_raw: dto.strength_raw !== undefined ? dto.strength_raw?.trim() || null : currentProduct.strength_raw,
      route_id: dto.route_id !== undefined ? dto.route_id : currentProduct.route_id,
      therapeutic_category_id:
        dto.therapeutic_category_id !== undefined ? dto.therapeutic_category_id : currentProduct.therapeutic_category_id,
      originator_company:
        dto.originator_company !== undefined ? dto.originator_company?.trim() || null : currentProduct.originator_company,
      reference_product:
        dto.reference_product !== undefined ? dto.reference_product?.trim() || null : currentProduct.reference_product,
      description: dto.description !== undefined ? dto.description?.trim() || null : currentProduct.description,
      lifecycle_status: dto.lifecycle_status || currentProduct.lifecycle_status,
      development_status: dto.development_status || currentProduct.development_status,
      country_of_origin:
        dto.country_of_origin !== undefined ? dto.country_of_origin?.trim() || null : currentProduct.country_of_origin,
      normalized_name: normalizedName,
      version: currentProduct.version + 1,
      updated_at: new Date().toISOString(),
      updated_by: this.userId,
    };

    const { data: updated, error } = await this.supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }

    await this.logAuditEvent('PRODUCT_UPDATED', id, currentProduct, updated);
    return updated;
  }

  /**
   * Soft-archives a product with reason.
   */
  public async archiveProduct(id: string, reason: string) {
    const currentProduct = await this.getProductById(id);

    const { data: archived, error } = await this.supabase
      .from('products')
      .update({
        is_archived: true,
        lifecycle_status: 'ARCHIVED',
        archived_at: new Date().toISOString(),
        archived_by: this.userId,
        archive_reason: reason.trim(),
        version: currentProduct.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: this.userId,
      })
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to archive product: ${error.message}`);
    await this.logAuditEvent('PRODUCT_ARCHIVED', id, currentProduct, archived);
    return archived;
  }

  /**
   * Restores an archived product.
   */
  public async restoreProduct(id: string) {
    const currentProduct = await this.getProductById(id);

    const { data: restored, error } = await this.supabase
      .from('products')
      .update({
        is_archived: false,
        lifecycle_status: 'ACTIVE',
        archived_at: null,
        archived_by: null,
        archive_reason: null,
        version: currentProduct.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: this.userId,
      })
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to restore product: ${error.message}`);
    await this.logAuditEvent('PRODUCT_RESTORED', id, currentProduct, restored);
    return restored;
  }

  /**
   * Presentation Management
   */
  public async addPresentation(productId: string, dto: ProductPresentationDTO) {
    // Validate product ownership
    await this.getProductById(productId);

    const { data, error } = await this.supabase
      .from('product_presentations')
      .insert({
        organization_id: this.organizationId,
        product_id: productId,
        presentation_name: dto.presentation_name.trim(),
        presentation_code: dto.presentation_code?.trim() || null,
        pack_size: dto.pack_size || null,
        pack_unit: dto.pack_unit?.trim() || 'Tablets',
        packaging_type: dto.packaging_type?.trim() || 'Blister Pack',
        description: dto.description?.trim() || null,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add presentation: ${error.message}`);
    await this.logAuditEvent('PRESENTATION_ADDED', productId, null, data);
    return data;
  }

  public async deletePresentation(productId: string, presentationId: string) {
    await this.getProductById(productId);
    const { error } = await this.supabase
      .from('product_presentations')
      .delete()
      .eq('id', presentationId)
      .eq('product_id', productId)
      .eq('organization_id', this.organizationId);

    if (error) throw new Error(`Failed to delete presentation: ${error.message}`);
    return { success: true };
  }

  /**
   * Company/Partner Relationship Management
   */
  public async addCompanyRelationship(productId: string, dto: ProductCompanyDTO) {
    await this.getProductById(productId);

    const { data, error } = await this.supabase
      .from('product_companies')
      .insert({
        organization_id: this.organizationId,
        product_id: productId,
        company_name: dto.company_name.trim(),
        relationship_type: dto.relationship_type.toUpperCase(),
        country_code: dto.country_code?.trim() || null,
        start_date: dto.start_date || null,
        end_date: dto.end_date || null,
        is_current: dto.is_current !== undefined ? dto.is_current : true,
        notes: dto.notes?.trim() || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add company relationship: ${error.message}`);
    await this.logAuditEvent('COMPANY_RELATIONSHIP_ADDED', productId, null, data);
    return data;
  }

  public async deleteCompanyRelationship(productId: string, relationshipId: string) {
    await this.getProductById(productId);
    const { error } = await this.supabase
      .from('product_companies')
      .delete()
      .eq('id', relationshipId)
      .eq('product_id', productId)
      .eq('organization_id', this.organizationId);

    if (error) throw new Error(`Failed to delete company relationship: ${error.message}`);
    return { success: true };
  }

  /**
   * Country Applicability Management
   */
  public async addCountryRelationship(productId: string, dto: ProductCountryDTO) {
    await this.getProductById(productId);

    const { data, error } = await this.supabase
      .from('product_countries')
      .upsert(
        {
          organization_id: this.organizationId,
          product_id: productId,
          country_id: dto.country_id || null,
          country_code: dto.country_code.toUpperCase().trim(),
          market_status: dto.market_status || 'UNDER_EVALUATION',
          availability_status: dto.availability_status || 'ACTIVE',
          expected_launch_date: dto.expected_launch_date || null,
          actual_launch_date: dto.actual_launch_date || null,
          notes: dto.notes?.trim() || null,
        },
        { onConflict: 'product_id,country_code' }
      )
      .select()
      .single();

    if (error) throw new Error(`Failed to set country relationship: ${error.message}`);
    await this.logAuditEvent('COUNTRY_RELATIONSHIP_ADDED', productId, null, data);
    return data;
  }

  public async deleteCountryRelationship(productId: string, countryId: string) {
    await this.getProductById(productId);
    const { error } = await this.supabase
      .from('product_countries')
      .delete()
      .eq('id', countryId)
      .eq('product_id', productId)
      .eq('organization_id', this.organizationId);

    if (error) throw new Error(`Failed to delete country relationship: ${error.message}`);
    return { success: true };
  }

  /**
   * Alias Management
   */
  public async addAlias(productId: string, dto: ProductAliasDTO) {
    await this.getProductById(productId);
    const normalizedAlias = ProductIdentityService.normalizeText(dto.alias_value);

    const { data, error } = await this.supabase
      .from('product_aliases')
      .insert({
        organization_id: this.organizationId,
        product_id: productId,
        alias_value: dto.alias_value.trim(),
        normalized_alias: normalizedAlias,
        alias_type: dto.alias_type.toUpperCase(),
        country_code: dto.country_code?.trim() || null,
        source: dto.source?.trim() || 'USER_ENTRY',
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add alias: ${error.message}`);
    await this.logAuditEvent('PRODUCT_ALIAS_ADDED', productId, null, data);
    return data;
  }

  public async deleteAlias(productId: string, aliasId: string) {
    await this.getProductById(productId);
    const { error } = await this.supabase
      .from('product_aliases')
      .delete()
      .eq('id', aliasId)
      .eq('product_id', productId)
      .eq('organization_id', this.organizationId);

    if (error) throw new Error(`Failed to delete alias: ${error.message}`);
    return { success: true };
  }

  /**
   * Detect duplicates against organization's product library.
   */
  public async detectDuplicates(candidate: {
    productName: string;
    genericName?: string;
    brandName?: string;
    moleculeId?: string;
    dosageFormId?: string;
    strengthValue?: number;
    routeId?: string;
    countryOfOrigin?: string;
  }): Promise<DuplicateDetectionResult> {
    // Fetch existing products in organization
    const { data: existingProducts, error } = await this.supabase
      .from('products')
      .select(
        `
        id,
        product_code,
        product_name,
        brand_name,
        generic_name,
        molecule_id,
        dosage_form_id,
        strength_value,
        strength_unit_id,
        route_id,
        normalized_name,
        country_of_origin,
        product_aliases(normalized_alias)
      `
      )
      .eq('organization_id', this.organizationId)
      .eq('is_archived', false)
      .limit(500);

    if (error) {
      throw new Error(`Failed to query existing products for duplicate check: ${error.message}`);
    }

    const formattedExisting = (existingProducts || []).map((p: any) => ({
      ...p,
      aliases: p.product_aliases || [],
    }));

    return ProductIdentityService.detectDuplicates(candidate, formattedExisting);
  }

  /**
   * Dashboard Analytics for Product Master.
   * Real authoritative counts.
   */
  public async getDashboardAnalytics() {
    const { data: products, error } = await this.supabase
      .from('products')
      .select(
        `
        id,
        lifecycle_status,
        development_status,
        is_archived,
        molecule_id,
        dosage_form_id,
        product_countries(country_code)
      `
      )
      .eq('organization_id', this.organizationId);

    if (error) throw new Error(`Failed to fetch product analytics: ${error.message}`);

    const all = products || [];
    const active = all.filter(p => !p.is_archived && p.lifecycle_status === 'ACTIVE');
    const underDev = all.filter(p => !p.is_archived && p.development_status === 'UNDER_DEVELOPMENT');
    const underEval = all.filter(p => !p.is_archived && p.lifecycle_status === 'UNDER_EVALUATION');
    const archived = all.filter(p => p.is_archived);

    const moleculesSet = new Set(all.map(p => p.molecule_id).filter(Boolean));
    const dosageFormsSet = new Set(all.map(p => p.dosage_form_id).filter(Boolean));

    const countriesSet = new Set<string>();
    all.forEach(p => {
      if (Array.isArray(p.product_countries)) {
        p.product_countries.forEach((c: any) => {
          if (c.country_code) countriesSet.add(c.country_code);
        });
      }
    });

    return {
      totalProducts: all.length,
      activeProducts: active.length,
      underDevelopmentProducts: underDev.length,
      underEvaluationProducts: underEval.length,
      archivedProducts: archived.length,
      distinctMoleculesCount: moleculesSet.size,
      distinctDosageFormsCount: dosageFormsSet.size,
      distinctTargetCountriesCount: countriesSet.size,
    };
  }

  /**
   * Exports filtered product master data to CSV format.
   */
  public async exportProducts(filters: any): Promise<string> {
    const { products } = await this.getProducts({ ...filters, limit: 1000 });

    const headers = [
      'Product Code',
      'Product Name',
      'Generic Name',
      'Brand Name',
      'Molecule',
      'Dosage Form',
      'Strength',
      'Route',
      'Product Type',
      'Category',
      'Lifecycle Status',
      'Development Status',
      'Created Date',
    ];

    const rows = products.map((p: any) => [
      `"${p.product_code || ''}"`,
      `"${(p.product_name || '').replace(/"/g, '""')}"`,
      `"${(p.generic_name || '').replace(/"/g, '""')}"`,
      `"${(p.brand_name || '').replace(/"/g, '""')}"`,
      `"${p.molecules?.canonical_name || ''}"`,
      `"${p.dosage_forms?.name || ''}"`,
      `"${p.strength_value ? `${p.strength_value} ${p.strength_units?.symbol || ''}` : p.strength_raw || ''}"`,
      `"${p.routes?.name || ''}"`,
      `"${p.product_type || ''}"`,
      `"${p.product_category || ''}"`,
      `"${p.lifecycle_status || ''}"`,
      `"${p.development_status || ''}"`,
      `"${p.created_at || ''}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  private async logAuditEvent(action: string, entityId: string, oldValues: any, newValues: any) {
    try {
      await this.supabase.from('audit_logs').insert({
        organization_id: this.organizationId,
        actor_id: this.userId,
        action,
        entity_type: 'PRODUCT',
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
      });
    } catch {
      // Non-blocking audit failure
    }
  }
}
