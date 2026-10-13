import { ProductIdentityService } from '../src/services/product-identity.service';

describe('ProductIdentityService - Pharmaceutical Normalization & Duplicate Detection', () => {
  describe('Text and Strength Normalization', () => {
    it('normalizes product and molecule names safely', () => {
      expect(ProductIdentityService.normalizeText('  Atorvastatin  20mg  ')).toBe('atorvastatin 20mg');
      expect(ProductIdentityService.normalizeText('ATORVASTATIN-CALCIUM (USP)')).toBe('atorvastatin calcium usp');
      expect(ProductIdentityService.normalizeText('Amoxicillin + Clavulanic Acid 500/125mg')).toBe(
        'amoxicillin clavulanic acid 500 125mg'
      );
      expect(ProductIdentityService.normalizeText('')).toBe('');
      expect(ProductIdentityService.normalizeText(null)).toBe('');
    });

    it('normalizes numerical strength with units', () => {
      expect(ProductIdentityService.normalizeStrength(20, 'mg')).toBe('20 mg');
      expect(ProductIdentityService.normalizeStrength(0.5, 'MG/ML')).toBe('0.5 mg/ml');
      expect(ProductIdentityService.normalizeStrength(null, 'mg')).toBe('');
    });

    it('builds canonical formulation keys distinguishing presentations', () => {
      const key1 = ProductIdentityService.buildCanonicalKey({
        moleculeId: 'mol-1',
        strengthValue: 20,
        strengthUnitId: 'unit-mg',
        dosageFormId: 'form-tab',
        routeId: 'route-oral',
      });

      const key2 = ProductIdentityService.buildCanonicalKey({
        moleculeId: 'mol-1',
        strengthValue: 40,
        strengthUnitId: 'unit-mg',
        dosageFormId: 'form-tab',
        routeId: 'route-oral',
      });

      expect(key1).not.toBe(key2);
      expect(key1).toBe('mol-1::20::unit-mg::form-tab::route-oral');
      expect(key2).toBe('mol-1::40::unit-mg::form-tab::route-oral');
    });
  });

  describe('Dosage Form & Route Compatibility', () => {
    it('validates compatible routes for dosage forms', () => {
      const check1 = ProductIdentityService.validateDosageFormRouteCompatibility(
        'SOLID',
        ['ORAL', 'SUBLINGUAL'],
        'ORAL'
      );
      expect(check1.isCompatible).toBe(true);

      const check2 = ProductIdentityService.validateDosageFormRouteCompatibility(
        'SOLID',
        ['ORAL', 'SUBLINGUAL'],
        'INTRAVENOUS'
      );
      expect(check2.isCompatible).toBe(false);
      expect(check2.warning).toContain('incompatible for this dosage form');
    });
  });

  describe('Duplicate Detection Engine', () => {
    const existingCatalog = [
      {
        id: 'prod-001',
        product_code: 'PROD-2026-000001',
        product_name: 'Lipitor 20mg Film-Coated Tablets',
        brand_name: 'Lipitor',
        generic_name: 'Atorvastatin',
        molecule_id: 'mol-atorvastatin',
        dosage_form_id: 'form-fct',
        strength_value: 20,
        strength_unit_id: 'unit-mg',
        route_id: 'route-oral',
        normalized_name: 'lipitor 20mg film coated tablets',
        aliases: [{ normalized_alias: 'lipitor' }, { normalized_alias: 'atorva' }],
      },
      {
        id: 'prod-002',
        product_code: 'PROD-2026-000002',
        product_name: 'Glucophage 500mg Tablets',
        brand_name: 'Glucophage',
        generic_name: 'Metformin',
        molecule_id: 'mol-metformin',
        dosage_form_id: 'form-tab',
        strength_value: 500,
        strength_unit_id: 'unit-mg',
        route_id: 'route-oral',
        normalized_name: 'glucophage 500mg tablets',
        aliases: [{ normalized_alias: 'glucophage' }],
      },
    ];

    it('identifies exact canonical formulation duplicate with 100% confidence', () => {
      const result = ProductIdentityService.detectDuplicates(
        {
          productName: 'Atorvastatin 20 mg Tablets (Generic)',
          moleculeId: 'mol-atorvastatin',
          dosageFormId: 'form-fct',
          strengthValue: 20,
          routeId: 'route-oral',
        },
        existingCatalog
      );

      expect(result.hasPotentialDuplicates).toBe(true);
      expect(result.highestConfidence).toBe(100);
      expect(result.matches[0].productId).toBe('prod-001');
      expect(result.matches[0].matchReasons).toContain(
        'Identical molecule, strength, dosage form, and route of administration'
      );
    });

    it('identifies exact product name match with 95% confidence', () => {
      const result = ProductIdentityService.detectDuplicates(
        {
          productName: 'Lipitor 20mg Film-Coated Tablets',
          moleculeId: 'different-mol',
        },
        existingCatalog
      );

      expect(result.hasPotentialDuplicates).toBe(true);
      expect(result.highestConfidence).toBe(95);
      expect(result.matches[0].productId).toBe('prod-001');
      expect(result.matches[0].matchReasons).toContain('Exact normalized product name match');
    });

    it('distinguishes different strengths of the same molecule without 100% duplicate penalty', () => {
      const result = ProductIdentityService.detectDuplicates(
        {
          productName: 'Atorvastatin 40mg Tablets',
          moleculeId: 'mol-atorvastatin',
          dosageFormId: 'form-fct',
          strengthValue: 40, // Different strength (40mg vs 20mg)
          routeId: 'route-oral',
        },
        existingCatalog
      );

      // Same molecule + dosage form is a presentation sibling (score 65), NOT an identical duplicate (100)
      expect(result.hasPotentialDuplicates).toBe(true);
      expect(result.highestConfidence).toBe(65);
      expect(result.matches[0].matchReasons).toContain(
        'Same molecule and dosage form (different strength/presentation)'
      );
    });

    it('identifies brand alias match with 70% confidence', () => {
      const result = ProductIdentityService.detectDuplicates(
        {
          productName: 'Cardio Stat 10mg',
          brandName: 'Atorva',
        },
        existingCatalog
      );

      expect(result.hasPotentialDuplicates).toBe(true);
      expect(result.highestConfidence).toBe(70);
      expect(result.matches[0].productId).toBe('prod-001');
      expect(result.matches[0].matchReasons).toContain(
        'Brand matches an established alias of PROD-2026-000001'
      );
    });

    it('returns clean result when candidate has no similarity', () => {
      const result = ProductIdentityService.detectDuplicates(
        {
          productName: 'Pembrolizumab 100mg/4mL Injection',
          moleculeId: 'mol-pembro',
          dosageFormId: 'form-inj',
          strengthValue: 100,
          routeId: 'route-iv',
        },
        existingCatalog
      );

      expect(result.hasPotentialDuplicates).toBe(false);
      expect(result.highestConfidence).toBe(0);
      expect(result.matches).toHaveLength(0);
    });
  });
});
