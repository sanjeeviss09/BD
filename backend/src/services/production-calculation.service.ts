/**
 * BDIQ Production Feasibility & Manufacturing Intelligence Platform
 * Centralized Deterministic Calculation Engine
 * 
 * Rules:
 * - Deterministic, transparent, explainable formulas
 * - No AI / No black-box scoring
 * - Frontend is display only; backend is authoritative
 */

export interface CapacityInput {
  availableCapacity: number;
  committedCapacity: number;
  reservedCapacity?: number;
  newRequirement: number;
  periodYear?: number;
  periodType?: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';
  lineName?: string;
}

export interface CapacityEvaluationResult {
  remainingCapacity: number;
  utilizationPct: number;
  projectedUtilizationPct: number;
  isFeasible: boolean;
  capacityGap: number;
  status: 'AVAILABLE' | 'CONSTRAINED' | 'GAP';
  explanation: string;
}

export interface BatchCalculationInput {
  requiredQuantity: number;
  batchSize: number;
  expectedYieldPct?: number; // e.g. 95 for 95%
  yieldSource?: 'HISTORICAL_YIELD' | 'VALIDATED_YIELD' | 'ENGINEERING_ESTIMATE' | 'ASSUMPTION';
}

export interface BatchCalculationResult {
  requiredSaleableQuantity: number;
  expectedYieldPct: number;
  yieldAdjustmentFactor: number;
  requiredManufacturingQuantity: number;
  batchSize: number;
  estimatedBatches: number;
  yieldSource: string;
  explanation: string;
}

export interface LeadTimeInput {
  setupTimeHours: number;
  processingTimeHours: number;
  cleaningTimeHours: number;
  changeoverTimeHours: number;
  inspectionTimeHours?: number;
  waitingTimeHours?: number;
  testingReleaseDays: number;
  operatingHoursPerDay?: number; // default 16
}

export interface LeadTimeResult {
  manufacturingTimeHours: number;
  manufacturingLeadTimeDays: number;
  testingReleaseTimeDays: number;
  totalCustomerLeadTimeDays: number;
  breakdown: {
    setupTimeHours: number;
    processingTimeHours: number;
    cleaningTimeHours: number;
    changeoverTimeHours: number;
    inspectionTimeHours: number;
    waitingTimeHours: number;
  };
  explanation: string;
}

export interface TimelineComparisonInput {
  customerRequiredDate?: string | Date | null;
  estimatedAvailableDate?: string | Date | null;
}

export interface TimelineComparisonResult {
  isTimelineFeasible: boolean;
  delayDays: number;
  status: 'TIMELINE_FEASIBLE' | 'TIMELINE_CONSTRAINT' | 'DATA_UNAVAILABLE';
  explanation: string;
}

export interface MaterialRequirementItem {
  materialCategory: string;
  materialName: string;
  requiredQuantity: number;
  availableQuantity: number;
  leadTimeDays?: number;
  supplierName?: string;
  isCritical?: boolean;
}

export interface MaterialEvaluationResult {
  materialStatus: 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'NOT_AVAILABLE' | 'SUPPLIER_DEPENDENT' | 'LONG_LEAD' | 'UNKNOWN';
  totalMaterials: number;
  availableCount: number;
  gapCount: number;
  materialGaps: Array<{
    materialName: string;
    category: string;
    required: number;
    available: number;
    gapQuantity: number;
    leadTimeDays?: number;
    supplierName?: string;
  }>;
  explanation: string;
}

export interface EquipmentCheckItem {
  requiredType: string;
  isCritical?: boolean;
}

export interface AvailableEquipmentItem {
  id: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentType: string;
  qualificationStatus: string; // QUALIFIED, PARTIALLY_QUALIFIED, EXPIRED, NOT_QUALIFIED, UNKNOWN
  availabilityStatus: string;  // AVAILABLE, IN_USE, RESERVED, UNAVAILABLE
  maintenanceStatus?: string;  // OPERATIONAL, UNDER_MAINTENANCE, BREAKDOWN
}

export interface EquipmentCompatibilityResult {
  isCompatible: boolean;
  equipmentStatus: 'AVAILABLE' | 'GAP' | 'PARTIAL' | 'UNKNOWN';
  matchedEquipment: Array<{
    requiredType: string;
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    qualificationStatus: string;
  }>;
  missingEquipmentTypes: string[];
  unqualifiedEquipmentTypes: string[];
  explanation: string;
}

export interface ScoreFactor {
  factor: string;
  score: number;       // 0 to 100
  weight: number;      // 0.0 to 1.0 (sums to 1.0)
  weightedScore: number;
  evidence: string;
  reason: string;
}

export interface ProductionScoreResult {
  totalScore: number; // 0 to 100
  factors: ScoreFactor[];
  isDataComplete: boolean;
  missingFactors: string[];
}

export class ProductionCalculationService {
  /**
   * 1. Production Capacity Engine
   * Formula:
   * Remaining Capacity = Available Capacity - Committed Capacity - Reserved Capacity
   * Utilization % = (Committed Capacity / Available Capacity) * 100
   */
  static calculateCapacity(input: CapacityInput): CapacityEvaluationResult {
    const { availableCapacity, committedCapacity, reservedCapacity = 0, newRequirement } = input;

    if (availableCapacity <= 0) {
      return {
        remainingCapacity: 0,
        utilizationPct: 100,
        projectedUtilizationPct: 100,
        isFeasible: false,
        capacityGap: newRequirement,
        status: 'GAP',
        explanation: 'Available capacity is zero or undefined for the requested facility/line.'
      };
    }

    const remainingCapacity = Math.max(0, availableCapacity - committedCapacity - reservedCapacity);
    const utilizationPct = Math.min(100, Number(((committedCapacity / availableCapacity) * 100).toFixed(2)));
    const projectedCommitted = committedCapacity + newRequirement;
    const projectedUtilizationPct = Math.min(
      150,
      Number(((projectedCommitted / availableCapacity) * 100).toFixed(2))
    );

    const isFeasible = newRequirement <= remainingCapacity;
    const capacityGap = isFeasible ? 0 : Number((newRequirement - remainingCapacity).toFixed(2));

    const status = isFeasible
      ? 'AVAILABLE'
      : remainingCapacity > 0
      ? 'CONSTRAINED'
      : 'GAP';

    const explanation = isFeasible
      ? `Feasible: Requested volume (${newRequirement.toLocaleString()} units) is within remaining capacity (${remainingCapacity.toLocaleString()} units). Line utilization will increase from ${utilizationPct}% to ${projectedUtilizationPct}%.`
      : `Capacity Constrained: Requested volume (${newRequirement.toLocaleString()} units) exceeds remaining capacity (${remainingCapacity.toLocaleString()} units) by ${capacityGap.toLocaleString()} units. Projected line utilization would be ${projectedUtilizationPct}%.`;

    return {
      remainingCapacity,
      utilizationPct,
      projectedUtilizationPct,
      isFeasible,
      capacityGap,
      status,
      explanation
    };
  }

  /**
   * 2. Batch Calculation Engine with Yield Adjustment
   * Formula:
   * Required Manufacturing Quantity = Required Saleable Quantity / (Expected Yield % / 100)
   * Estimated Batches = ceil(Required Manufacturing Quantity / Batch Size)
   */
  static calculateBatches(input: BatchCalculationInput): BatchCalculationResult {
    const {
      requiredQuantity,
      batchSize,
      expectedYieldPct = 95.0,
      yieldSource = 'ENGINEERING_ESTIMATE'
    } = input;

    if (requiredQuantity <= 0 || batchSize <= 0) {
      return {
        requiredSaleableQuantity: requiredQuantity,
        expectedYieldPct,
        yieldAdjustmentFactor: 1.0,
        requiredManufacturingQuantity: 0,
        batchSize,
        estimatedBatches: 0,
        yieldSource,
        explanation: 'Cannot calculate batches: required quantity and batch size must be greater than zero.'
      };
    }

    const safeYieldPct = expectedYieldPct > 0 && expectedYieldPct <= 100 ? expectedYieldPct : 95.0;
    const yieldFactor = safeYieldPct / 100;
    const requiredManufacturingQuantity = Math.ceil(requiredQuantity / yieldFactor);
    const estimatedBatches = Math.ceil(requiredManufacturingQuantity / batchSize);

    const explanation = `Required saleable quantity: ${requiredQuantity.toLocaleString()} units. ` +
      `Yield factor: ${safeYieldPct}% (${yieldSource}). ` +
      `Required gross manufacturing quantity: ${requiredManufacturingQuantity.toLocaleString()} units. ` +
      `At batch size of ${batchSize.toLocaleString()} units, estimated total batches required: ${estimatedBatches}.`;

    return {
      requiredSaleableQuantity: requiredQuantity,
      expectedYieldPct: safeYieldPct,
      yieldAdjustmentFactor: Number(yieldFactor.toFixed(4)),
      requiredManufacturingQuantity,
      batchSize,
      estimatedBatches,
      yieldSource,
      explanation
    };
  }

  /**
   * 3. Process Lead Time Engine
   * Separates Manufacturing Time from Total Customer Lead Time.
   */
  static calculateLeadTime(input: LeadTimeInput): LeadTimeResult {
    const {
      setupTimeHours,
      processingTimeHours,
      cleaningTimeHours,
      changeoverTimeHours,
      inspectionTimeHours = 0,
      waitingTimeHours = 0,
      testingReleaseDays,
      operatingHoursPerDay = 16
    } = input;

    const manufacturingTimeHours = Number(
      (
        setupTimeHours +
        processingTimeHours +
        cleaningTimeHours +
        changeoverTimeHours +
        inspectionTimeHours +
        waitingTimeHours
      ).toFixed(2)
    );

    const safeOperatingHours = operatingHoursPerDay > 0 ? operatingHoursPerDay : 16;
    const manufacturingLeadTimeDays = Math.ceil(manufacturingTimeHours / safeOperatingHours);
    const totalCustomerLeadTimeDays = manufacturingLeadTimeDays + Math.max(0, testingReleaseDays);

    const explanation = `Manufacturing processing: ${manufacturingTimeHours} hours (${manufacturingLeadTimeDays} production days at ${safeOperatingHours} hrs/day) + ` +
      `Testing & QA release: ${testingReleaseDays} days = Total customer lead time: ${totalCustomerLeadTimeDays} days.`;

    return {
      manufacturingTimeHours,
      manufacturingLeadTimeDays,
      testingReleaseTimeDays: testingReleaseDays,
      totalCustomerLeadTimeDays,
      breakdown: {
        setupTimeHours,
        processingTimeHours,
        cleaningTimeHours,
        changeoverTimeHours,
        inspectionTimeHours,
        waitingTimeHours
      },
      explanation
    };
  }

  /**
   * 4. Customer Requirement Comparison
   */
  static compareTimeline(input: TimelineComparisonInput): TimelineComparisonResult {
    const { customerRequiredDate, estimatedAvailableDate } = input;

    if (!customerRequiredDate || !estimatedAvailableDate) {
      return {
        isTimelineFeasible: true,
        delayDays: 0,
        status: 'DATA_UNAVAILABLE',
        explanation: 'Customer required date or estimated availability date is not set; timeline comparison is pending.'
      };
    }

    const reqDate = new Date(customerRequiredDate);
    const availDate = new Date(estimatedAvailableDate);

    if (isNaN(reqDate.getTime()) || isNaN(availDate.getTime())) {
      return {
        isTimelineFeasible: true,
        delayDays: 0,
        status: 'DATA_UNAVAILABLE',
        explanation: 'Invalid date format provided for timeline comparison.'
      };
    }

    const diffTime = availDate.getTime() - reqDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        isTimelineFeasible: true,
        delayDays: 0,
        status: 'TIMELINE_FEASIBLE',
        explanation: `Timeline Feasible: Estimated availability (${availDate.toISOString().split('T')[0]}) meets or precedes customer requirement (${reqDate.toISOString().split('T')[0]}).`
      };
    }

    return {
      isTimelineFeasible: false,
      delayDays: diffDays,
      status: 'TIMELINE_CONSTRAINT',
      explanation: `Timeline Constraint: Estimated availability (${availDate.toISOString().split('T')[0]}) exceeds customer required date (${reqDate.toISOString().split('T')[0]}) by ${diffDays} day(s).`
    };
  }

  /**
   * 5. Equipment Compatibility Check
   */
  static checkEquipmentCompatibility(
    requiredEquipment: EquipmentCheckItem[],
    availableEquipment: AvailableEquipmentItem[]
  ): EquipmentCompatibilityResult {
    if (!requiredEquipment || requiredEquipment.length === 0) {
      return {
        isCompatible: true,
        equipmentStatus: 'AVAILABLE',
        matchedEquipment: [],
        missingEquipmentTypes: [],
        unqualifiedEquipmentTypes: [],
        explanation: 'No specific equipment requirements designated.'
      };
    }

    const matchedEquipment: EquipmentCompatibilityResult['matchedEquipment'] = [];
    const missingEquipmentTypes: string[] = [];
    const unqualifiedEquipmentTypes: string[] = [];

    for (const req of requiredEquipment) {
      const candidates = availableEquipment.filter(
        e => e.equipmentType.trim().toLowerCase() === req.requiredType.trim().toLowerCase()
      );

      if (candidates.length === 0) {
        missingEquipmentTypes.push(req.requiredType);
        continue;
      }

      // Check for fully qualified & operational machine
      const qualified = candidates.find(
        e =>
          e.qualificationStatus === 'QUALIFIED' &&
          e.availabilityStatus !== 'UNAVAILABLE' &&
          e.maintenanceStatus !== 'BREAKDOWN'
      );

      if (qualified) {
        matchedEquipment.push({
          requiredType: req.requiredType,
          equipmentId: qualified.id,
          equipmentCode: qualified.equipmentCode,
          equipmentName: qualified.equipmentName,
          qualificationStatus: qualified.qualificationStatus
        });
      } else {
        unqualifiedEquipmentTypes.push(req.requiredType);
      }
    }

    const hasMissing = missingEquipmentTypes.length > 0;
    const hasUnqualified = unqualifiedEquipmentTypes.length > 0;
    const isCompatible = !hasMissing && !hasUnqualified;

    let equipmentStatus: EquipmentCompatibilityResult['equipmentStatus'] = 'AVAILABLE';
    if (hasMissing) equipmentStatus = 'GAP';
    else if (hasUnqualified) equipmentStatus = 'PARTIAL';

    let explanation = 'All required equipment types are available and qualified at the facility.';
    if (hasMissing) {
      explanation = `Equipment Gap: The facility is missing critical equipment type(s): ${missingEquipmentTypes.join(', ')}.`;
    } else if (hasUnqualified) {
      explanation = `Qualification Gap: Equipment exists but lacks active qualification/availability for: ${unqualifiedEquipmentTypes.join(', ')}.`;
    }

    return {
      isCompatible,
      equipmentStatus,
      matchedEquipment,
      missingEquipmentTypes,
      unqualifiedEquipmentTypes,
      explanation
    };
  }

  /**
   * 6. Material Requirements & Availability Evaluation
   */
  static evaluateMaterials(materials: MaterialRequirementItem[]): MaterialEvaluationResult {
    if (!materials || materials.length === 0) {
      return {
        materialStatus: 'UNKNOWN',
        totalMaterials: 0,
        availableCount: 0,
        gapCount: 0,
        materialGaps: [],
        explanation: 'Material requirement bill-of-materials has not been uploaded or configured.'
      };
    }

    const materialGaps: MaterialEvaluationResult['materialGaps'] = [];
    let availableCount = 0;
    let hasLongLead = false;

    for (const m of materials) {
      const gap = Math.max(0, m.requiredQuantity - (m.availableQuantity || 0));
      if (gap > 0) {
        materialGaps.push({
          materialName: m.materialName,
          category: m.materialCategory,
          required: m.requiredQuantity,
          available: m.availableQuantity || 0,
          gapQuantity: Number(gap.toFixed(2)),
          leadTimeDays: m.leadTimeDays,
          supplierName: m.supplierName
        });
        if ((m.leadTimeDays || 0) > 60) {
          hasLongLead = true;
        }
      } else {
        availableCount++;
      }
    }

    const gapCount = materialGaps.length;
    let materialStatus: MaterialEvaluationResult['materialStatus'] = 'AVAILABLE';

    if (gapCount === materials.length) {
      materialStatus = 'NOT_AVAILABLE';
    } else if (gapCount > 0) {
      materialStatus = hasLongLead ? 'LONG_LEAD' : 'PARTIALLY_AVAILABLE';
    }

    const explanation = gapCount === 0
      ? `All ${materials.length} required materials are confirmed available in warehouse or existing reservation.`
      : `${gapCount} of ${materials.length} material(s) have shortages: ${materialGaps.map(g => `${g.materialName} (gap: ${g.gapQuantity})`).join(', ')}.`;

    return {
      materialStatus,
      totalMaterials: materials.length,
      availableCount,
      gapCount,
      materialGaps,
      explanation
    };
  }

  /**
   * 7. Transparent Production Feasibility Scoring Engine
   * Deterministic weighted score (0-100) with clear reasoning.
   */
  static calculateProductionScore(params: {
    capacityResult: CapacityEvaluationResult;
    equipmentResult: EquipmentCompatibilityResult;
    materialResult: MaterialEvaluationResult;
    timelineResult: TimelineComparisonResult;
    developmentRequired: boolean;
    developmentCategory?: string;
    technologyQualified: boolean;
    facilityApproved: boolean;
  }): ProductionScoreResult {
    const factors: ScoreFactor[] = [];
    const missingFactors: string[] = [];

    // Factor 1: Equipment Availability (Weight 20%)
    let equipScore = 100;
    let equipReason = 'All required equipment available and fully qualified.';
    if (params.equipmentResult.missingEquipmentTypes.length > 0) {
      equipScore = 10;
      equipReason = `Critical equipment missing: ${params.equipmentResult.missingEquipmentTypes.join(', ')}`;
    } else if (params.equipmentResult.unqualifiedEquipmentTypes.length > 0) {
      equipScore = 50;
      equipReason = `Equipment exists but requires qualification/maintenance: ${params.equipmentResult.unqualifiedEquipmentTypes.join(', ')}`;
    }
    factors.push({
      factor: 'Equipment Availability',
      score: equipScore,
      weight: 0.20,
      weightedScore: Number((equipScore * 0.20).toFixed(2)),
      evidence: params.equipmentResult.explanation,
      reason: equipReason
    });

    // Factor 2: Capacity Headroom (Weight 20%)
    let capScore = 100;
    let capReason = 'Adequate remaining capacity available on designated line.';
    if (!params.capacityResult.isFeasible) {
      capScore = 15;
      capReason = `Capacity constrained by ${params.capacityResult.capacityGap.toLocaleString()} units (Projected utilization: ${params.capacityResult.projectedUtilizationPct}%).`;
    } else if (params.capacityResult.projectedUtilizationPct > 85) {
      capScore = 65;
      capReason = `Capacity is available but line utilization will exceed 85% (${params.capacityResult.projectedUtilizationPct}%).`;
    }
    factors.push({
      factor: 'Capacity Headroom',
      score: capScore,
      weight: 0.20,
      weightedScore: Number((capScore * 0.20).toFixed(2)),
      evidence: params.capacityResult.explanation,
      reason: capReason
    });

    // Factor 3: Material Availability (Weight 15%)
    let matScore = 100;
    let matReason = 'All materials in stock or confirmed.';
    if (params.materialResult.materialStatus === 'UNKNOWN') {
      matScore = 40;
      matReason = 'BOM / Material availability data is currently incomplete or pending.';
      missingFactors.push('Material Bill of Materials');
    } else if (params.materialResult.gapCount > 0) {
      const gapRatio = params.materialResult.gapCount / (params.materialResult.totalMaterials || 1);
      matScore = Math.max(15, Math.round(100 - gapRatio * 85));
      matReason = `${params.materialResult.gapCount} material shortage(s) identified.`;
    }
    factors.push({
      factor: 'Material Availability',
      score: matScore,
      weight: 0.15,
      weightedScore: Number((matScore * 0.15).toFixed(2)),
      evidence: params.materialResult.explanation,
      reason: matReason
    });

    // Factor 4: Technology Fit (Weight 15%)
    const techScore = params.technologyQualified ? 100 : 30;
    factors.push({
      factor: 'Manufacturing Technology Fit',
      score: techScore,
      weight: 0.15,
      weightedScore: Number((techScore * 0.15).toFixed(2)),
      evidence: params.technologyQualified ? 'Technology validated at facility.' : 'Technology qualification required.',
      reason: params.technologyQualified ? 'Proven manufacturing technology in site portfolio.' : 'Technology transfer / qualification gap.'
    });

    // Factor 5: Facility & Regulatory Approval (Weight 10%)
    const facScore = params.facilityApproved ? 100 : 40;
    factors.push({
      factor: 'Facility Regulatory Standing',
      score: facScore,
      weight: 0.10,
      weightedScore: Number((facScore * 0.10).toFixed(2)),
      evidence: params.facilityApproved ? 'Facility holds requisite regulatory agency approvals.' : 'Regulatory validation / audit pending.',
      reason: params.facilityApproved ? 'Compliant manufacturing site.' : 'Target market regulatory agency audit required.'
    });

    // Factor 6: Timeline Feasibility (Weight 10%)
    let timeScore = 100;
    let timeReason = 'Achievable within customer required delivery timeline.';
    if (params.timelineResult.status === 'TIMELINE_CONSTRAINT') {
      timeScore = Math.max(20, 100 - params.timelineResult.delayDays * 2);
      timeReason = `Expected delay of ${params.timelineResult.delayDays} day(s).`;
    } else if (params.timelineResult.status === 'DATA_UNAVAILABLE') {
      timeScore = 60;
      timeReason = 'Customer required date not specified.';
      missingFactors.push('Customer Target Date');
    }
    factors.push({
      factor: 'Timeline Feasibility',
      score: timeScore,
      weight: 0.10,
      weightedScore: Number((timeScore * 0.10).toFixed(2)),
      evidence: params.timelineResult.explanation,
      reason: timeReason
    });

    // Factor 7: Development & Tech Transfer Requirement (Weight 10%)
    let devScore = 100;
    let devReason = 'Commercial ready; no formulation or analytical development required.';
    if (params.developmentRequired) {
      if (params.developmentCategory === 'FULL_DEVELOPMENT_PROGRAM') {
        devScore = 30;
        devReason = 'Full formulation/process development program required.';
      } else if (params.developmentCategory === 'SIGNIFICANT_DEVELOPMENT') {
        devScore = 50;
        devReason = 'Significant process optimization or scale-up required.';
      } else {
        devScore = 75;
        devReason = 'Minor method transfer or validation adjustment required.';
      }
    }
    factors.push({
      factor: 'Development Requirement',
      score: devScore,
      weight: 0.10,
      weightedScore: Number((devScore * 0.10).toFixed(2)),
      evidence: devReason,
      reason: devReason
    });

    const totalScore = Number(
      factors.reduce((sum, f) => sum + f.weightedScore, 0).toFixed(2)
    );

    return {
      totalScore,
      factors,
      isDataComplete: missingFactors.length === 0,
      missingFactors
    };
  }

  /**
   * 8. Core Feasibility Result & Recommendation Engine
   * Deterministic, explainable decision matrix.
   */
  static determineFeasibilityResult(params: {
    scoreResult: ProductionScoreResult;
    capacityResult: CapacityEvaluationResult;
    equipmentResult: EquipmentCompatibilityResult;
    materialResult: MaterialEvaluationResult;
    timelineResult: TimelineComparisonResult;
    developmentRequired: boolean;
    developmentCategory?: string;
    technologyQualified: boolean;
    regulatoryApproved: boolean;
    hasSterileGap?: boolean;
  }): {
    feasibilityResult: 
      | 'FEASIBLE'
      | 'CONDITIONALLY_FEASIBLE'
      | 'FEASIBLE_WITH_DEVELOPMENT'
      | 'CAPACITY_CONSTRAINED'
      | 'TECHNOLOGY_GAP'
      | 'EQUIPMENT_GAP'
      | 'MATERIAL_GAP'
      | 'REGULATORY_CONSTRAINT'
      | 'TIMELINE_CONSTRAINT'
      | 'NOT_FEASIBLE'
      | 'DATA_INSUFFICIENT';
    recommendation: 'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'HOLD_FOR_CAPACITY' | 'REJECT' | 'DATA_REQUIRED';
    recommendationReason: string;
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    // 1. Data Insufficient check
    if (params.scoreResult.missingFactors.length > 2) {
      return {
        feasibilityResult: 'DATA_INSUFFICIENT',
        recommendation: 'DATA_REQUIRED',
        recommendationReason: `Insufficient operational parameters: missing ${params.scoreResult.missingFactors.join(', ')}. Complete missing assessments to yield a definitive result.`,
        overallRisk: 'HIGH'
      };
    }

    // 2. Critical Blockers
    if (params.hasSterileGap) {
      return {
        feasibilityResult: 'NOT_FEASIBLE',
        recommendation: 'REJECT',
        recommendationReason: 'Product demands sterile manufacturing capability but facility lacks validated aseptic/terminal sterilization suites.',
        overallRisk: 'CRITICAL'
      };
    }

    if (params.equipmentResult.missingEquipmentTypes.length > 0) {
      return {
        feasibilityResult: 'EQUIPMENT_GAP',
        recommendation: 'REJECT',
        recommendationReason: `Site lacks mandatory manufacturing equipment: ${params.equipmentResult.missingEquipmentTypes.join(', ')}. Capital expenditure required.`,
        overallRisk: 'CRITICAL'
      };
    }

    if (!params.technologyQualified && !params.developmentRequired) {
      return {
        feasibilityResult: 'TECHNOLOGY_GAP',
        recommendation: 'PROCEED_WITH_CONDITIONS',
        recommendationReason: 'Required manufacturing technology is not validated at target facility; formal Technology Transfer program must be initiated.',
        overallRisk: 'HIGH'
      };
    }

    if (!params.capacityResult.isFeasible) {
      return {
        feasibilityResult: 'CAPACITY_CONSTRAINED',
        recommendation: 'HOLD_FOR_CAPACITY',
        recommendationReason: `Production line has insufficient capacity headroom. Shortfall: ${params.capacityResult.capacityGap.toLocaleString()} units. Reallocation or second shift needed.`,
        overallRisk: 'HIGH'
      };
    }

    if (!params.regulatoryApproved) {
      return {
        feasibilityResult: 'REGULATORY_CONSTRAINT',
        recommendation: 'PROCEED_WITH_CONDITIONS',
        recommendationReason: 'Target market regulatory agency authorization or site variation filing is required before commercial supply.',
        overallRisk: 'MEDIUM'
      };
    }

    if (params.materialResult.materialStatus === 'NOT_AVAILABLE') {
      return {
        feasibilityResult: 'MATERIAL_GAP',
        recommendation: 'HOLD_FOR_CAPACITY',
        recommendationReason: `Critical raw material shortages identified: ${params.materialResult.materialGaps.map(g => g.materialName).join(', ')}. Procurement confirmation required.`,
        overallRisk: 'HIGH'
      };
    }

    if (!params.timelineResult.isTimelineFeasible) {
      return {
        feasibilityResult: 'TIMELINE_CONSTRAINT',
        recommendation: 'PROCEED_WITH_CONDITIONS',
        recommendationReason: `Manufacturing lead time cannot satisfy customer target date (estimated ${params.timelineResult.delayDays} days delay). Commercial negotiation required.`,
        overallRisk: 'MEDIUM'
      };
    }

    // 3. Development Requirements
    if (params.developmentRequired && (params.developmentCategory === 'SIGNIFICANT_DEVELOPMENT' || params.developmentCategory === 'FULL_DEVELOPMENT_PROGRAM')) {
      return {
        feasibilityResult: 'FEASIBLE_WITH_DEVELOPMENT',
        recommendation: 'PROCEED_WITH_CONDITIONS',
        recommendationReason: 'Manufacture is viable subject to formulation/analytical development, exhibit batch execution, and regulatory stability filing.',
        overallRisk: 'MEDIUM'
      };
    }

    // 4. Conditional Feasibility
    if (params.materialResult.materialGaps.length > 0 || params.equipmentResult.unqualifiedEquipmentTypes.length > 0) {
      return {
        feasibilityResult: 'CONDITIONALLY_FEASIBLE',
        recommendation: 'PROCEED_WITH_CONDITIONS',
        recommendationReason: 'Technically feasible with manageable operational actions (calibration, material replenishment, line changeover scheduling).',
        overallRisk: 'MEDIUM'
      };
    }

    // 5. Clean Feasibility
    return {
      feasibilityResult: 'FEASIBLE',
      recommendation: 'PROCEED',
      recommendationReason: 'Product satisfies all facility, equipment, capacity, technology, material, and regulatory criteria without critical constraints.',
      overallRisk: 'LOW'
    };
  }

  /**
   * 9. Data Completeness Calculator (0 - 100%)
   */
  static calculateDataCompleteness(record: any): {
    percentage: number;
    breakdown: Record<string, boolean>;
    missingFields: string[];
  } {
    const checks: Record<string, boolean> = {
      product: Boolean(record.product_id || record.product_name),
      facility: Boolean(record.facility_id),
      technology: Boolean(record.dosage_form && record.route),
      equipment: Boolean(record.production_line_id),
      capacity: Boolean(record.required_quantity && record.batch_size),
      materials: Boolean(record.material_status && record.material_status !== 'UNKNOWN'),
      process: Boolean(record.manufacturing_lead_time_days > 0),
      quality: Boolean(record.quality_status && record.quality_status !== 'UNKNOWN'),
      regulatory: Boolean(record.regulatory_status),
      timeline: Boolean(record.customer_required_date && record.estimated_available_date)
    };

    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter(Boolean).length;
    const percentage = Number(((passedChecks / totalChecks) * 100).toFixed(1));

    const missingFields = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([field]) => field.charAt(0).toUpperCase() + field.slice(1));

    return {
      percentage,
      breakdown: checks,
      missingFields
    };
  }
}
