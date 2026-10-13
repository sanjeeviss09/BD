import { RegulatoryMatchingService } from '../src/services/regulatory-matching.service';
import { RegulatoryRiskService } from '../src/services/regulatory-risk.service';
import { RegulatoryService } from '../src/services/regulatory.service';

describe('Step 13: Regulatory Intelligence Domain', () => {
  const canonicalProducts = [
    {
      id: 'p0000000-0000-0000-0000-000000000001',
      product_name: 'Atorvastatin 20mg Film-coated Tablets',
      generic_name: 'Atorvastatin Calcium',
      strength_raw: '20 mg',
      molecules: { canonical_name: 'Atorvastatin' },
      dosage_forms: { name: 'Tablet' },
    },
    {
      id: 'p0000000-0000-0000-0000-000000000002',
      product_name: 'Amoxicillin 500mg Capsules',
      generic_name: 'Amoxicillin Trihydrate',
      strength_raw: '500 mg',
      molecules: { canonical_name: 'Amoxicillin' },
      dosage_forms: { name: 'Capsule' },
    },
  ];

  describe('1. Pharmaceutical Entity Matching Engine', () => {
    it('should achieve high confidence auto-match for exact product and molecule', () => {
      const match = RegulatoryMatchingService.matchRecordToProducts(
        {
          raw_product_name: 'Atorvastatin 20mg Film-coated Tablets',
          raw_molecule_name: 'Atorvastatin',
          raw_strength: '20 mg',
        },
        canonicalProducts
      );

      expect(match.matchStatus).toBe('AUTO_MATCHED_HIGH_CONFIDENCE');
      expect(match.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(match.productId).toBe('p0000000-0000-0000-0000-000000000001');
      expect(match.matchReasons.length).toBeGreaterThan(0);
    });

    it('should assign CANDIDATE_REVIEW for partial or ambiguous match without auto-matching', () => {
      const match = RegulatoryMatchingService.matchRecordToProducts(
        {
          raw_product_name: 'Lipitor Atorva Generic Formulation',
          raw_molecule_name: 'Atorvastatin',
          raw_strength: '80 mg', // different strength
        },
        canonicalProducts
      );

      // Score should not be >=80, so it must not auto-match
      expect(match.matchStatus).not.toBe('AUTO_MATCHED_HIGH_CONFIDENCE');
      expect(match.confidenceScore).toBeLessThan(80);
    });

    it('should handle missing product/molecule safely and return UNMATCHED', () => {
      const match = RegulatoryMatchingService.matchRecordToProducts(
        {
          raw_product_name: '',
          raw_molecule_name: '',
        },
        canonicalProducts
      );

      expect(match.matchStatus).toBe('UNMATCHED');
      expect(match.confidenceScore).toBe(0);
      expect(match.productId).toBeUndefined();
    });
  });

  describe('2. Deterministic Regulatory Risk Engine', () => {
    it('should trigger NO_REGULATORY_DATA when jurisdiction has zero ingested records', () => {
      const risks = RegulatoryRiskService.evaluateRisks('JP', [], canonicalProducts[0]);
      expect(risks).toHaveLength(1);
      expect(risks[0].riskCode).toBe('NO_REGULATORY_DATA');
      expect(risks[0].severity).toBe('HIGH');
    });

    it('should trigger WITHDRAWN_STATUS or SUSPENDED_STATUS when authorization was revoked', () => {
      const records = [
        {
          jurisdiction_code: 'EU',
          normalized_status: 'WITHDRAWN',
          raw_status: 'Marketing authorization withdrawn by holder',
        },
      ];

      const risks = RegulatoryRiskService.evaluateRisks('EU', records, canonicalProducts[0]);
      const withdrawnRisk = risks.find((r) => r.riskCode === 'WITHDRAWN_STATUS');
      expect(withdrawnRisk).toBeDefined();
      expect(withdrawnRisk?.severity).toBe('CRITICAL');
    });

    it('should trigger EXPIRED_STATUS when filing lapsed past expiry date', () => {
      const records = [
        {
          jurisdiction_code: 'GB',
          normalized_status: 'EXPIRED',
          raw_status: 'Lapsed',
          expiry_date: '2020-01-01',
        },
      ];

      const risks = RegulatoryRiskService.evaluateRisks('GB', records, canonicalProducts[0]);
      const expiredRisk = risks.find((r) => r.riskCode === 'EXPIRED_STATUS');
      expect(expiredRisk).toBeDefined();
      expect(expiredRisk?.severity).toBe('HIGH');
    });

    it('should trigger DATA_STALE when source update exceeds 180 days', () => {
      const staleDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
      const records = [
        {
          jurisdiction_code: 'US',
          normalized_status: 'APPROVED',
          source_last_updated_date: staleDate,
        },
      ];

      const risks = RegulatoryRiskService.evaluateRisks('US', records, canonicalProducts[0]);
      const staleRisk = risks.find((r) => r.riskCode === 'DATA_STALE');
      expect(staleRisk).toBeDefined();
      expect(staleRisk?.severity).toBe('LOW');
    });
  });

  describe('3. Regulatory Intelligence Domain Service & Provenance', () => {
    const service = new RegulatoryService();
    const authHeader = 'Bearer test-token';
    const orgId = 'a0000000-0000-0000-0000-000000000001';

    it('should fetch authorized sources with reliability tier and statutory licensing', async () => {
      const sources = await service.getSources(authHeader, orgId);
      expect(sources.length).toBeGreaterThanOrEqual(3);
      expect(sources[0].source_type).toBe('OFFICIAL_REGULATORY_DATABASE');
      expect(sources[0].license_status).toBe('ACTIVE');
    });

    it('should fetch global regulatory authorities across jurisdictions', async () => {
      const authorities = await service.getAuthorities(authHeader);
      expect(authorities.length).toBeGreaterThanOrEqual(7);
      const codes = authorities.map((a: any) => a.code);
      expect(codes).toContain('US_FDA');
      expect(codes).toContain('EU_EMA');
      expect(codes).toContain('UK_MHRA');
    });

    it('should compile product regulatory profile with clear distinction between NOT_FOUND and NOT_APPROVED', async () => {
      const profile = await service.getProductRegulatoryProfile(authHeader, orgId, 'p0000000-0000-0000-0000-000000000001');
      expect(profile).toBeDefined();
      expect(profile.jurisdictionMatrix).toBeDefined();

      // Check US is APPROVED
      expect(profile.jurisdictionMatrix.US.status).toBe('APPROVED');
      expect(profile.jurisdictionMatrix.US.hasData).toBe(true);

      // Check unmonitored jurisdiction is NOT_FOUND and hasData is false
      expect(profile.jurisdictionMatrix.JP.status).toBe('NOT_FOUND');
      expect(profile.jurisdictionMatrix.JP.hasData).toBe(false);

      // Check transparent readiness formula
      expect(profile.readiness.score).toBeGreaterThan(0);
      expect(profile.readiness.formula).toContain('Readiness =');
    });

    it('should generate complete 4-level data lineage chain for record', async () => {
      const lineage = await service.getRecordLineage(authHeader, orgId, 'rec00000-0000-0000-0000-000000000001');
      expect(lineage.chain).toHaveLength(4);
      expect(lineage.chain[0].level).toBe('1_STATUS_METRIC');
      expect(lineage.chain[1].level).toBe('2_REGULATORY_RECORD');
      expect(lineage.chain[2].level).toBe('3_DATASET_VERSION');
      expect(lineage.chain[3].level).toBe('4_PRIMARY_SOURCE');
    });

    it('should generate an Excel export buffer with multi-sheet dossier structure', async () => {
      const exportData = await service.exportRegulatoryProfile(authHeader, orgId, 'p0000000-0000-0000-0000-000000000001');
      expect(exportData.buffer).toBeDefined();
      expect(exportData.fileName).toContain('_Regulatory_Profile.xlsx');
    });

    it('should create reproducible immutable assessment snapshots', async () => {
      const assessment = await service.createAssessment(
        authHeader,
        orgId,
        {
          product_id: 'p0000000-0000-0000-0000-000000000001',
          title: 'EU/US Feasibility Assessment',
          target_jurisdictions: ['US', 'EU'],
          readiness_score: 82,
        },
        'u0000000-0000-0000-0000-000000000001'
      );

      expect(assessment.id).toBeDefined();
      expect(assessment.assessment_number).toMatch(/^RA-\d{4}-\d{4}$/);
      expect(assessment.target_jurisdictions).toEqual(['US', 'EU']);
      expect(assessment.readiness_score).toBe(82);
    });
  });
});
