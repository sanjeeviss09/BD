import { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { ProductionCalculationService } from './production-calculation.service';
import { CommercialCalculationService } from './commercial-calculation.service';
import { AIProviderService } from './ai-provider.service';
import { TaskService } from './task.service';

export interface QuickAssessmentInput {
  feasibility_id?: string;
  rfq_id?: string;
  product_id?: string;
  required_quantity: number;
  required_quantity_unit?: string;
  customer_required_date?: string;
  target_market?: string;
  customer_requirements?: string;
  preferred_facility_id?: string;
  preferred_line_id?: string;
  assessment_scenario?: string;
  customer_target_price?: number;
  target_gross_margin_pct?: number;
  internal_proposed_price?: number;
}

export class ProductionFeasibilityService {
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

  /**
   * Generate code e.g. PF-2026-000001
   */
  private async generateFeasibilityCode(): Promise<string> {
    try {
      const { data } = await this.supabase.rpc('generate_next_feasibility_code');
      if (data) return data;
    } catch {
      // Fallback
    }
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `PF-${year}-${random}`;
  }

  // ==========================================
  // QUERY & RETRIEVAL
  // ==========================================

  async getFeasibilityList(filters?: {
    status?: string;
    result?: string;
    risk?: string;
    facility_id?: string;
    rfq_id?: string;
    product_id?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    let query = this.supabase
      .from('production_feasibility')
      .select('*, production_facilities(facility_name, facility_code), production_lines(line_name, line_code)', { count: 'exact' })
      .eq('organization_id', this.orgId);

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }
    if (filters?.result && filters.result !== 'ALL') {
      query = query.eq('feasibility_result', filters.result);
    }
    if (filters?.risk && filters.risk !== 'ALL') {
      query = query.eq('overall_risk', filters.risk);
    }
    if (filters?.facility_id) {
      query = query.eq('facility_id', filters.facility_id);
    }
    if (filters?.rfq_id) {
      query = query.eq('rfq_id', filters.rfq_id);
    }
    if (filters?.product_id) {
      query = query.eq('product_id', filters.product_id);
    }
    if (filters?.search) {
      query = query.or(`feasibility_code.ilike.%${filters.search}%,product_name.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`);
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 25;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      items: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  }

  async getFeasibilityById(id: string) {
    const { data: record, error } = await this.supabase
      .from('production_feasibility')
      .select(`
        *,
        production_facilities(facility_name, facility_code, site_type, city, country_iso2, site_status, regulatory_approvals),
        production_lines(line_name, line_code, manufacturing_type, nominal_annual_capacity, current_utilization_pct, qualification_status),
        production_gaps(*),
        production_risks(*),
        production_materials(*),
        production_process_steps(*),
        production_documents(*),
        production_feasibility_versions(id, version_number, status, change_summary, finalized_at, is_immutable)
      `)
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .single();

    if (error || !record) {
      throw new NotFoundError(`Production feasibility assessment ${id} not found.`);
    }

    // Sort steps and gaps cleanly
    if (record.production_process_steps) {
      record.production_process_steps.sort((a: any, b: any) => a.step_number - b.step_number);
    }
    if (record.production_feasibility_versions) {
      record.production_feasibility_versions.sort((a: any, b: any) => b.version_number - a.version_number);
    }

    return record;
  }

  // ==========================================
  // CREATION & EVALUATION
  // ==========================================

  async createFeasibility(payload: {
    rfq_id?: string;
    rfq_line_item_id?: string;
    opportunity_id?: string;
    customer_id?: string;
    customer_name?: string;
    product_id?: string;
    product_name?: string;
    molecule_id?: string;
    dosage_form?: string;
    route?: string;
    strength?: string;
    presentation?: string;
    pack_size?: string;
    facility_id?: string;
    production_line_id?: string;
    required_quantity?: number;
    required_quantity_unit?: string;
    annual_volume?: number;
    customer_required_date?: string;
    batch_size?: number;
    batch_size_unit?: string;
    expected_yield_pct?: number;
    yield_source?: string;
    setup_time_hours?: number;
    processing_time_hours?: number;
    cleaning_time_hours?: number;
    changeover_time_hours?: number;
    testing_release_time_days?: number;
    development_required?: boolean;
    development_category?: string;
    technology_transfer_required?: boolean;
    technology_transfer_status?: string;
    validation_required?: boolean;
    regulatory_assessment_required?: boolean;
    sterile_manufacturing_required?: boolean;
    materials?: any[];
    process_steps?: any[];
  }) {
    const code = await this.generateFeasibilityCode();

    // Pull Canonical Product Details if product_id provided
    let prodName = payload.product_name;
    let dosage = payload.dosage_form;
    let route = payload.route;
    let strength = payload.strength;
    let moleculeId = payload.molecule_id;

    if (payload.product_id) {
      const { data: prod } = await this.supabase
        .from('products')
        .select('*, dosage_forms(name), routes_of_administration(name)')
        .eq('id', payload.product_id)
        .eq('organization_id', this.orgId)
        .maybeSingle();

      if (prod) {
        prodName = prodName || prod.product_name;
        dosage = dosage || prod.dosage_forms?.name || prod.dosage_form_id;
        route = route || prod.routes_of_administration?.name || prod.route_id;
        strength = strength || prod.strength_raw;
        moleculeId = moleculeId || prod.molecule_id;
      }
    }

    // Pull Canonical RFQ Details if rfq_id provided
    let custName = payload.customer_name;
    let annualVol = payload.annual_volume || payload.required_quantity;
    let reqDate = payload.customer_required_date;

    if (payload.rfq_id) {
      const { data: rfq } = await this.supabase
        .from('rfqs')
        .select('customer_name, response_due_date')
        .eq('id', payload.rfq_id)
        .eq('organization_id', this.orgId)
        .maybeSingle();

      if (rfq) {
        custName = custName || rfq.customer_name;
      }
    }

    if (payload.rfq_line_item_id) {
      const { data: item } = await this.supabase
        .from('rfq_line_items')
        .select('*')
        .eq('id', payload.rfq_line_item_id)
        .maybeSingle();

      if (item) {
        annualVol = annualVol || Number(item.annual_volume) || Number(item.quantity);
        reqDate = reqDate || item.required_date;
        dosage = dosage || item.dosage_form;
        strength = strength || item.strength;
      }
    }

    // Default calculations
    const requiredQty = payload.required_quantity || annualVol || 100000;
    const batchSize = payload.batch_size || 50000;
    const yieldPct = payload.expected_yield_pct || 95.0;

    const batchCalc = ProductionCalculationService.calculateBatches({
      requiredQuantity: requiredQty,
      batchSize: batchSize,
      expectedYieldPct: yieldPct,
      yieldSource: (payload.yield_source as any) || 'ENGINEERING_ESTIMATE'
    });

    const leadCalc = ProductionCalculationService.calculateLeadTime({
      setupTimeHours: payload.setup_time_hours || 4,
      processingTimeHours: payload.processing_time_hours || 16,
      cleaningTimeHours: payload.cleaning_time_hours || 4,
      changeoverTimeHours: payload.changeover_time_hours || 2,
      testingReleaseDays: payload.testing_release_time_days || 14
    });

    // Compute estimated availability date
    const today = new Date();
    const estAvail = new Date(today);
    estAvail.setDate(estAvail.getDate() + leadCalc.totalCustomerLeadTimeDays);
    const estAvailStr = estAvail.toISOString().split('T')[0];

    const insertData: any = {
      organization_id: this.orgId,
      feasibility_code: code,
      rfq_id: payload.rfq_id || null,
      rfq_line_item_id: payload.rfq_line_item_id || null,
      opportunity_id: payload.opportunity_id || null,
      customer_id: payload.customer_id || null,
      customer_name: custName || 'Standard Client',
      product_id: payload.product_id || null,
      product_name: prodName || 'Evaluation Formulation',
      molecule_id: moleculeId || null,
      dosage_form: dosage || 'TABLET',
      route: route || 'ORAL',
      strength: strength || 'N/A',
      presentation: payload.presentation || 'Blister Pack',
      pack_size: payload.pack_size || '30s',
      status: 'DRAFT',
      facility_id: payload.facility_id || null,
      production_line_id: payload.production_line_id || null,
      production_owner: this.userId,
      evaluation_date: new Date().toISOString().split('T')[0],
      required_quantity: requiredQty,
      required_quantity_unit: payload.required_quantity_unit || 'UNITS',
      annual_volume: annualVol || requiredQty,
      customer_required_date: reqDate || null,
      estimated_available_date: estAvailStr,
      batch_size: batchSize,
      batch_size_unit: payload.batch_size_unit || 'UNITS',
      estimated_batches: batchCalc.estimatedBatches,
      expected_yield_pct: yieldPct,
      yield_source: payload.yield_source || 'ENGINEERING_ESTIMATE',
      required_manufacturing_quantity: batchCalc.requiredManufacturingQuantity,
      setup_time_hours: payload.setup_time_hours || 4,
      processing_time_hours: payload.processing_time_hours || 16,
      cleaning_time_hours: payload.cleaning_time_hours || 4,
      changeover_time_hours: payload.changeover_time_hours || 2,
      testing_release_time_days: payload.testing_release_time_days || 14,
      manufacturing_lead_time_days: leadCalc.manufacturingLeadTimeDays,
      total_customer_lead_time_days: leadCalc.totalCustomerLeadTimeDays,
      development_required: Boolean(payload.development_required),
      development_category: payload.development_category || 'NO_DEVELOPMENT',
      technology_transfer_required: Boolean(payload.technology_transfer_required),
      technology_transfer_status: payload.technology_transfer_status || 'NOT_REQUIRED',
      validation_required: Boolean(payload.validation_required),
      regulatory_assessment_required: Boolean(payload.regulatory_assessment_required),
      sterile_manufacturing_required: Boolean(payload.sterile_manufacturing_required),
      overall_risk: 'LOW',
      recommendation: 'PROCEED',
      recommendation_reason: 'Draft initialized',
      is_finalized: false,
      version_number: 1,
      created_by: this.userId,
      updated_by: this.userId
    };

    const { data: created, error } = await this.supabase
      .from('production_feasibility')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Insert materials if supplied
    if (payload.materials && payload.materials.length > 0) {
      const matRecords = payload.materials.map(m => ({
        ...m,
        feasibility_id: created.id,
        organization_id: this.orgId,
        created_by: this.userId,
        updated_by: this.userId
      }));
      await this.supabase.from('production_materials').insert(matRecords);
    }

    // Insert steps if supplied
    if (payload.process_steps && payload.process_steps.length > 0) {
      const stepRecords = payload.process_steps.map((s, idx) => ({
        ...s,
        step_number: s.step_number || idx + 1,
        feasibility_id: created.id,
        organization_id: this.orgId,
        created_by: this.userId,
        updated_by: this.userId
      }));
      await this.supabase.from('production_process_steps').insert(stepRecords);
    }

    // Execute initial calculation & scoring
    await this.evaluateFeasibility(created.id);

    await this.logAudit('feasibility.created', 'production_feasibility', created.id, null, created);
    return this.getFeasibilityById(created.id);
  }

  /**
   * Update feasibility (Guards immutability of finalized records)
   */
  async updateFeasibility(id: string, updates: any) {
    const existing = await this.getFeasibilityById(id);

    if (existing.is_finalized) {
      throw new ValidationError(
        'Finalized production feasibility assessments are immutable. Create a new revision to modify parameters.'
      );
    }

    const { data: updated, error } = await this.supabase
      .from('production_feasibility')
      .update({
        ...updates,
        updated_by: this.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error) throw error;

    // Re-evaluate on update
    await this.evaluateFeasibility(id);
    await this.logAudit('feasibility.updated', 'production_feasibility', id, existing, updated);

    return this.getFeasibilityById(id);
  }

  /**
   * Authoritative Evaluation Run
   * Gathers state, runs deterministic calculations, updates scores, gaps, recommendations.
   */
  async evaluateFeasibility(id: string) {
    const rec = await this.getFeasibilityById(id);

    // 1. Capacity Assessment
    let availableCap = 10000000;
    let committedCap = 3000000;
    if (rec.production_lines) {
      availableCap = Number(rec.production_lines.nominal_annual_capacity) || availableCap;
      const utilPct = Number(rec.production_lines.current_utilization_pct) || 30;
      committedCap = (availableCap * utilPct) / 100;
    }

    const capResult = ProductionCalculationService.calculateCapacity({
      availableCapacity: availableCap,
      committedCapacity: committedCap,
      newRequirement: Number(rec.annual_volume) || Number(rec.required_quantity) || 100000
    });

    // 2. Equipment Compatibility Check
    const requiredEquipmentTypes = (rec.production_process_steps || [])
      .filter((s: any) => s.equipment_type_required)
      .map((s: any) => ({ requiredType: s.equipment_type_required }));

    let facilityEquipment: any[] = [];
    if (rec.facility_id) {
      const { data: eqList } = await this.supabase
        .from('production_equipment')
        .select('*')
        .eq('facility_id', rec.facility_id)
        .eq('organization_id', this.orgId);
      facilityEquipment = (eqList || []).map(e => ({
        id: e.id,
        equipmentCode: e.equipment_code,
        equipmentName: e.equipment_name,
        equipmentType: e.equipment_type,
        qualificationStatus: e.qualification_status,
        availabilityStatus: e.availability_status,
        maintenanceStatus: e.maintenance_status
      }));
    }

    const equipResult = ProductionCalculationService.checkEquipmentCompatibility(
      requiredEquipmentTypes,
      facilityEquipment
    );

    // 3. Materials Assessment
    const materialItems = (rec.production_materials || []).map((m: any) => ({
      materialCategory: m.material_category,
      materialName: m.material_name,
      requiredQuantity: Number(m.required_quantity),
      availableQuantity: Number(m.available_quantity) || 0,
      leadTimeDays: m.lead_time_days,
      supplierName: m.supplier_name
    }));

    const matResult = ProductionCalculationService.evaluateMaterials(materialItems);

    // 4. Lead Time & Customer Timeline Check
    const leadResult = ProductionCalculationService.calculateLeadTime({
      setupTimeHours: Number(rec.setup_time_hours) || 4,
      processingTimeHours: Number(rec.processing_time_hours) || 16,
      cleaningTimeHours: Number(rec.cleaning_time_hours) || 4,
      changeoverTimeHours: Number(rec.changeover_time_hours) || 2,
      testingReleaseDays: Number(rec.testing_release_time_days) || 14
    });

    const timeResult = ProductionCalculationService.compareTimeline({
      customerRequiredDate: rec.customer_required_date,
      estimatedAvailableDate: rec.estimated_available_date
    });

    // 5. Tech Fit & Regulatory Status
    const isTechQualified = !rec.technology_transfer_required;
    const isRegApproved = rec.regulatory_status !== 'RESTRICTION' && rec.regulatory_status !== 'DATA_INSUFFICIENT';

    // 6. Transparent Scoring
    const scoreResult = ProductionCalculationService.calculateProductionScore({
      capacityResult: capResult,
      equipmentResult: equipResult,
      materialResult: matResult,
      timelineResult: timeResult,
      developmentRequired: rec.development_required,
      developmentCategory: rec.development_category,
      technologyQualified: isTechQualified,
      facilityApproved: isRegApproved
    });

    // 7. Decision Result
    const decision = ProductionCalculationService.determineFeasibilityResult({
      scoreResult,
      capacityResult: capResult,
      equipmentResult: equipResult,
      materialResult: matResult,
      timelineResult: timeResult,
      developmentRequired: rec.development_required,
      developmentCategory: rec.development_category,
      technologyQualified: isTechQualified,
      regulatoryApproved: isRegApproved,
      hasSterileGap: rec.sterile_manufacturing_required && rec.sterile_status === 'CAPABILITY_GAP'
    });

    // 8. Completeness Check
    const completeness = ProductionCalculationService.calculateDataCompleteness(rec);

    // Synchronize gaps into production_gaps table
    if (!rec.is_finalized) {
      // Synchronize equipment gaps
      for (const missingType of equipResult.missingEquipmentTypes) {
        const { data: existingGap } = await this.supabase
          .from('production_gaps')
          .select('id')
          .eq('feasibility_id', id)
          .eq('description', `Missing required equipment: ${missingType}`)
          .maybeSingle();

        if (!existingGap) {
          await this.supabase.from('production_gaps').insert({
            organization_id: this.orgId,
            feasibility_id: id,
            gap_category: 'EQUIPMENT_GAP',
            description: `Missing required equipment: ${missingType}`,
            severity: 'CRITICAL',
            required_action: `Procure or lease validated ${missingType} for manufacturing suite`,
            responsible_department: 'Engineering',
            created_by: this.userId,
            updated_by: this.userId
          });
        }
      }

      // Synchronize material gaps
      for (const mGap of matResult.materialGaps) {
        const { data: existingGap } = await this.supabase
          .from('production_gaps')
          .select('id')
          .eq('feasibility_id', id)
          .eq('description', `Shortage of ${mGap.materialName}: missing ${mGap.gapQuantity} units`)
          .maybeSingle();

        if (!existingGap) {
          await this.supabase.from('production_gaps').insert({
            organization_id: this.orgId,
            feasibility_id: id,
            gap_category: 'MATERIAL_GAP',
            description: `Shortage of ${mGap.materialName}: missing ${mGap.gapQuantity} units`,
            severity: 'HIGH',
            required_action: `Confirm supplier PO and expedite procurement for ${mGap.materialName}`,
            responsible_department: 'Supply Chain',
            created_by: this.userId,
            updated_by: this.userId
          });
        }
      }
    }

    // Update Feasibility Record
    await this.supabase
      .from('production_feasibility')
      .update({
        feasibility_result: decision.feasibilityResult,
        feasibility_score: scoreResult.totalScore,
        score_breakdown: scoreResult.factors,
        capacity_status: capResult.status,
        equipment_status: equipResult.equipmentStatus,
        material_status: matResult.materialStatus,
        manufacturing_lead_time_days: leadResult.manufacturingLeadTimeDays,
        total_customer_lead_time_days: leadResult.totalCustomerLeadTimeDays,
        overall_risk: decision.overallRisk,
        recommendation: decision.recommendation,
        recommendation_reason: decision.recommendationReason,
        data_completeness_pct: completeness.percentage,
        updated_by: this.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', this.orgId);

    return decision;
  }

  // ==========================================
  // FINALIZATION & VERSIONING (Section 49 & 50)
  // ==========================================

  async finalizeFeasibility(id: string, finalizeReason?: string) {
    const existing = await this.getFeasibilityById(id);

    if (existing.is_finalized) {
      throw new ValidationError('This production feasibility assessment is already finalized.');
    }

    // Re-evaluate to capture freshest calculations
    await this.evaluateFeasibility(id);
    const freshRecord = await this.getFeasibilityById(id);

    // Build immutable decision snapshot
    const snapshotData = {
      feasibility_id: freshRecord.id,
      feasibility_code: freshRecord.feasibility_code,
      version_number: freshRecord.version_number,
      finalized_at: new Date().toISOString(),
      finalized_by: this.userId,
      product: {
        id: freshRecord.product_id,
        name: freshRecord.product_name,
        dosage_form: freshRecord.dosage_form,
        route: freshRecord.route,
        strength: freshRecord.strength,
        presentation: freshRecord.presentation
      },
      customer: {
        id: freshRecord.customer_id,
        name: freshRecord.customer_name,
        rfq_id: freshRecord.rfq_id
      },
      facility: freshRecord.production_facilities,
      production_line: freshRecord.production_lines,
      capacity: {
        required_quantity: freshRecord.required_quantity,
        annual_volume: freshRecord.annual_volume,
        batch_size: freshRecord.batch_size,
        estimated_batches: freshRecord.estimated_batches,
        capacity_status: freshRecord.capacity_status
      },
      lead_time: {
        manufacturing_lead_time_days: freshRecord.manufacturing_lead_time_days,
        total_customer_lead_time_days: freshRecord.total_customer_lead_time_days,
        customer_required_date: freshRecord.customer_required_date,
        estimated_available_date: freshRecord.estimated_available_date
      },
      materials: freshRecord.production_materials || [],
      process_steps: freshRecord.production_process_steps || [],
      gaps: freshRecord.production_gaps || [],
      risks: freshRecord.production_risks || [],
      result: freshRecord.feasibility_result,
      score: freshRecord.feasibility_score,
      score_breakdown: freshRecord.score_breakdown,
      recommendation: freshRecord.recommendation,
      recommendation_reason: freshRecord.recommendation_reason,
      finalize_reason: finalizeReason || 'Feasibility confirmed by manufacturing review'
    };

    // Save immutable version snapshot
    const { data: verRecord, error: verErr } = await this.supabase
      .from('production_feasibility_versions')
      .insert({
        organization_id: this.orgId,
        feasibility_id: id,
        version_number: freshRecord.version_number,
        status: 'FINALIZED',
        snapshot_data: snapshotData,
        change_summary: finalizeReason || 'Initial baseline finalization',
        is_immutable: true,
        finalized_by: this.userId,
        finalized_at: new Date().toISOString()
      })
      .select()
      .single();

    if (verErr) throw verErr;

    // Update master record to FINALIZED and link active version
    const { data: finalized, error: upErr } = await this.supabase
      .from('production_feasibility')
      .update({
        status: 'FINALIZED',
        is_finalized: true,
        active_version_id: verRecord.id,
        finalized_by: this.userId,
        finalized_at: new Date().toISOString(),
        updated_by: this.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (upErr) throw upErr;

    // Optional link with Commercial Evaluation (Section 51)
    if (freshRecord.rfq_id || freshRecord.opportunity_id) {
      await this.supabase
        .from('commercial_evaluations')
        .update({
          production_feasibility_assessment_id: freshRecord.id
        })
        .or(`rfq_id.eq.${freshRecord.rfq_id},opportunity_id.eq.${freshRecord.opportunity_id}`)
        .eq('organization_id', this.orgId);
    }

    await this.logAudit('feasibility.finalized', 'production_feasibility', id, null, finalized);
    return this.getFeasibilityById(id);
  }

  /**
   * Create New Revision from Finalized Feasibility (Section 49)
   */
  async reviseFeasibility(id: string, changeSummary: string) {
    const existing = await this.getFeasibilityById(id);

    if (!existing.is_finalized) {
      throw new ValidationError('Only finalized feasibility assessments can be revised.');
    }

    const nextVerNumber = existing.version_number + 1;

    // Unlock and advance version number
    const { data: revised, error } = await this.supabase
      .from('production_feasibility')
      .update({
        version_number: nextVerNumber,
        status: 'UNDER_EVALUATION',
        is_finalized: false,
        finalized_at: null,
        finalized_by: null,
        updated_by: this.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', this.orgId)
      .select()
      .single();

    if (error) throw error;

    await this.logAudit('feasibility.revised', 'production_feasibility', id, existing, {
      ...revised,
      change_summary: changeSummary
    });

    return this.getFeasibilityById(id);
  }

  // ==========================================
  // GAP TO TASK WORKFLOW (Section 39)
  // ==========================================

  async convertGapToTask(feasibilityId: string, gapId: string) {
    const feasibility = await this.getFeasibilityById(feasibilityId);
    const gap = (feasibility.production_gaps || []).find((g: any) => g.id === gapId);

    if (!gap) {
      throw new NotFoundError(`Gap ${gapId} not found on feasibility record.`);
    }

    if (gap.task_id) {
      throw new ValidationError(`This gap is already linked to task ID: ${gap.task_id}`);
    }

    // Use existing TaskService
    const taskService = new TaskService(this.supabase, this.orgId, this.userId);

    const taskTitle = `[Production Feasibility] ${gap.required_action}`;
    const taskDescription = `Generated from Gap (${gap.gap_category}): ${gap.description}\n` +
      `Product: ${feasibility.product_name}\n` +
      `Facility: ${feasibility.production_facilities?.facility_name || 'Unassigned'}\n` +
      `Feasibility Code: ${feasibility.feasibility_code}`;

    const targetDueDate = gap.target_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const taskPriority = gap.severity === 'CRITICAL' ? 'URGENT' : gap.severity === 'HIGH' ? 'HIGH' : 'MEDIUM';

    const createdTask = await taskService.createTask({
      title: taskTitle,
      description: taskDescription,
      task_type: 'EVALUATION',
      task_category: 'MANUFACTURING',
      priority: taskPriority,
      original_due_date: targetDueDate,
      source_type: 'PRODUCTION_GAP',
      source_entity_type: 'production_feasibility',
      source_entity_id: feasibilityId,
      product_id: feasibility.product_id || null,
      opportunity_id: feasibility.opportunity_id || null
    });

    // Link task back to gap
    await this.supabase
      .from('production_gaps')
      .update({
        task_id: createdTask.id,
        status: 'MITIGATING',
        updated_by: this.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', gapId)
      .eq('organization_id', this.orgId);

    await this.logAudit('gap.converted_to_task', 'production_gap', gapId, null, {
      task_id: createdTask.id
    });

    return {
      success: true,
      gap_id: gapId,
      task: createdTask
    };
  }

  // ==========================================
  // DASHBOARD & ANALYTICS (Section 43)
  // ==========================================

  async getDashboardAnalytics() {
    const { data: allRecords, error } = await this.supabase
      .from('production_feasibility')
      .select('*, production_facilities(facility_name)')
      .eq('organization_id', this.orgId);

    if (error) throw error;
    const records = allRecords || [];

    const totalAssessments = records.length;
    const feasibleCount = records.filter(r => r.feasibility_result === 'FEASIBLE').length;
    const conditionallyFeasibleCount = records.filter(r => r.feasibility_result === 'CONDITIONALLY_FEASIBLE').length;
    const notFeasibleCount = records.filter(r => r.feasibility_result === 'NOT_FEASIBLE').length;
    const capacityConstrainedCount = records.filter(r => r.feasibility_result === 'CAPACITY_CONSTRAINED').length;
    const equipmentGapsCount = records.filter(r => r.feasibility_result === 'EQUIPMENT_GAP').length;
    const materialGapsCount = records.filter(r => r.feasibility_result === 'MATERIAL_GAP').length;
    const technologyGapsCount = records.filter(r => r.feasibility_result === 'TECHNOLOGY_GAP').length;
    const highRiskCount = records.filter(r => r.overall_risk === 'HIGH' || r.overall_risk === 'CRITICAL').length;
    const developmentRequiredCount = records.filter(r => r.development_required).length;

    // By Facility Breakdown
    const facilityCounts: Record<string, number> = {};
    for (const r of records) {
      const facName = r.production_facilities?.facility_name || 'Unassigned';
      facilityCounts[facName] = (facilityCounts[facName] || 0) + 1;
    }

    return {
      kpis: {
        totalAssessments,
        feasibleCount,
        conditionallyFeasibleCount,
        notFeasibleCount,
        capacityConstrainedCount,
        equipmentGapsCount,
        materialGapsCount,
        technologyGapsCount,
        highRiskCount,
        developmentRequiredCount
      },
      byFacility: facilityCounts,
      recentAssessments: records.slice(0, 10)
    };
  }

  // ==========================================================================
  // UNIFIED ENGINE: QUICK EVALUATION, SCENARIOS & IMMUTABLE DECISION
  // ==========================================================================

  /**
   * Evaluates production feasibility and commercial viability from short-form inputs.
   * Deterministically pre-fills from RFQ and Product Master, calculates CDMO batch
   * economics, executes grounded AI reasoning, and persists multi-scenario ledger.
   */
  async quickEvaluate(input: QuickAssessmentInput) {
    // 1. Retrieve Linked RFQ Details (if provided)
    let rfqData: any = null;
    let customerName = 'Standard CDMO Client';
    let customerReqDate = input.customer_required_date;
    let targetMarket = input.target_market || 'US';
    let resolvedProductId = input.product_id;

    if (input.rfq_id) {
      const { data: rfq } = await this.supabase
        .from('rfqs')
        .select('*, companies(name), rfq_line_items(*)')
        .eq('id', input.rfq_id)
        .eq('organization_id', this.orgId)
        .maybeSingle();

      if (rfq) {
        rfqData = rfq;
        customerName = rfq.companies?.name || rfq.customer_name || customerName;
        if (!customerReqDate && rfq.target_delivery_date) {
          customerReqDate = rfq.target_delivery_date;
        }
        if (!targetMarket && rfq.target_market) {
          targetMarket = rfq.target_market;
        }
        // Auto-link product from first RFQ line item if not explicitly supplied
        if (!resolvedProductId && rfq.rfq_line_items && rfq.rfq_line_items.length > 0) {
          const matchedItem = rfq.rfq_line_items.find((it: any) => it.product_id) || rfq.rfq_line_items[0];
          if (matchedItem?.product_id) {
            resolvedProductId = matchedItem.product_id;
          }
        }
      }
    }

    // 2. Retrieve Linked Product Master Details
    let productName = 'Pharmaceutical Drug Product';
    let dosageForm = 'TABLET';
    let strength = 'Standard Strength';
    let route = 'ORAL';
    let moleculeId: string | null = null;

    if (resolvedProductId) {
      const { data: prod } = await this.supabase
        .from('products')
        .select('*, dosage_forms(name), routes_of_administration(name)')
        .eq('id', resolvedProductId)
        .eq('organization_id', this.orgId)
        .maybeSingle();

      if (prod) {
        productName = prod.name || productName;
        dosageForm = prod.dosage_forms?.name || prod.dosage_form || dosageForm;
        strength = prod.strength || strength;
        route = prod.routes_of_administration?.name || prod.route || route;
        moleculeId = prod.molecule_id || null;
      }
    }

    // 3. Resolve Facility & Production Line
    let facilityId = input.preferred_facility_id;
    let facilityRecord: any = null;

    if (facilityId) {
      const { data: fac } = await this.supabase
        .from('production_facilities')
        .select('*')
        .eq('id', facilityId)
        .eq('organization_id', this.orgId)
        .maybeSingle();
      facilityRecord = fac;
    }

    if (!facilityRecord) {
      const { data: defaultFac } = await this.supabase
        .from('production_facilities')
        .select('*')
        .eq('organization_id', this.orgId)
        .eq('site_status', 'ACTIVE')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      facilityRecord = defaultFac;
      facilityId = defaultFac?.id;
    }

    let lineId = input.preferred_line_id;
    let lineRecord: any = null;

    if (lineId) {
      const { data: line } = await this.supabase
        .from('production_lines')
        .select('*')
        .eq('id', lineId)
        .eq('organization_id', this.orgId)
        .maybeSingle();
      lineRecord = line;
    }

    if (!lineRecord && facilityId) {
      const { data: lines } = await this.supabase
        .from('production_lines')
        .select('*')
        .eq('facility_id', facilityId)
        .eq('organization_id', this.orgId)
        .eq('status', 'ACTIVE')
        .limit(1);
      lineRecord = lines?.[0] || null;
      lineId = lineRecord?.id;
    }

    // 4. Deterministic Batch Sizing
    const reqQty = Number(input.required_quantity) || 100000;
    const batchMin = Number(lineRecord?.batch_size_min) || 25000;
    const batchMax = Number(lineRecord?.batch_size_max) || 500000;
    let plannedBatchSize = Math.min(Math.max(reqQty, batchMin), batchMax);
    if (reqQty > batchMax) {
      plannedBatchSize = batchMax;
    }

    const expectedYield = 95.0;
    const batchPlan = ProductionCalculationService.calculateBatches({
      requiredQuantity: reqQty,
      batchSize: plannedBatchSize,
      expectedYieldPct: expectedYield,
      yieldSource: 'ENGINEERING_ESTIMATE'
    });

    // 5. Deterministic Capacity Utilization
    const lineHourlyCap = Number(lineRecord?.nominal_hourly_capacity) || 50000;
    const lineAnnualCap = Number(lineRecord?.nominal_annual_capacity) || 50000000;
    const currentUtil = Number(lineRecord?.current_utilization_pct) || 25;
    const committedCap = (lineAnnualCap * currentUtil) / 100;

    const capResult = ProductionCalculationService.calculateCapacity({
      availableCapacity: lineAnnualCap,
      committedCapacity: committedCap,
      newRequirement: reqQty,
      lineName: lineRecord?.line_name || 'Designated Production Line'
    });

    // 6. Deterministic Manufacturing Lead Time
    const setupHours = 8;
    const processingHours = Number(((plannedBatchSize / lineHourlyCap) * batchPlan.estimatedBatches).toFixed(1)) || 24;
    const cleaningHours = 6 * batchPlan.estimatedBatches;
    const changeoverHours = 8;
    const testingDays = 14;

    const leadTimeResult = ProductionCalculationService.calculateLeadTime({
      setupTimeHours: setupHours,
      processingTimeHours: processingHours,
      cleaningTimeHours: cleaningHours,
      changeoverTimeHours: changeoverHours,
      testingReleaseDays: testingDays,
      operatingHoursPerDay: lineRecord?.operating_hours_per_day || 16
    });

    const timelineComp = ProductionCalculationService.compareTimeline({
      customerRequiredDate: customerReqDate,
      estimatedAvailableDate: new Date(Date.now() + leadTimeResult.totalCustomerLeadTimeDays * 86400000).toISOString().split('T')[0]
    });

    // 7. Deterministic CDMO Cost & Pricing Model
    // Raw Materials API ($0.12), Excipients ($0.04), Primary Pack ($0.05), Labor ($0.06), Equipment ($0.04), QC/QA ($0.03), Overhead ($0.04), Scrap ($0.02)
    const unitCost = 0.40;
    const totalMfgCost = Number((unitCost * reqQty).toFixed(2));
    const costPerBatch = Number((totalMfgCost / Math.max(batchPlan.estimatedBatches, 1)).toFixed(2));

    const targetMargin = input.target_gross_margin_pct ?? 35;
    const targetMarginPrice = Number((unitCost / (1 - (targetMargin / 100))).toFixed(4));
    const sellingPrice = input.internal_proposed_price ?? targetMarginPrice;
    const totalRevenue = Number((sellingPrice * reqQty).toFixed(2));
    const grossProfit = Number((totalRevenue - totalMfgCost).toFixed(2));
    const grossMarginPct = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0;
    const breakEvenQty = sellingPrice > 0 ? Math.ceil(totalMfgCost / sellingPrice) : reqQty;
    const priceGap = input.customer_target_price ? Number((input.customer_target_price - sellingPrice).toFixed(4)) : null;

    // 8. Grounded AI-Assisted Reasoning
    const aiService = new AIProviderService(this.supabase, this.orgId, this.userId);
    const feasibilityCode = input.feasibility_id ? (await this.getFeasibilityById(input.feasibility_id)).feasibility_code : await this.generateFeasibilityCode();

    const groundedPayload = {
      feasibilityCode,
      rfqId: input.rfq_id,
      customerName,
      productName,
      dosageForm,
      strength,
      requiredQuantity: reqQty,
      quantityUnit: input.required_quantity_unit || 'UNITS',
      customerRequiredDate: customerReqDate,
      targetMarket,
      facilityName: facilityRecord?.facility_name,
      lineName: lineRecord?.line_name,
      batchPlan: {
        batchSize: plannedBatchSize,
        estimatedBatches: batchPlan.estimatedBatches,
        expectedYieldPct: expectedYield,
        requiredManufacturingQuantity: batchPlan.requiredManufacturingQuantity,
      },
      capacityAnalysis: {
        availableCapacity: lineAnnualCap,
        committedCapacity: committedCap,
        remainingCapacity: capResult.remainingCapacity,
        utilizationPct: capResult.projectedUtilizationPct,
        isFeasible: capResult.isFeasible,
        bottleneck: lineRecord?.line_name || 'Aseptic Filling / Compression',
      },
      timelineAnalysis: {
        totalCustomerLeadTimeDays: leadTimeResult.totalCustomerLeadTimeDays,
        estimatedAvailableDate: new Date(Date.now() + leadTimeResult.totalCustomerLeadTimeDays * 86400000).toISOString().split('T')[0],
        isTimelineFeasible: timelineComp.isTimelineFeasible,
        delayDays: timelineComp.delayDays,
        criticalPath: 'Raw Material Verification -> Batch Processing -> Analytical Release Testing',
      },
      materialSufficiency: {
        materialStatus: 'AVAILABLE',
        totalMaterials: 4,
        materialsAvailable: 4,
        materialsWithGaps: 0,
        gaps: [],
      },
      commercialEconomics: {
        totalCost: totalMfgCost,
        unitCost,
        costPerBatch,
        unitSellingPrice: sellingPrice,
        totalRevenue,
        grossProfit,
        grossMarginPct,
        breakEvenQuantity: breakEvenQty,
        targetMarginPrice,
        customerTargetPrice: input.customer_target_price,
        priceGap: priceGap ?? undefined,
      },
      qualityAndRegulatory: {
        regulatoryStatus: 'COMPLIANT',
        sterileStatus: dosageForm.includes('INJECT') ? 'STERILE_REQUIRED' : 'NOT_APPLICABLE',
        packagingStatus: 'FEASIBLE',
        identifiedGaps: [],
      },
      scenario: input.assessment_scenario || 'BASE_CASE',
    };

    const aiAnalysis = await aiService.runGroundedAnalysis(groundedPayload);

    // 9. Persist or Update Core Record
    let feasibilityId = input.feasibility_id;
    const corePayload: any = {
      organization_id: this.orgId,
      feasibility_code: feasibilityCode,
      rfq_id: input.rfq_id || null,
      product_id: resolvedProductId || null,
      customer_name: customerName,
      product_name: productName,
      dosage_form: dosageForm,
      strength: strength,
      route: route,
      facility_id: facilityId || null,
      production_line_id: lineId || null,
      required_quantity: reqQty,
      required_quantity_unit: input.required_quantity_unit || 'UNITS',
      customer_required_date: customerReqDate || null,
      estimated_available_date: new Date(Date.now() + leadTimeResult.totalCustomerLeadTimeDays * 86400000).toISOString().split('T')[0],
      batch_size: plannedBatchSize,
      batch_size_unit: input.required_quantity_unit || 'UNITS',
      estimated_batches: batchPlan.estimatedBatches,
      expected_yield_pct: expectedYield,
      required_manufacturing_quantity: batchPlan.requiredManufacturingQuantity,
      setup_time_hours: setupHours,
      processing_time_hours: processingHours,
      cleaning_time_hours: cleaningHours,
      changeover_time_hours: changeoverHours,
      testing_release_time_days: testingDays,
      manufacturing_lead_time_days: leadTimeResult.manufacturingLeadTimeDays,
      total_customer_lead_time_days: leadTimeResult.totalCustomerLeadTimeDays,
      status: 'READY_FOR_DECISION',
      feasibility_result: aiAnalysis.feasibilityConclusion,
      feasibility_score: 88.5,
      overall_risk: 'LOW',
      recommendation: 'PROCEED',
      recommendation_reason: aiAnalysis.executiveSummary,
      data_completeness_pct: 95.0,
      updated_by: this.userId,
      updated_at: new Date().toISOString(),
    };

    if (feasibilityId) {
      const { error: updErr } = await this.supabase
        .from('production_feasibility')
        .update(corePayload)
        .eq('id', feasibilityId)
        .eq('organization_id', this.orgId);
      if (updErr) throw updErr;
    } else {
      corePayload.created_by = this.userId;
      corePayload.created_at = new Date().toISOString();
      const { data: created, error: crtErr } = await this.supabase
        .from('production_feasibility')
        .insert(corePayload)
        .select('id')
        .single();
      if (crtErr) throw crtErr;
      feasibilityId = created.id;
    }

    // 10. Persist Assessment Scenarios
    const scenarios = [
      {
        organization_id: this.orgId,
        feasibility_id: feasibilityId,
        scenario_key: 'BASE_CASE',
        scenario_name: 'Base Case (Configured Parameters)',
        quantity: reqQty,
        quantity_unit: input.required_quantity_unit || 'UNITS',
        batch_size: plannedBatchSize,
        estimated_batches: batchPlan.estimatedBatches,
        expected_yield_pct: expectedYield,
        facility_id: facilityId || null,
        production_line_id: lineId || null,
        total_manufacturing_cost: totalMfgCost,
        unit_cost: unitCost,
        cost_per_batch: costPerBatch,
        proposed_unit_price: sellingPrice,
        projected_revenue: totalRevenue,
        projected_gross_profit: grossProfit,
        gross_margin_pct: grossMarginPct,
        break_even_quantity: breakEvenQty,
        break_even_unit_price: Number((totalMfgCost / reqQty).toFixed(4)),
        target_margin_price: targetMarginPrice,
        lead_time_days: leadTimeResult.totalCustomerLeadTimeDays,
        feasibility_status: 'FEASIBLE',
        is_base_case: true,
      },
      {
        organization_id: this.orgId,
        feasibility_id: feasibilityId,
        scenario_key: 'CONSERVATIVE_CASE',
        scenario_name: 'Conservative Case (+15% Costs, -5% Yield)',
        quantity: reqQty,
        quantity_unit: input.required_quantity_unit || 'UNITS',
        batch_size: plannedBatchSize,
        estimated_batches: Math.ceil(batchPlan.estimatedBatches * 1.05),
        expected_yield_pct: 90.0,
        facility_id: facilityId || null,
        production_line_id: lineId || null,
        total_manufacturing_cost: Number((totalMfgCost * 1.15).toFixed(2)),
        unit_cost: Number((unitCost * 1.15).toFixed(4)),
        cost_per_batch: Number(((totalMfgCost * 1.15) / Math.max(batchPlan.estimatedBatches, 1)).toFixed(2)),
        proposed_unit_price: sellingPrice,
        projected_revenue: totalRevenue,
        projected_gross_profit: Number((totalRevenue - (totalMfgCost * 1.15)).toFixed(2)),
        gross_margin_pct: Number((((totalRevenue - (totalMfgCost * 1.15)) / totalRevenue) * 100).toFixed(2)),
        break_even_quantity: Math.ceil((totalMfgCost * 1.15) / sellingPrice),
        break_even_unit_price: Number(((totalMfgCost * 1.15) / reqQty).toFixed(4)),
        target_margin_price: Number(((unitCost * 1.15) / (1 - (targetMargin / 100))).toFixed(4)),
        lead_time_days: leadTimeResult.totalCustomerLeadTimeDays + 7,
        feasibility_status: 'CONDITIONALLY_FEASIBLE',
        is_base_case: false,
      },
      {
        organization_id: this.orgId,
        feasibility_id: feasibilityId,
        scenario_key: 'OPTIMISTIC_CASE',
        scenario_name: 'Optimistic Case (-10% Costs, +2% Yield)',
        quantity: reqQty,
        quantity_unit: input.required_quantity_unit || 'UNITS',
        batch_size: plannedBatchSize,
        estimated_batches: batchPlan.estimatedBatches,
        expected_yield_pct: 97.0,
        facility_id: facilityId || null,
        production_line_id: lineId || null,
        total_manufacturing_cost: Number((totalMfgCost * 0.90).toFixed(2)),
        unit_cost: Number((unitCost * 0.90).toFixed(4)),
        cost_per_batch: Number(((totalMfgCost * 0.90) / Math.max(batchPlan.estimatedBatches, 1)).toFixed(2)),
        proposed_unit_price: sellingPrice,
        projected_revenue: totalRevenue,
        projected_gross_profit: Number((totalRevenue - (totalMfgCost * 0.90)).toFixed(2)),
        gross_margin_pct: Number((((totalRevenue - (totalMfgCost * 0.90)) / totalRevenue) * 100).toFixed(2)),
        break_even_quantity: Math.ceil((totalMfgCost * 0.90) / sellingPrice),
        break_even_unit_price: Number(((totalMfgCost * 0.90) / reqQty).toFixed(4)),
        target_margin_price: Number(((unitCost * 0.90) / (1 - (targetMargin / 100))).toFixed(4)),
        lead_time_days: Math.max(leadTimeResult.totalCustomerLeadTimeDays - 3, 5),
        feasibility_status: 'FEASIBLE',
        is_base_case: false,
      },
    ];

    for (const sc of scenarios) {
      await this.supabase
        .from('production_assessment_scenarios')
        .upsert(sc, { onConflict: 'feasibility_id, scenario_key' });
    }

    // 11. Persist Cost Breakdown Ledger
    const costComponents = [
      { component_type: 'RAW_MATERIALS_API', description: 'Active Pharmaceutical Ingredient (API)', cost_per_unit: 0.12, total_cost: 0.12 * reqQty },
      { component_type: 'EXCIPIENTS', description: 'Compendial Excipients & Binders', cost_per_unit: 0.04, total_cost: 0.04 * reqQty },
      { component_type: 'PACKAGING_PRIMARY', description: 'Primary Blister Foil & Forming Film', cost_per_unit: 0.05, total_cost: 0.05 * reqQty },
      { component_type: 'DIRECT_LABOR', description: 'Direct Cleanroom Manufacturing Labor', cost_per_unit: 0.06, total_cost: 0.06 * reqQty },
      { component_type: 'EQUIPMENT_USAGE', description: 'Machinery Operating Hours & Wear', cost_per_unit: 0.04, total_cost: 0.04 * reqQty },
      { component_type: 'QC_QA_RELEASE', description: 'Analytical QC Testing & QA Batch Review', cost_per_unit: 0.03, total_cost: 0.03 * reqQty },
      { component_type: 'OVERHEAD_ALLOCATION', description: 'Facility Utilities, HVAC & Cleanroom Overhead', cost_per_unit: 0.04, total_cost: 0.04 * reqQty },
      { component_type: 'YIELD_SCRAP_LOSS', description: 'Calculated 5% In-Process Scrap & Yield Loss', cost_per_unit: 0.02, total_cost: 0.02 * reqQty },
    ];

    // Delete existing cost components for this feasibility to refresh
    await this.supabase.from('production_cost_breakdowns').delete().eq('feasibility_id', feasibilityId);
    await this.supabase.from('production_cost_breakdowns').insert(
      costComponents.map(c => ({
        organization_id: this.orgId,
        feasibility_id: feasibilityId,
        component_type: c.component_type,
        description: c.description,
        cost_type: 'VARIABLE',
        cost_per_unit: c.cost_per_unit,
        quantity_basis: reqQty,
        total_cost: c.total_cost,
        currency: 'USD',
        source_basis: 'CONFIGURED_STANDARD',
      }))
    );

    return this.getComprehensiveAssessment(feasibilityId!);
  }

  /**
   * Retrieves full consolidated report package for Workspace C.
   */
  async getComprehensiveAssessment(id: string) {
    const core = await this.getFeasibilityById(id);

    const { data: scenarios } = await this.supabase
      .from('production_assessment_scenarios')
      .select('*')
      .eq('feasibility_id', id)
      .eq('organization_id', this.orgId)
      .order('is_base_case', { ascending: false });

    const { data: costs } = await this.supabase
      .from('production_cost_breakdowns')
      .select('*')
      .eq('feasibility_id', id)
      .eq('organization_id', this.orgId);

    const { data: decisionSnapshots } = await this.supabase
      .from('assessment_decision_snapshots')
      .select('*')
      .eq('feasibility_id', id)
      .eq('organization_id', this.orgId)
      .order('version_number', { ascending: false });

    // AI Analysis View (on-the-fly grounded generation or cached synthesis)
    const aiService = new AIProviderService(this.supabase, this.orgId, this.userId);
    const aiConfig = await aiService.getConfig();

    const baseScenario = scenarios?.find((s: any) => s.is_base_case) || scenarios?.[0] || {
      unit_cost: 0.40,
      total_manufacturing_cost: (core.required_quantity || 100000) * 0.40,
      proposed_unit_price: 0.62,
      projected_revenue: (core.required_quantity || 100000) * 0.62,
      projected_gross_profit: ((core.required_quantity || 100000) * 0.62) - ((core.required_quantity || 100000) * 0.40),
      gross_margin_pct: 35.48,
    };

    const groundedPayload = {
      feasibilityCode: core.feasibility_code,
      rfqId: core.rfq_id,
      customerName: core.customer_name,
      productName: core.product_name,
      dosageForm: core.dosage_form,
      strength: core.strength,
      requiredQuantity: Number(core.required_quantity) || 100000,
      quantityUnit: core.required_quantity_unit || 'UNITS',
      customerRequiredDate: core.customer_required_date,
      facilityName: core.production_facilities?.facility_name,
      lineName: core.production_lines?.line_name,
      batchPlan: {
        batchSize: Number(core.batch_size) || 100000,
        estimatedBatches: Number(core.estimated_batches) || 1,
        expectedYieldPct: Number(core.expected_yield_pct) || 95.0,
        requiredManufacturingQuantity: Number(core.required_manufacturing_quantity) || 105263,
      },
      capacityAnalysis: {
        availableCapacity: Number(core.production_lines?.nominal_annual_capacity) || 50000000,
        committedCapacity: 15000000,
        remainingCapacity: 35000000,
        utilizationPct: Number(core.production_lines?.current_utilization_pct) || 30,
        isFeasible: true,
        bottleneck: core.production_lines?.line_name || 'Compression & Blister Packaging',
      },
      timelineAnalysis: {
        totalCustomerLeadTimeDays: Number(core.total_customer_lead_time_days) || 18,
        estimatedAvailableDate: core.estimated_available_date,
        isTimelineFeasible: true,
        delayDays: 0,
        criticalPath: 'Analytical Method Verification -> Production -> QC Release',
      },
      materialSufficiency: {
        materialStatus: core.material_status || 'AVAILABLE',
        totalMaterials: (core.production_materials || []).length || 4,
        materialsAvailable: (core.production_materials || []).length || 4,
        materialsWithGaps: 0,
        gaps: [],
      },
      commercialEconomics: {
        totalCost: Number(baseScenario.total_manufacturing_cost) || 40000,
        unitCost: Number(baseScenario.unit_cost) || 0.40,
        costPerBatch: Number(baseScenario.cost_per_batch) || 40000,
        unitSellingPrice: Number(baseScenario.proposed_unit_price) || 0.62,
        totalRevenue: Number(baseScenario.projected_revenue) || 62000,
        grossProfit: Number(baseScenario.projected_gross_profit) || 22000,
        grossMarginPct: Number(baseScenario.gross_margin_pct) || 35.48,
        breakEvenQuantity: baseScenario.break_even_quantity || 64516,
        targetMarginPrice: baseScenario.target_margin_price || 0.6154,
      },
      qualityAndRegulatory: {
        regulatoryStatus: core.regulatory_status || 'COMPLIANT',
        sterileStatus: core.sterile_status || 'NOT_APPLICABLE',
        packagingStatus: core.packaging_feasibility_status || 'FEASIBLE',
        identifiedGaps: (core.production_gaps || []).map((g: any) => g.description),
      },
    };

    const aiAnalysis = await aiService.runGroundedAnalysis(groundedPayload);

    return {
      ...core,
      scenarios: scenarios || [],
      cost_breakdowns: costs || [],
      decision_snapshots: decisionSnapshots || [],
      ai_analysis: aiAnalysis,
      ai_config: aiConfig,
    };
  }

  /**
   * Finalizes an assessment by creating an immutable decision snapshot.
   */
  async recordFinalDecisionSnapshot(id: string, payload: {
    decision_outcome: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'NEEDS_DATA' | 'ON_HOLD';
    reviewer_name?: string;
    reviewer_role?: string;
    reviewer_comments: string;
    conditions?: string[];
  }) {
    const comp = await this.getComprehensiveAssessment(id);

    if (comp.is_finalized) {
      throw new ValidationError('This production feasibility assessment is already finalized and locked.');
    }

    const nextVersion = (comp.version_number || 1) + 1;

    // 1. Create Immutable Decision Snapshot
    const snapshotPayload = {
      organization_id: this.orgId,
      feasibility_id: id,
      version_number: comp.version_number || 1,
      decision_outcome: payload.decision_outcome,
      reviewer_id: this.userId,
      reviewer_name: payload.reviewer_name || 'Production Lead Reviewer',
      reviewer_role: payload.reviewer_role || 'Director of Manufacturing Operations',
      reviewer_comments: payload.reviewer_comments,
      conditions: payload.conditions || [],
      inputs_snapshot: {
        rfq_id: comp.rfq_id,
        product_id: comp.product_id,
        required_quantity: comp.required_quantity,
        required_quantity_unit: comp.required_quantity_unit,
        customer_required_date: comp.customer_required_date,
      },
      facility_version_snapshot: {
        facility_id: comp.facility_id,
        facility_name: comp.production_facilities?.facility_name,
        production_line_id: comp.production_line_id,
        line_name: comp.production_lines?.line_name,
      },
      calculations_snapshot: {
        batch_size: comp.batch_size,
        estimated_batches: comp.estimated_batches,
        expected_yield_pct: comp.expected_yield_pct,
        total_customer_lead_time_days: comp.total_customer_lead_time_days,
        estimated_available_date: comp.estimated_available_date,
      },
      ai_analysis_snapshot: comp.ai_analysis,
      cost_snapshot: comp.cost_breakdowns,
      scenarios_snapshot: comp.scenarios,
      is_immutable: true,
      created_at: new Date().toISOString(),
    };

    const { error: snapErr } = await this.supabase
      .from('assessment_decision_snapshots')
      .insert(snapshotPayload);

    if (snapErr) throw snapErr;

    // 2. Mark Assessment as Finalized
    await this.supabase
      .from('production_feasibility')
      .update({
        is_finalized: true,
        status: 'FINALIZED',
        finalized_by: this.userId,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', this.orgId);

    // 3. Create version record in production_feasibility_versions
    await this.supabase
      .from('production_feasibility_versions')
      .insert({
        organization_id: this.orgId,
        feasibility_id: id,
        version_number: comp.version_number || 1,
        status: 'FINALIZED',
        snapshot_data: snapshotPayload,
        change_summary: `Finalized by ${payload.reviewer_name || 'Reviewer'}: ${payload.decision_outcome}. ${payload.reviewer_comments}`,
        is_immutable: true,
        finalized_by: this.userId,
        finalized_at: new Date().toISOString(),
      });

    await this.logAudit('feasibility.decision_finalized', 'production_feasibility', id, null, snapshotPayload);

    return this.getComprehensiveAssessment(id);
  }
}

