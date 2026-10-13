import {
  ProductionCalculationService,
  CapacityInput,
  BatchCalculationInput,
  LeadTimeInput,
  MaterialRequirementItem,
  AvailableEquipmentItem,
  EquipmentCheckItem
} from '../src/services/production-calculation.service';

describe('Production Feasibility Calculation Engine Suite', () => {
  describe('1. Capacity & Utilization Calculation', () => {
    it('calculates remaining capacity and utilization accurately', () => {
      const input: CapacityInput = {
        availableCapacity: 2000000,
        committedCapacity: 800000,
        reservedCapacity: 0,
        newRequirement: 1000000,
      };

      const result = ProductionCalculationService.calculateCapacity(input);

      expect(result.remainingCapacity).toBe(1200000);
      expect(result.utilizationPct).toBe(40.0);
      expect(result.projectedUtilizationPct).toBe(90.0);
      expect(result.isFeasible).toBe(true);
      expect(result.capacityGap).toBe(0);
      expect(result.status).toBe('AVAILABLE');
      expect(result.explanation).toContain('is within remaining capacity');
    });

    it('flags capacity constrained when requirement exceeds remaining capacity', () => {
      const input: CapacityInput = {
        availableCapacity: 2000000,
        committedCapacity: 800000,
        reservedCapacity: 0,
        newRequirement: 1500000,
      };

      const result = ProductionCalculationService.calculateCapacity(input);

      expect(result.remainingCapacity).toBe(1200000);
      expect(result.isFeasible).toBe(false);
      expect(result.capacityGap).toBe(300000);
      expect(result.status).toBe('CONSTRAINED');
      expect(result.projectedUtilizationPct).toBe(115.0);
      expect(result.explanation).toContain('exceeds remaining capacity');
    });

    it('handles zero available capacity safely', () => {
      const input: CapacityInput = {
        availableCapacity: 0,
        committedCapacity: 0,
        newRequirement: 50000,
      };

      const result = ProductionCalculationService.calculateCapacity(input);
      expect(result.isFeasible).toBe(false);
      expect(result.status).toBe('GAP');
    });
  });

  describe('2. Batch & Yield Adjustment Calculation', () => {
    it('calculates required manufacturing quantity and batch count with 95% yield', () => {
      const input: BatchCalculationInput = {
        requiredQuantity: 1000000,
        batchSize: 100000,
        expectedYieldPct: 95.0,
        yieldSource: 'HISTORICAL_YIELD',
      };

      const result = ProductionCalculationService.calculateBatches(input);

      // 1,000,000 / 0.95 = 1,052,631.57 -> ceil = 1,052,632
      expect(result.requiredManufacturingQuantity).toBe(1052632);
      // ceil(1,052,632 / 100,000) = 11 batches
      expect(result.estimatedBatches).toBe(11);
      expect(result.expectedYieldPct).toBe(95.0);
      expect(result.yieldSource).toBe('HISTORICAL_YIELD');
      expect(result.explanation).toContain('Yield factor: 95%');
    });

    it('calculates exact batches when yield is 100%', () => {
      const input: BatchCalculationInput = {
        requiredQuantity: 1000000,
        batchSize: 100000,
        expectedYieldPct: 100.0,
      };

      const result = ProductionCalculationService.calculateBatches(input);
      expect(result.requiredManufacturingQuantity).toBe(1000000);
      expect(result.estimatedBatches).toBe(10);
    });
  });

  describe('3. Process Lead Time Calculation', () => {
    it('separates manufacturing time from total customer lead time', () => {
      const input: LeadTimeInput = {
        setupTimeHours: 4,
        processingTimeHours: 20,
        cleaningTimeHours: 6,
        changeoverTimeHours: 2,
        testingReleaseDays: 14,
        operatingHoursPerDay: 16,
      };

      const result = ProductionCalculationService.calculateLeadTime(input);

      // Total manufacturing hours = 4 + 20 + 6 + 2 = 32 hours
      expect(result.manufacturingTimeHours).toBe(32);
      // Days = ceil(32 / 16) = 2 production days
      expect(result.manufacturingLeadTimeDays).toBe(2);
      // Customer lead time = 2 + 14 = 16 days
      expect(result.totalCustomerLeadTimeDays).toBe(16);
      expect(result.explanation).toContain('Total customer lead time: 16 days');
    });
  });

  describe('4. Timeline Comparison Calculation', () => {
    it('determines timeline is feasible when available date is on or before required date', () => {
      const result = ProductionCalculationService.compareTimeline({
        customerRequiredDate: '2026-12-01',
        estimatedAvailableDate: '2026-11-20',
      });

      expect(result.isTimelineFeasible).toBe(true);
      expect(result.delayDays).toBe(0);
      expect(result.status).toBe('TIMELINE_FEASIBLE');
    });

    it('determines timeline constraint when available date exceeds customer required date', () => {
      const result = ProductionCalculationService.compareTimeline({
        customerRequiredDate: '2026-11-01',
        estimatedAvailableDate: '2026-11-16',
      });

      expect(result.isTimelineFeasible).toBe(false);
      expect(result.delayDays).toBe(15);
      expect(result.status).toBe('TIMELINE_CONSTRAINT');
      expect(result.explanation).toContain('exceeds customer required date');
    });
  });

  describe('5. Equipment Compatibility Check', () => {
    const availableMachines: AvailableEquipmentItem[] = [
      {
        id: 'eq-1',
        equipmentCode: 'EQP-0001',
        equipmentName: 'High Shear Mixer Granulator',
        equipmentType: 'Granulator',
        qualificationStatus: 'QUALIFIED',
        availabilityStatus: 'AVAILABLE',
      },
      {
        id: 'eq-2',
        equipmentCode: 'EQP-0002',
        equipmentName: 'Rotary Tablet Press 45-Station',
        equipmentType: 'Compression Machine',
        qualificationStatus: 'QUALIFIED',
        availabilityStatus: 'AVAILABLE',
      },
      {
        id: 'eq-3',
        equipmentCode: 'EQP-0003',
        equipmentName: 'Auto-Coater 48 inch',
        equipmentType: 'Coating Machine',
        qualificationStatus: 'QUALIFIED',
        availabilityStatus: 'AVAILABLE',
      },
    ];

    it('returns compatible when all required machines exist and are qualified', () => {
      const required: EquipmentCheckItem[] = [
        { requiredType: 'Granulator' },
        { requiredType: 'Compression Machine' },
        { requiredType: 'Coating Machine' },
      ];

      const result = ProductionCalculationService.checkEquipmentCompatibility(required, availableMachines);
      expect(result.isCompatible).toBe(true);
      expect(result.equipmentStatus).toBe('AVAILABLE');
      expect(result.matchedEquipment).toHaveLength(3);
      expect(result.missingEquipmentTypes).toHaveLength(0);
    });

    it('identifies exact missing equipment when a required machine is absent', () => {
      const required: EquipmentCheckItem[] = [
        { requiredType: 'Granulator' },
        { requiredType: 'Lyophilizer' },
      ];

      const result = ProductionCalculationService.checkEquipmentCompatibility(required, availableMachines);
      expect(result.isCompatible).toBe(false);
      expect(result.equipmentStatus).toBe('GAP');
      expect(result.missingEquipmentTypes).toContain('Lyophilizer');
      expect(result.explanation).toContain('Lyophilizer');
    });
  });

  describe('6. Material Evaluation & Gap Detection', () => {
    it('detects material shortages and computes gap quantity', () => {
      const materials: MaterialRequirementItem[] = [
        {
          materialCategory: 'API',
          materialName: 'Amoxicillin Trihydrate Compacted',
          requiredQuantity: 1000,
          availableQuantity: 600,
          leadTimeDays: 45,
          supplierName: 'PharmaCore API Ltd',
        },
        {
          materialCategory: 'EXCIPIENT',
          materialName: 'Microcrystalline Cellulose PH-102',
          requiredQuantity: 500,
          availableQuantity: 500,
        },
      ];

      const result = ProductionCalculationService.evaluateMaterials(materials);

      expect(result.totalMaterials).toBe(2);
      expect(result.gapCount).toBe(1);
      expect(result.availableCount).toBe(1);
      expect(result.materialStatus).toBe('PARTIALLY_AVAILABLE');
      expect(result.materialGaps[0].materialName).toBe('Amoxicillin Trihydrate Compacted');
      expect(result.materialGaps[0].gapQuantity).toBe(400);
    });
  });

  describe('7. Explainable Feasibility Score & Recommendation', () => {
    it('produces a transparent score with factor weights and clear reasoning', () => {
      const capResult = ProductionCalculationService.calculateCapacity({
        availableCapacity: 2000000,
        committedCapacity: 800000,
        newRequirement: 1000000,
      });

      const equipResult = ProductionCalculationService.checkEquipmentCompatibility(
        [{ requiredType: 'Granulator' }],
        [{
          id: '1',
          equipmentCode: 'EQP-01',
          equipmentName: 'Granulator',
          equipmentType: 'Granulator',
          qualificationStatus: 'QUALIFIED',
          availabilityStatus: 'AVAILABLE'
        }]
      );

      const matResult = ProductionCalculationService.evaluateMaterials([
        {
          materialCategory: 'API',
          materialName: 'Paracetamol',
          requiredQuantity: 500,
          availableQuantity: 500
        }
      ]);

      const timeResult = ProductionCalculationService.compareTimeline({
        customerRequiredDate: '2026-12-01',
        estimatedAvailableDate: '2026-11-15'
      });

      const scoreResult = ProductionCalculationService.calculateProductionScore({
        capacityResult: capResult,
        equipmentResult: equipResult,
        materialResult: matResult,
        timelineResult: timeResult,
        developmentRequired: false,
        technologyQualified: true,
        facilityApproved: true
      });

      expect(scoreResult.totalScore).toBeGreaterThanOrEqual(90);
      expect(scoreResult.factors).toHaveLength(7);
      expect(scoreResult.factors[0].weight).toBe(0.20);
      expect(scoreResult.factors[0].factor).toBe('Equipment Availability');
    });
  });
});
