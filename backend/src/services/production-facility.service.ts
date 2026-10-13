import { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError, ValidationError } from '../utils/errors';
import { ProductionCalculationService } from './production-calculation.service';

export class ProductionFacilityService {
  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId: string
  ) {}

  /**
   * Log an audit event
   */
  private async logAudit(action: string, entityType: string, entityId: string, oldValues?: any, newValues?: any) {
    try {
      await this.supabase.from('audit_logs').insert({
        organization_id: this.orgId,
        actor_id: this.userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
      });
    } catch {
      // Non-blocking audit
    }
  }

  // ==========================================
  // FACILITY MASTER
  // ==========================================

  async getFacilities() {
    const { data, error } = await this.supabase
      .from('production_facilities')
      .select('*, production_lines(*), production_equipment(*), production_technologies(*)')
      .eq('organization_id', this.orgId)
      .order('facility_code', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getFacilityById(id: string) {
    const { data, error } = await this.supabase
      .from('production_facilities')
      .select('*, production_lines(*), production_equipment(*), production_technologies(*)')
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !data) {
      throw new NotFoundError(`Facility ${id} not found`);
    }
    return data;
  }

  async createFacility(data: {
    facility_name: string;
    site_type?: string;
    building_block?: string;
    address?: string;
    city?: string;
    state?: string;
    country_iso2?: string;
    site_status?: string;
    regulatory_approvals?: string[];
    contact_person?: string;
    contact_email?: string;
    operational_hours_per_day?: number;
    operational_days_per_year?: number;
  }) {
    // Generate facility code
    let facilityCode = 'FAC-0001';
    try {
      const { data: codeData } = await this.supabase.rpc('generate_next_facility_code');
      if (codeData) facilityCode = codeData;
    } catch {
      facilityCode = `FAC-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const insertPayload = {
      ...data,
      facility_code: facilityCode,
      organization_id: this.orgId,
      created_by: this.userId,
      updated_by: this.userId,
    };

    const { data: created, error } = await this.supabase
      .from('production_facilities')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('facility.created', 'production_facility', created.id, null, created);
    return created;
  }

  async updateFacility(id: string, data: any) {
    const existing = await this.getFacilityById(id);

    const updatePayload = {
      ...data,
      updated_by: this.userId,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await this.supabase
      .from('production_facilities')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('facility.updated', 'production_facility', id, existing, updated);
    return updated;
  }

  // ==========================================
  // PRODUCTION LINES
  // ==========================================

  async getLines(facilityId?: string) {
    let query = this.supabase
      .from('production_lines')
      .select('*, production_facilities(facility_name, facility_code)')
      .eq('organization_id', this.orgId);

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    const { data, error } = await query.order('line_code', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createLine(facilityId: string, data: {
    line_name: string;
    manufacturing_type: string;
    applicable_dosage_forms?: string[];
    applicable_technologies?: string[];
    batch_size_min?: number;
    batch_size_max?: number;
    batch_size_unit?: string;
    nominal_hourly_capacity?: number;
    nominal_annual_capacity?: number;
    operating_hours_per_day?: number;
    working_days_per_year?: number;
    qualification_status?: string;
    validation_status?: string;
    status?: string;
  }) {
    let lineCode = 'LINE-0001';
    try {
      const { data: codeData } = await this.supabase.rpc('generate_next_line_code');
      if (codeData) lineCode = codeData;
    } catch {
      lineCode = `LINE-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const payload = {
      ...data,
      line_code: lineCode,
      facility_id: facilityId,
      organization_id: this.orgId,
      created_by: this.userId,
      updated_by: this.userId,
    };

    const { data: created, error } = await this.supabase
      .from('production_lines')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('line.created', 'production_line', created.id, null, created);
    return created;
  }

  // ==========================================
  // EQUIPMENT MASTER
  // ==========================================

  async getEquipment(facilityId?: string, lineId?: string) {
    let query = this.supabase
      .from('production_equipment')
      .select('*, production_facilities(facility_name, facility_code), production_lines(line_name, line_code)')
      .eq('organization_id', this.orgId);

    if (facilityId) query = query.eq('facility_id', facilityId);
    if (lineId) query = query.eq('production_line_id', lineId);

    const { data, error } = await query.order('equipment_code', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createEquipment(data: {
    facility_id: string;
    production_line_id?: string;
    equipment_name: string;
    equipment_type: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
    capacity_nominal?: number;
    capacity_min?: number;
    capacity_max?: number;
    capacity_unit?: string;
    qualification_status?: string;
    iq_status?: string;
    oq_status?: string;
    pq_status?: string;
    calibration_status?: string;
    validation_status?: string;
    maintenance_status?: string;
    qualification_expiry_date?: string;
    calibration_due_date?: string;
    availability_status?: string;
    is_critical?: boolean;
    status?: string;
  }) {
    let eqCode = 'EQP-00001';
    try {
      const { data: codeData } = await this.supabase.rpc('generate_next_equipment_code');
      if (codeData) eqCode = codeData;
    } catch {
      eqCode = `EQP-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    const payload = {
      ...data,
      equipment_code: eqCode,
      organization_id: this.orgId,
      created_by: this.userId,
      updated_by: this.userId,
    };

    const { data: created, error } = await this.supabase
      .from('production_equipment')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('equipment.created', 'production_equipment', created.id, null, created);
    return created;
  }

  // ==========================================
  // MANUFACTURING TECHNOLOGIES
  // ==========================================

  async getTechnologies(facilityId?: string) {
    let query = this.supabase
      .from('production_technologies')
      .select('*, production_facilities(facility_name, facility_code)')
      .eq('organization_id', this.orgId);

    if (facilityId) query = query.eq('facility_id', facilityId);

    const { data, error } = await query.order('technology_name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createTechnology(data: {
    facility_id: string;
    production_line_id?: string;
    technology_name: string;
    applicable_dosage_forms?: string[];
    applicable_routes?: string[];
    equipment_ids?: string[];
    qualification_status?: string;
    capacity?: number;
    validated_products_count?: number;
    description?: string;
    status?: string;
  }) {
    let techCode = 'TECH-0001';
    try {
      const { data: codeData } = await this.supabase.rpc('generate_next_technology_code');
      if (codeData) techCode = codeData;
    } catch {
      techCode = `TECH-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const payload = {
      ...data,
      technology_code: techCode,
      organization_id: this.orgId,
      created_by: this.userId,
      updated_by: this.userId,
    };

    const { data: created, error } = await this.supabase
      .from('production_technologies')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('technology.created', 'production_technology', created.id, null, created);
    return created;
  }

  // ==========================================
  // CAPACITY ALLOCATIONS
  // ==========================================

  async getCapacityAllocations(facilityId?: string, year?: number) {
    let query = this.supabase
      .from('production_capacity_allocations')
      .select('*, production_facilities(facility_name, facility_code), production_lines(line_name, line_code)')
      .eq('organization_id', this.orgId);

    if (facilityId) query = query.eq('facility_id', facilityId);
    if (year) query = query.eq('period_year', year);

    const { data, error } = await query.order('period_year', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // ==========================================
  // FACILITY COMPARISON MATRIX (Section 41 & 42)
  // ==========================================

  async compareFacilities(params: {
    dosageForm?: string;
    technology?: string;
    annualVolume?: number;
  }) {
    const facilities = await this.getFacilities();

    const comparisons = facilities.map(fac => {
      const lines = fac.production_lines || [];
      const equipment = fac.production_equipment || [];
      const technologies = fac.technologies || fac.production_technologies || [];

      // Check dosage form capability
      const supportsDosageForm = params.dosageForm
        ? lines.some((l: any) =>
            (l.applicable_dosage_forms || []).some(
              (df: string) => df.toLowerCase() === params.dosageForm?.toLowerCase()
            )
          )
        : true;

      // Check technology fit
      const supportsTech = params.technology
        ? technologies.some((t: any) =>
            t.technology_name.toLowerCase().includes(params.technology?.toLowerCase()) &&
            t.qualification_status === 'QUALIFIED'
          )
        : true;

      // Aggregate capacity across active lines
      const totalAvailableCapacity = lines.reduce(
        (sum: number, l: any) => sum + (Number(l.nominal_annual_capacity) || 0),
        0
      );
      const avgUtilization = lines.length > 0
        ? lines.reduce((sum: number, l: any) => sum + (Number(l.current_utilization_pct) || 0), 0) / lines.length
        : 0;

      const remainingCapacity = Math.max(0, totalAvailableCapacity * (1 - avgUtilization / 100));

      const reqVolume = params.annualVolume || 0;
      const capacityFeasible = reqVolume > 0 ? reqVolume <= remainingCapacity : true;

      // Qualified equipment count
      const totalEquipment = equipment.length;
      const qualifiedEquipment = equipment.filter((e: any) => e.qualificationStatus === 'QUALIFIED' || e.qualification_status === 'QUALIFIED').length;

      // Risk determination
      let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (!supportsDosageForm || !supportsTech) risk = 'HIGH';
      else if (!capacityFeasible || avgUtilization > 80) risk = 'MEDIUM';

      // Recommendation
      let recommendation = 'VIABLE';
      let recommendationReason = 'Site satisfies standard manufacturing capabilities.';
      if (!supportsDosageForm) {
        recommendation = 'NOT_RECOMMENDED';
        recommendationReason = `Facility does not operate line for ${params.dosageForm}.`;
      } else if (!supportsTech) {
        recommendation = 'TECH_TRANSFER_REQUIRED';
        recommendationReason = `Technology ${params.technology} is not qualified at this site.`;
      } else if (!capacityFeasible) {
        recommendation = 'CAPACITY_CONSTRAINED';
        recommendationReason = `Remaining capacity (${remainingCapacity.toLocaleString()}) cannot fulfill ${reqVolume.toLocaleString()} units.`;
      } else if (fac.site_status !== 'ACTIVE') {
        recommendation = 'AUDIT_REQUIRED';
        recommendationReason = `Site status is ${fac.site_status}.`;
      }

      return {
        facilityId: fac.id,
        facilityCode: fac.facility_code,
        facilityName: fac.facility_name,
        siteType: fac.site_type,
        city: fac.city,
        state: fac.state,
        countryIso2: fac.country_iso2,
        siteStatus: fac.site_status,
        regulatoryApprovals: fac.regulatory_approvals || [],
        linesCount: lines.length,
        equipmentCount: totalEquipment,
        qualifiedEquipmentCount: qualifiedEquipment,
        totalAvailableCapacity,
        averageUtilizationPct: Number(avgUtilization.toFixed(1)),
        remainingCapacity,
        supportsDosageForm,
        supportsTechnology: supportsTech,
        isCapacityFeasible: capacityFeasible,
        risk,
        recommendation,
        recommendationReason
      };
    });

    // Transparent ranking: recommended first, highest remaining capacity
    comparisons.sort((a, b) => {
      const rankOrder: Record<string, number> = {
        VIABLE: 1,
        CAPACITY_CONSTRAINED: 2,
        TECH_TRANSFER_REQUIRED: 3,
        AUDIT_REQUIRED: 4,
        NOT_RECOMMENDED: 5
      };
      const rankDiff = (rankOrder[a.recommendation] || 99) - (rankOrder[b.recommendation] || 99);
      if (rankDiff !== 0) return rankDiff;
      return b.remainingCapacity - a.remainingCapacity;
    });

    return comparisons;
  }
}
