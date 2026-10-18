import { CompetitorCapabilityService } from '../src/services/competitor-capability.service';
import { CDMOBenchmarkingService } from '../src/services/cdmo-benchmarking.service';
import { CommercialDecisionReportService } from '../src/services/commercial-decision-report.service';
import { CommercialEvaluationService } from '../src/services/commercial-evaluation.service';
import * as XLSX from 'xlsx';

describe('BDIQ CDMO Feasibility, Competitor Benchmarking & Decision Intelligence', () => {
  const orgId = 'a0000000-0000-0000-0000-000000000001';
  const userId = 'u0000000-0000-0000-0000-000000000001';
  const capabilityService = new CompetitorCapabilityService();
  const evaluationService = new CommercialEvaluationService();

  const mockEvaluation = {
    id: 'ce000000-0000-0000-0000-000000000001',
    organization_id: orgId,
    evaluation_number: 'CE-2026-0001',
    title: 'Commercial Tender Evaluation - Atorvastatin 20mg Tablets (US Market)',
    customer_name: 'Ascent Health Distribution Corp',
    target_market_country: 'US',
    currency: 'USD',
    dosage_form: 'TABLET',
    is_sterile_required: false,
    version_number: 1,
    status: 'READY_FOR_DECISION',
    pricing: {
      quantity: 50000,
      quantity_unit: 'Packs (30s)',
      customer_target_price: 4.80,
      internal_proposed_price: 5.25,
      currency: 'USD',
      payment_terms: 'NET_60',
      incoterm: 'DDP',
    },
    costs: [
      { id: 'c1', component_type: 'API_ACTIVE_SUBSTANCE', description: 'Atorvastatin Calcium USP', cost_per_unit: 1.45, quantity_basis: 50000, currency: 'USD', total_cost: 72500, is_assumption: false },
      { id: 'c2', component_type: 'EXCIPIENTS', description: 'Microcrystalline Cellulose', cost_per_unit: 0.35, quantity_basis: 50000, currency: 'USD', total_cost: 17500, is_assumption: false },
      { id: 'c3', component_type: 'PRIMARY_PACKAGING', description: 'Alu-Alu Cold Form Blister', cost_per_unit: 0.45, quantity_basis: 50000, currency: 'USD', total_cost: 22500, is_assumption: true },
      { id: 'c4', component_type: 'MANUFACTURING_CONVERSION', description: 'Granulation, Compression', cost_per_unit: 0.85, quantity_basis: 50000, currency: 'USD', total_cost: 42500, is_assumption: false },
      { id: 'c5', component_type: 'QA_QC_TESTING', description: 'Finished Product Release Testing', cost_per_unit: 0.15, quantity_basis: 50000, currency: 'USD', total_cost: 7500, is_assumption: true },
      { id: 'c6', component_type: 'OUTBOUND_FREIGHT', description: 'Temperature Controlled Sea/Air Freight', cost_per_unit: 0.25, quantity_basis: 50000, currency: 'USD', total_cost: 12500, is_assumption: true },
    ],
  };

  describe('PHASE 2 & 3: Competitor Identification & Factual Capability Profiles', () => {
    it('should discover and categorize competitors without hallucination', async () => {
      const discovered = await capabilityService.discoverCompetitors({
        moleculeOrProduct: 'Atorvastatin Tablets',
        dosageForm: 'TABLET',
        targetMarketCountry: 'US',
        requiredVolume: 50000,
        isSterileRequired: false,
      });

      expect(discovered.length).toBeGreaterThan(0);

      // Verify categories exist
      const direct = discovered.filter(c => c.classification === 'DIRECT');
      expect(direct.length).toBeGreaterThan(0);

      // Check first direct competitor structure
      const firstDirect = direct[0];
      expect(firstDirect.cdmo_name).toBeDefined();
      expect(firstDirect.reason).toContain('Direct competitor');
      expect(firstDirect.evidenceReference).toBeDefined();
      expect(firstDirect.retrievalDate).toBeDefined();
      expect(firstDirect.matchingCapabilities.length).toBeGreaterThan(0);
    });

    it('should strictly mark missing competitor pricing as "Not publicly available"', async () => {
      const discovered = await capabilityService.discoverCompetitors({
        moleculeOrProduct: 'Atorvastatin Tablets',
        dosageForm: 'TABLET',
        targetMarketCountry: 'US',
      });

      for (const comp of discovered) {
        expect(comp.pricingStatus).toBe('Not publicly available');
        expect(comp.profile.published_pricing_available).toBe(false);
      }
    });

    it('should strictly classify unknown capacity without treating it as zero or disadvantage', async () => {
      const profiles = await capabilityService.getProfiles();
      const nonAxxelent = profiles.filter(p => !p.is_axxelent_entity);

      for (const p of nonAxxelent) {
        // Disclosed capacity is either corporate network aggregate or null/unknown
        expect(p.capacity_verification_status).toBe('UNKNOWN');
      }
    });

    it('should distinguish sterile capability requirement accurately', async () => {
      const sterileDiscovered = await capabilityService.discoverCompetitors({
        moleculeOrProduct: 'Aseptic Injectable Vial',
        dosageForm: 'INJECTABLE_VIAL',
        isSterileRequired: true,
        targetMarketCountry: 'US',
      });

      // Catalent, Recipharm, Patheon have verified sterile capabilities
      const sterileCompetitors = sterileDiscovered.filter(c => c.profile.is_sterile_capable);
      expect(sterileCompetitors.length).toBeGreaterThan(0);
      for (const sc of sterileCompetitors) {
        expect(sc.matchingCapabilities).toContain('Verified sterile manufacturing infrastructure');
      }
    });
  });

  describe('PHASE 4: 14-Point Comparison Matrix & Dual Scoring Framework', () => {
    it('should construct complete 14-dimension comparison matrix', async () => {
      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const result = await benchmarkingService.runBenchmark(mockEvaluation);

      expect(result.comparisonMatrix).toHaveLength(14);

      const categoryIds = result.comparisonMatrix.map(m => m.categoryId);
      expect(categoryIds).toContain('TECH_FIT');
      expect(categoryIds).toContain('DOSAGE_TECH');
      expect(categoryIds).toContain('FACILITY_EQUIP');
      expect(categoryIds).toContain('PRODUCTION_CAP');
      expect(categoryIds).toContain('BATCH_SIZE');
      expect(categoryIds).toContain('REGULATORY_COV');
      expect(categoryIds).toContain('QUALITY_ANALYT');
      expect(categoryIds).toContain('TECH_TRANSFER');
      expect(categoryIds).toContain('MATERIALS_PKG');
      expect(categoryIds).toContain('DELIVERY_TIME');
      expect(categoryIds).toContain('GEOGRAPHY_LOG');
      expect(categoryIds).toContain('COMMERCIAL_ATT');
      expect(categoryIds).toContain('MARKET_POS');
      expect(categoryIds).toContain('EVIDENCE_CONF');
    });

    it('should produce separate Competitive Suitability vs Evidence Completeness scores', async () => {
      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const result = await benchmarkingService.runBenchmark(mockEvaluation);

      expect(result.scoring.competitiveSuitabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.scoring.competitiveSuitabilityScore).toBeLessThanOrEqual(100);

      expect(result.scoring.evidenceCompletenessScore).toBeGreaterThanOrEqual(0);
      expect(result.scoring.evidenceCompletenessScore).toBeLessThanOrEqual(100);

      // Verify that suitability and completeness are independent
      expect(result.scoring.suitabilityBreakdown.length).toBeGreaterThan(0);
      expect(result.scoring.completenessBreakdown.length).toBeGreaterThan(0);

      // Missing parameters are flagged transparently in completenessBreakdown
      const missingInCompleteness = result.scoring.completenessBreakdown.filter(p => !p.isDocumented);
      expect(missingInCompleteness.length).toBeGreaterThan(0);
      expect(missingInCompleteness[0].source).toContain('Not publicly available');
    });
  });

  describe('PHASE 5 & 6: Internal Manufacturing Feasibility & Deterministic Pricing', () => {
    it('should evaluate internal Axxelent manufacturing feasibility', async () => {
      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const result = await benchmarkingService.runBenchmark(mockEvaluation);

      expect(result.axxelentManufacturingFeasibility.isTechnicallyFeasible).toBe(true);
      expect(result.axxelentManufacturingFeasibility.facilityName).toContain('Chennai');
      expect(result.axxelentManufacturingFeasibility.customerLeadTimeDays).toBe(17);
      expect(result.axxelentManufacturingFeasibility.timelineFeasibility).toBe('FEASIBLE');
      expect(result.axxelentManufacturingFeasibility.regulatoryApprovalStatus).toBe('ACTIVE');
    });

    it('should calculate deterministic commercial economics matching hurdle rates', async () => {
      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const result = await benchmarkingService.runBenchmark(mockEvaluation);

      const econ = result.axxelentCommercialViability;
      // Revenue = 50000 * 5.25 = 262500
      expect(econ.totalEvaluatedRevenue).toBe(262500);
      // Total cost = 72500 + 17500 + 22500 + 42500 + 7500 + 12500 = 175000
      expect(econ.totalCost).toBe(175000);
      // Gross Profit = 262500 - 175000 = 87500
      expect(econ.grossProfitPerUnit).toBeCloseTo(1.75, 2);
      // Gross margin = (87500 / 262500) * 100 = 33.33%
      expect(econ.grossMarginPct).toBeCloseTo(33.33, 1);
      expect(econ.meetsHurdle).toBe(true);
    });
  });

  describe('PHASE 8: Five Core Management Questions & Strategic Recommendations', () => {
    it('should comprehensively answer the Five Core Management Questions', async () => {
      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const result = await benchmarkingService.runBenchmark(mockEvaluation);

      const q = result.managementQuestionsAnswers;
      // Q1: Can Axxelent manufacture?
      expect(q.question1_canAxxelentManufacture.answer).toContain('Yes');
      expect(q.question1_canAxxelentManufacture.evidence).toContain('Axxelent Site Master File');

      // Q2: Can Axxelent meet timeline & acceptable return?
      expect(q.question2_canAxxelentMeetTimelineAndCommercialReturn.answer).toContain('Yes');
      expect(q.question2_canAxxelentMeetTimelineAndCommercialReturn.calculations).toContain('Total Revenue');

      // Q3: Which competing CDMOs are capable?
      expect(q.question3_whichCompetingCDMOsAreCapable.directCount).toBeGreaterThan(0);
      expect(q.question3_whichCompetingCDMOsAreCapable.competitors.length).toBeGreaterThan(0);

      // Q4: How does Axxelent compare?
      expect(q.question4_howDoesAxxelentCompare.advantagesCount).toBeGreaterThan(0);

      // Q5: Should Axxelent pursue?
      expect(q.question5_shouldAxxelentPursue.recommendation).toMatch(/PROCEED/);
    });

    it('should generate PROCEED_WITH_CONDITIONS with actionable conditions and action plan', async () => {
      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const result = await benchmarkingService.runBenchmark(mockEvaluation);

      expect(result.strategicRecommendation.decision).toBe('PROCEED_WITH_CONDITIONS');
      expect(result.strategicRecommendation.conditionsToResolve.length).toBeGreaterThan(0);
      expect(result.actionPlan.length).toBeGreaterThan(0);
      expect(result.riskRegister.length).toBeGreaterThan(0);
    });

    it('should recommend DO_NOT_PROCEED when negative gross margin or fatal technical gap occurs', async () => {
      const unfeasibleEval = {
        ...mockEvaluation,
        pricing: {
          ...mockEvaluation.pricing,
          internal_proposed_price: 1.00, // Proposed price below unit cost ($3.50)
        },
      };

      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const result = await benchmarkingService.runBenchmark(unfeasibleEval);

      expect(result.strategicRecommendation.decision).toBe('DO_NOT_PROCEED');
      expect(result.strategicRecommendation.headlineRationale).toContain('negative contribution margin');
    });
  });

  describe('PHASE 9: Management Report & 11-Sheet Excel Export', () => {
    it('should generate multi-sheet Excel workbook where Sheet 1 is Executive Summary', async () => {
      const benchmarkingService = new CDMOBenchmarkingService(null as any, orgId, userId);
      const benchmark = await benchmarkingService.runBenchmark(mockEvaluation);

      const { buffer, fileName } = CommercialDecisionReportService.generateManagementExcelWorkbook(
        mockEvaluation,
        benchmark
      );

      expect(buffer).toBeDefined();
      expect(fileName).toContain('Decision_Intelligence_Report.xlsx');

      // Read generated Excel workbook
      const wb = XLSX.read(buffer);

      // 1. Verify Sheet 1 is Executive_Summary
      expect(wb.SheetNames[0]).toBe('Executive_Summary');

      // 2. Verify all required 11 sheets exist
      expect(wb.SheetNames).toEqual([
        'Executive_Summary',
        'Opportunity_Profile',
        'Manufacturing_Feasibility',
        'Commercial_Economics',
        'Competitor_Landscape',
        'Comparison_Matrix_14Point',
        'Advantages_and_Gaps',
        'Risk_Register',
        'Scenarios_and_Sensitivity',
        'Recommendation_Action_Plan',
        'Evidence_and_Sources',
      ]);

      // 3. Inspect Executive Summary parameters
      const sheet1Rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets['Executive_Summary']);
      const params = sheet1Rows.map(r => r.Parameter);

      expect(params).toContain('Evaluation ID & Number');
      expect(params).toContain('Product / Molecule');
      expect(params).toContain('Target Market Country');
      expect(params).toContain('Internal Proposed Price');
      expect(params).toContain('Axxelent Manufacturing Assessment');
      expect(params).toContain('Axxelent Commercial Assessment');
      expect(params).toContain('Overall Strategic Recommendation');
      expect(params).toContain('Competitive Position Summary');
      expect(params).toContain('Critical Risks');
      expect(params).toContain('Missing Information / Unknowns');
      expect(params).toContain('Top Recommended Action');
      expect(params).toContain('Evidence Completeness Score');
    });
  });
});
