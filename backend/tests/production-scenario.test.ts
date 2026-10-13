import { ProductionCalculationService } from '../src/services/production-calculation.service';

describe('Requirement 73: Production Scenario Automated Test', () => {
  const scenarioProduct = {
    product_name: 'Amoxicillin 500mg Oral Solid Capsule',
    dosage_form: 'CAPSULE',
    strength: '500 mg',
  };

  it('Phase 1: Annual requirement of 1,000,000 units with 100,000 batch size is FEASIBLE', () => {
    const annualVolume = 1000000;
    const batchSize = 100000;
    const availableCapacity = 2000000;
    const committedCapacity = 800000;

    // Batch calculation with 100% standard yield
    const batchResult = ProductionCalculationService.calculateBatches({
      requiredQuantity: annualVolume,
      batchSize: batchSize,
      expectedYieldPct: 100.0,
      yieldSource: 'VALIDATED_YIELD'
    });

    expect(batchResult.estimatedBatches).toBe(10);
    expect(batchResult.requiredManufacturingQuantity).toBe(1000000);

    // Capacity assessment
    const capacityResult = ProductionCalculationService.calculateCapacity({
      availableCapacity: availableCapacity,
      committedCapacity: committedCapacity,
      newRequirement: annualVolume,
    });

    expect(capacityResult.remainingCapacity).toBe(1200000);
    expect(capacityResult.capacityGap).toBe(0);
    expect(capacityResult.isFeasible).toBe(true);
    expect(capacityResult.status).toBe('AVAILABLE');

    // Feasibility evaluation
    const scoreResult = ProductionCalculationService.calculateProductionScore({
      capacityResult,
      equipmentResult: {
        isCompatible: true,
        equipmentStatus: 'AVAILABLE',
        matchedEquipment: [],
        missingEquipmentTypes: [],
        unqualifiedEquipmentTypes: [],
        explanation: 'Equipment fully operational and qualified'
      },
      materialResult: {
        materialStatus: 'AVAILABLE',
        totalMaterials: 2,
        availableCount: 2,
        gapCount: 0,
        materialGaps: [],
        explanation: 'All materials in stock'
      },
      timelineResult: {
        isTimelineFeasible: true,
        delayDays: 0,
        status: 'TIMELINE_FEASIBLE',
        explanation: 'Timeline within schedule'
      },
      developmentRequired: false,
      technologyQualified: true,
      facilityApproved: true
    });

    const feasibilityDecision = ProductionCalculationService.determineFeasibilityResult({
      scoreResult,
      capacityResult,
      equipmentResult: {
        isCompatible: true,
        equipmentStatus: 'AVAILABLE',
        matchedEquipment: [],
        missingEquipmentTypes: [],
        unqualifiedEquipmentTypes: [],
        explanation: 'Available'
      },
      materialResult: {
        materialStatus: 'AVAILABLE',
        totalMaterials: 2,
        availableCount: 2,
        gapCount: 0,
        materialGaps: [],
        explanation: 'Available'
      },
      timelineResult: {
        isTimelineFeasible: true,
        delayDays: 0,
        status: 'TIMELINE_FEASIBLE',
        explanation: 'Timeline feasible'
      },
      developmentRequired: false,
      technologyQualified: true,
      regulatoryApproved: true
    });

    expect(feasibilityDecision.feasibilityResult).toBe('FEASIBLE');
    expect(feasibilityDecision.recommendation).toBe('PROCEED');
  });

  it('Phase 2: Annual requirement of 1,500,000 units exceeds remaining capacity -> CAPACITY CONSTRAINED', () => {
    const annualVolume = 1500000;
    const availableCapacity = 2000000;
    const committedCapacity = 800000;

    const capacityResult = ProductionCalculationService.calculateCapacity({
      availableCapacity: availableCapacity,
      committedCapacity: committedCapacity,
      newRequirement: annualVolume,
    });

    expect(capacityResult.remainingCapacity).toBe(1200000);
    expect(capacityResult.capacityGap).toBe(300000);
    expect(capacityResult.isFeasible).toBe(false);
    expect(capacityResult.status).toBe('CONSTRAINED');

    const scoreResult = ProductionCalculationService.calculateProductionScore({
      capacityResult,
      equipmentResult: {
        isCompatible: true,
        equipmentStatus: 'AVAILABLE',
        matchedEquipment: [],
        missingEquipmentTypes: [],
        unqualifiedEquipmentTypes: [],
        explanation: 'Equipment fully operational and qualified'
      },
      materialResult: {
        materialStatus: 'AVAILABLE',
        totalMaterials: 1,
        availableCount: 1,
        gapCount: 0,
        materialGaps: [],
        explanation: 'In stock'
      },
      timelineResult: {
        isTimelineFeasible: true,
        delayDays: 0,
        status: 'TIMELINE_FEASIBLE',
        explanation: 'Feasible'
      },
      developmentRequired: false,
      technologyQualified: true,
      facilityApproved: true
    });

    const feasibilityDecision = ProductionCalculationService.determineFeasibilityResult({
      scoreResult,
      capacityResult,
      equipmentResult: {
        isCompatible: true,
        equipmentStatus: 'AVAILABLE',
        matchedEquipment: [],
        missingEquipmentTypes: [],
        unqualifiedEquipmentTypes: [],
        explanation: 'Available'
      },
      materialResult: {
        materialStatus: 'AVAILABLE',
        totalMaterials: 1,
        availableCount: 1,
        gapCount: 0,
        materialGaps: [],
        explanation: 'Available'
      },
      timelineResult: {
        isTimelineFeasible: true,
        delayDays: 0,
        status: 'TIMELINE_FEASIBLE',
        explanation: 'Timeline feasible'
      },
      developmentRequired: false,
      technologyQualified: true,
      regulatoryApproved: true
    });

    expect(feasibilityDecision.feasibilityResult).toBe('CAPACITY_CONSTRAINED');
    expect(feasibilityDecision.recommendation).toBe('HOLD_FOR_CAPACITY');
    expect(feasibilityDecision.recommendationReason).toContain('300,000 units');
  });
});
