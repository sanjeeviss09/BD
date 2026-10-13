import { CommercialCalculationService, PricingInputData, CostComponentInput } from '../src/services/commercial-calculation.service';
import { CommercialEvaluationService } from '../src/services/commercial-evaluation.service';
import crypto from 'crypto';

describe('Step 18: Commercial Evaluation Domain', () => {
  const service = new CommercialEvaluationService();
  const testOrgId = 'a0000000-0000-0000-0000-000000000001';
  const testAuthHeader = 'Bearer test-token';

  describe('1. Transparent Unit Economics Engine', () => {
    it('should compute valid revenue, total cost, gross profit, and gross margin %', () => {
      const costs: CostComponentInput[] = [
        { component_type: 'API', cost_per_unit: 0.12, is_assumption: false },
        { component_type: 'EXCIPIENT', cost_per_unit: 0.03, is_assumption: false },
        { component_type: 'MANUFACTURING', cost_per_unit: 0.05, is_assumption: false },
        { component_type: 'PACKAGING', cost_per_unit: 0.02, is_assumption: false },
        { component_type: 'LOGISTICS_FREIGHT', cost_per_unit: 0.01, is_assumption: true },
      ];

      const pricing: PricingInputData = {
        quantity: 1000000,
        quantity_unit: 'Packs',
        internal_proposed_price: 0.35,
        customer_target_price: 0.30,
        currency: 'USD',
      };

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);

      // Total unit cost = 0.12 + 0.03 + 0.05 + 0.02 + 0.01 = 0.23
      expect(economics.unitCost).toBe(0.23);
      expect(economics.unitSellingPrice).toBe(0.35);
      expect(economics.unitGrossProfit).toBeCloseTo(0.12, 4);
      expect(economics.totalRevenue).toBe(350000);
      expect(economics.totalCost).toBe(230000);
      expect(economics.totalGrossProfit).toBe(120000);
      // Margin = (120000 / 350000) * 100 = 34.2857%
      expect(economics.grossMarginPct).toBeCloseTo(34.29, 1);
      expect(economics.isDataComplete).toBe(true);
      expect(economics.missingInputs).toHaveLength(0);
    });

    it('should never coerce missing values to zero and flag missing inputs', () => {
      const pricing: PricingInputData = {
        quantity: 0,
        quantity_unit: 'Packs',
        internal_proposed_price: 0.35,
        currency: 'USD',
      };

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, []);

      expect(economics.isDataComplete).toBe(false);
      expect(economics.missingInputs.length).toBeGreaterThan(0);
      expect(economics.totalRevenue).toBeNull();
      expect(economics.grossMarginPct).toBeNull();
    });

    it('should not show valid gross margin % if revenue is zero', () => {
      const pricing: PricingInputData = {
        quantity: 100000,
        quantity_unit: 'Packs',
        internal_proposed_price: 0,
        currency: 'USD',
      };

      const costs: CostComponentInput[] = [
        { component_type: 'API', cost_per_unit: 0.10, is_assumption: false },
      ];

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);

      expect(economics.totalRevenue).toBe(0);
      expect(economics.grossMarginPct).toBeNull(); // Margin is undefined when revenue is 0
    });

    it('should correctly calculate break-even quantity when unit economics are positive', () => {
      const pricing: PricingInputData = {
        quantity: 500000,
        quantity_unit: 'Packs',
        internal_proposed_price: 1.00,
        currency: 'USD',
      };

      const costs: CostComponentInput[] = [
        { component_type: 'VARIABLE_COST', cost_per_unit: 0.60, is_assumption: false },
      ];

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);

      expect(economics.unitGrossProfit).toBe(0.40);
      expect(economics.breakEvenQuantity).toBeGreaterThan(0);
    });
  });

  describe('2. Scenario Modeling Engine (Base, Upside, Downside, Customer Target, Internal Offer)', () => {
    it('should generate 5 distinct scenarios with transparent assumptions and outputs', () => {
      const pricing: PricingInputData = {
        quantity: 1000000,
        quantity_unit: 'Packs',
        internal_proposed_price: 0.50,
        customer_target_price: 0.42,
        currency: 'USD',
      };

      const costs: CostComponentInput[] = [
        { component_type: 'API', cost_per_unit: 0.20, is_assumption: false },
        { component_type: 'MANUFACTURING', cost_per_unit: 0.10, is_assumption: false },
      ];

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);
      const scenarios = CommercialCalculationService.generateScenarios(pricing, economics);

      expect(scenarios).toHaveLength(5);

      const base = scenarios.find((s) => s.scenario_type === 'BASE_CASE');
      const upside = scenarios.find((s) => s.scenario_type === 'UPSIDE_CASE');
      const downside = scenarios.find((s) => s.scenario_type === 'DOWNSIDE_CASE');
      const target = scenarios.find((s) => s.scenario_type === 'CUSTOMER_TARGET_CASE');
      const offer = scenarios.find((s) => s.scenario_type === 'INTERNAL_OFFER_CASE');

      expect(base).toBeDefined();
      expect(upside).toBeDefined();
      expect(downside).toBeDefined();
      expect(target).toBeDefined();
      expect(offer).toBeDefined();

      // Upside price should be higher than base
      expect(upside!.unit_price).toBeGreaterThan(base!.unit_price);
      expect(upside!.calculated_gross_margin_pct).toBeGreaterThan(base!.calculated_gross_margin_pct!);

      // Downside price should be lower than base
      expect(downside!.unit_price).toBeLessThan(base!.unit_price);
      expect(downside!.calculated_gross_margin_pct).toBeLessThan(base!.calculated_gross_margin_pct!);

      // Target case price should equal customer target price
      expect(target!.unit_price).toBe(0.42);
    });
  });

  describe('3. 2D Sensitivity Matrix', () => {
    it('should compute controlled sensitivity across price and volume variations', () => {
      const matrix = CommercialCalculationService.generateSensitivityMatrix(1.00, 100000, 0.60);

      expect(matrix).toHaveLength(5); // -20%, -10%, 0%, +10%, +20%
      expect(matrix[0].cells).toHaveLength(5);

      // Base point row (price variation 0%)
      const baseRow = matrix.find((r: any) => r.priceVariationPct === 0);
      expect(baseRow).toBeDefined();
      expect(baseRow.unitPrice).toBe(1.00);

      // Base point cell (volume variation 0%)
      const baseCell = baseRow.cells.find((c: any) => c.volumeVariationPct === 0);
      expect(baseCell).toBeDefined();
      expect(baseCell.quantity).toBe(100000);
      expect(baseCell.grossProfit).toBe(40000);
      expect(baseCell.grossMarginPct).toBeCloseTo(40.0, 1);
    });
  });

  describe('4. Deterministic Risk Assessment Engine', () => {
    it('should detect NEGATIVE_MARGIN risk when cost exceeds price', () => {
      const pricing: PricingInputData = {
        quantity: 500000,
        quantity_unit: 'Packs',
        internal_proposed_price: 0.20,
        customer_target_price: 0.18,
        currency: 'USD',
      };

      const costs: CostComponentInput[] = [
        { component_type: 'API', cost_per_unit: 0.25, is_assumption: false },
      ];

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);
      const risks = CommercialCalculationService.evaluateCommercialRisks(economics, pricing, costs);

      const negRisk = risks.find((r) => r.riskCode === 'NEGATIVE_MARGIN');
      expect(negRisk).toBeDefined();
      expect(negRisk?.severity).toBe('CRITICAL');
    });

    it('should detect CUSTOMER_PRICE_GAP when proposed price is above target price by >10%', () => {
      const pricing: PricingInputData = {
        quantity: 500000,
        quantity_unit: 'Packs',
        internal_proposed_price: 0.40,
        customer_target_price: 0.30, // 25% below internal proposed price
        currency: 'USD',
      };

      const costs: CostComponentInput[] = [
        { component_type: 'API', cost_per_unit: 0.20, is_assumption: false },
      ];

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);
      const risks = CommercialCalculationService.evaluateCommercialRisks(economics, pricing, costs);

      const gapRisk = risks.find((r) => r.riskCode === 'CUSTOMER_PRICE_GAP');
      expect(gapRisk).toBeDefined();
      expect(gapRisk?.severity).toBe('HIGH');
    });

    it('should trigger DATA_GAP risk when critical inputs are missing', () => {
      const pricing: PricingInputData = {
        quantity: 0,
        quantity_unit: 'Packs',
        internal_proposed_price: 0.40,
        currency: 'USD',
      };

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, []);
      const risks = CommercialCalculationService.evaluateCommercialRisks(economics, pricing, []);

      const dataGapRisk = risks.find((r) => r.riskCode === 'DATA_GAP');
      expect(dataGapRisk).toBeDefined();
      expect(dataGapRisk?.severity).toBe('HIGH');
    });
  });

  describe('5. Rule-Based Commercial Recommendation and Transparent Scoring', () => {
    it('should recommend INSUFFICIENT_DATA when missing inputs exist', () => {
      const pricing: PricingInputData = {
        quantity: 0,
        quantity_unit: 'Packs',
        internal_proposed_price: 0,
        currency: 'USD',
      };

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, []);
      const assessment = CommercialCalculationService.evaluateRecommendation(economics, []);

      expect(assessment.recommendation).toBe('INSUFFICIENT_DATA');
      expect(assessment.rationales.length).toBeGreaterThan(0);
    });

    it('should recommend ATTRACTIVE when margin, volumes, and risks are favorable', () => {
      const pricing: PricingInputData = {
        quantity: 1000000,
        quantity_unit: 'Packs',
        internal_proposed_price: 1.00,
        customer_target_price: 1.05,
        currency: 'USD',
      };

      const costs: CostComponentInput[] = [
        { component_type: 'API', cost_per_unit: 0.60, is_assumption: false },
      ];

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);
      const assessment = CommercialCalculationService.evaluateRecommendation(economics, []);

      expect(assessment.recommendation).toBe('ATTRACTIVE');
      expect(assessment.score).toBeGreaterThanOrEqual(75);
      expect(assessment.scoreBreakdown.marginScore).toBe(35); // Full 35 pts for >=35% margin
    });

    it('should recommend UNATTRACTIVE when negative margin or critical risks present', () => {
      const pricing: PricingInputData = {
        quantity: 500000,
        quantity_unit: 'Packs',
        internal_proposed_price: 0.50,
        currency: 'USD',
      };

      const costs: CostComponentInput[] = [
        { component_type: 'API', cost_per_unit: 0.65, is_assumption: false },
      ];

      const economics = CommercialCalculationService.calculateUnitEconomics(pricing, costs);
      const risks = CommercialCalculationService.evaluateCommercialRisks(economics, pricing, costs);
      const assessment = CommercialCalculationService.evaluateRecommendation(economics, risks);

      expect(assessment.recommendation).toBe('UNATTRACTIVE');
      expect(assessment.rationales.some((r) => r.includes('Critical risks') || r.includes('negative'))).toBe(true);
    });
  });

  describe('6. Immutable Decision Snapshot and Cryptographic Lineage', () => {
    it('should compute deterministic SHA-256 hash for frozen snapshot data', () => {
      const payload = {
        evaluation_number: 'CE-2026-0001',
        version: 1,
        rfq_id: 'rfq-001',
        revenue: 350000,
        total_cost: 230000,
        gross_profit: 120000,
        margin_pct: 34.29,
        currency: 'USD',
      };

      const hash1 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const hash2 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string

      // Modifying payload changes hash
      const payloadModified = { ...payload, margin_pct: 34.30 };
      const hash3 = crypto.createHash('sha256').update(JSON.stringify(payloadModified)).digest('hex');
      expect(hash3).not.toBe(hash1);
    });
  });

  describe('7. Domain Service Operations & Excel Export', () => {
    it('should retrieve evaluation analytics summary with aggregated counts', async () => {
      const analytics = await service.getAnalytics(testAuthHeader, testOrgId);
      expect(analytics).toBeDefined();
      expect(analytics.totalEvaluations).toBeGreaterThanOrEqual(1);
      expect(analytics.averageMarginPct).toBeDefined();
      expect(analytics.recommendationBreakdown).toBeDefined();
    });

    it('should retrieve evaluation detail with economics, scenarios, and sensitivity attached', async () => {
      const evalDetail = await service.getEvaluation(testAuthHeader, testOrgId, 'ce000000-0000-0000-0000-000000000001');
      expect(evalDetail).toBeDefined();
      expect(evalDetail.economics).toBeDefined();
      expect(evalDetail.scenarios).toHaveLength(5);
      expect(evalDetail.sensitivity).toBeDefined();
    });

    it('should generate customizable multi-sheet Excel export buffer with Sheet 1 Executive Summary', async () => {
      const dossier = await service.exportCommercialDossier(
        testAuthHeader,
        testOrgId,
        'ce000000-0000-0000-0000-000000000001'
      );

      expect(dossier).toBeDefined();
      expect(Buffer.isBuffer(dossier.buffer)).toBe(true);
      expect(dossier.buffer.length).toBeGreaterThan(1000); // Valid XLSX file content
      expect(dossier.fileName).toContain('CE-2026-0001');
    });

    it('should seal evaluation and create immutable decision snapshot on finalization', async () => {
      const result = await service.finalizeEvaluation(
        testAuthHeader,
        testOrgId,
        'ce000000-0000-0000-0000-000000000002',
        { outcome: 'APPROVE_FOR_OFFER', reasoning: 'Tender meets threshold criteria after risk review.' },
        'usr-001'
      );

      expect(result.success).toBe(true);
      expect(result.snapshotHash).toHaveLength(64);
      expect(result.snapshot.decision_outcome).toBe('APPROVE_FOR_OFFER');

      // Attempting to finalize again must throw an error
      await expect(
        service.finalizeEvaluation(
          testAuthHeader,
          testOrgId,
          'ce000000-0000-0000-0000-000000000002',
          { outcome: 'APPROVE_FOR_OFFER', reasoning: 'Re-finalization attempt' },
          'usr-001'
        )
      ).rejects.toThrow('already finalized');
    });
  });
});
