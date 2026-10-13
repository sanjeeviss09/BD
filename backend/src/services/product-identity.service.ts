/**
 * Product Identity & Normalization Service
 * Authoritative engine for canonical pharmaceutical naming, text normalization,
 * dosage-form/route compatibility checks, and duplicate detection scoring.
 */

export interface DuplicateMatch {
  productId: string;
  productCode: string;
  productName: string;
  brandName?: string;
  confidenceScore: number; // 0 - 100
  matchReasons: string[];
}

export interface DuplicateDetectionResult {
  hasPotentialDuplicates: boolean;
  highestConfidence: number;
  matches: DuplicateMatch[];
}

export interface ProductIdentityInput {
  productName: string;
  genericName?: string;
  brandName?: string;
  moleculeId?: string;
  moleculeName?: string;
  dosageFormId?: string;
  strengthValue?: number;
  strengthUnitKey?: string;
  routeId?: string;
  countryOfOrigin?: string;
}

export class ProductIdentityService {
  /**
   * Cleans and normalizes text for reliable matching and duplicate detection.
   * Collapses extra spaces, removes special symbols, and converts to lowercase.
   */
  public static normalizeText(text?: string | null): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes a pharmaceutical strength representation.
   * E.g., " 20  mg " -> "20 mg", "0.5mg" -> "0.5 mg"
   */
  public static normalizeStrength(value?: number | null, unitSymbol?: string | null): string {
    if (value === undefined || value === null) return '';
    const unit = unitSymbol ? unitSymbol.trim().toLowerCase() : '';
    return `${value} ${unit}`.trim();
  }

  /**
   * Generates a canonical presentation key representing the specific
   * molecular formulation: molecule + strength + dosage_form + route.
   */
  public static buildCanonicalKey(input: {
    moleculeId?: string | null;
    strengthValue?: number | null;
    strengthUnitId?: string | null;
    dosageFormId?: string | null;
    routeId?: string | null;
  }): string {
    const mol = input.moleculeId || 'ANY_MOL';
    const strVal = input.strengthValue !== undefined && input.strengthValue !== null ? input.strengthValue : 'NO_VAL';
    const strUnit = input.strengthUnitId || 'NO_UNIT';
    const form = input.dosageFormId || 'ANY_FORM';
    const route = input.routeId || 'ANY_ROUTE';
    return `${mol}::${strVal}::${strUnit}::${form}::${route}`;
  }

  /**
   * Verifies if a selected Route of Administration is compatible with a Dosage Form.
   */
  public static validateDosageFormRouteCompatibility(
    dosageFormCategory: string,
    compatibleRoutes: string[] = [],
    selectedRouteKey?: string | null
  ): { isCompatible: boolean; warning?: string } {
    if (!selectedRouteKey || !compatibleRoutes || compatibleRoutes.length === 0) {
      return { isCompatible: true };
    }

    const normalizedRoute = selectedRouteKey.toUpperCase();
    const isDirectMatch = compatibleRoutes.map(r => r.toUpperCase()).includes(normalizedRoute);

    if (!isDirectMatch) {
      return {
        isCompatible: false,
        warning: `Selected route '${selectedRouteKey}' is uncommon or incompatible for this dosage form. Compatible routes: ${compatibleRoutes.join(', ')}`,
      };
    }

    return { isCompatible: true };
  }

  /**
   * Duplicate detection algorithm.
   * Compares a proposed product candidate against existing records in the organization.
   * Never automatically merges records; returns scored candidates for human review.
   */
  public static detectDuplicates(
    candidate: ProductIdentityInput,
    existingProducts: Array<{
      id: string;
      product_code: string;
      product_name: string;
      brand_name?: string | null;
      generic_name?: string | null;
      molecule_id?: string | null;
      dosage_form_id?: string | null;
      strength_value?: number | null;
      strength_unit_id?: string | null;
      route_id?: string | null;
      normalized_name?: string | null;
      country_of_origin?: string | null;
      aliases?: Array<{ normalized_alias: string }>;
    }>
  ): DuplicateDetectionResult {
    const candidateNormName = this.normalizeText(candidate.productName);
    const candidateBrandNorm = this.normalizeText(candidate.brandName);
    const matches: DuplicateMatch[] = [];

    for (const existing of existingProducts) {
      let score = 0;
      const reasons: string[] = [];

      const existingNormName = existing.normalized_name || this.normalizeText(existing.product_name);
      const existingBrandNorm = this.normalizeText(existing.brand_name);

      // 1. Exact normalized name match
      if (candidateNormName && existingNormName && candidateNormName === existingNormName) {
        score = Math.max(score, 95);
        reasons.push('Exact normalized product name match');
      }

      // 2. Canonical formulation match: molecule + strength + dosage form + route
      const sameMolecule = Boolean(
        candidate.moleculeId && existing.molecule_id && candidate.moleculeId === existing.molecule_id
      );
      const sameStrength =
        candidate.strengthValue !== undefined &&
        existing.strength_value !== undefined &&
        candidate.strengthValue !== null &&
        existing.strength_value !== null &&
        Number(candidate.strengthValue) === Number(existing.strength_value);
      const sameDosageForm = Boolean(
        candidate.dosageFormId && existing.dosage_form_id && candidate.dosageFormId === existing.dosage_form_id
      );
      const sameRoute = Boolean(candidate.routeId && existing.route_id && candidate.routeId === existing.route_id);

      if (sameMolecule && sameStrength && sameDosageForm && sameRoute) {
        score = Math.max(score, 100);
        reasons.push('Identical molecule, strength, dosage form, and route of administration');
      } else if (sameMolecule && sameStrength && sameDosageForm) {
        score = Math.max(score, 85);
        reasons.push('Same molecule, strength, and dosage form');
      } else if (sameMolecule && sameDosageForm) {
        score = Math.max(score, 65);
        reasons.push('Same molecule and dosage form (different strength/presentation)');
      }

      // 3. Brand name match
      if (candidateBrandNorm && existingBrandNorm && candidateBrandNorm === existingBrandNorm) {
        score = Math.max(score, 75);
        reasons.push(`Matching brand name '${candidate.brandName}'`);
      }

      // 4. Aliases match
      if (candidateBrandNorm && existing.aliases && existing.aliases.length > 0) {
        const foundAlias = existing.aliases.some(a => a.normalized_alias === candidateBrandNorm);
        if (foundAlias) {
          score = Math.max(score, 70);
          reasons.push(`Brand matches an established alias of ${existing.product_code}`);
        }
      }

      // Only include matches that reach significant threshold (>= 60)
      if (score >= 60) {
        matches.push({
          productId: existing.id,
          productCode: existing.product_code,
          productName: existing.product_name,
          brandName: existing.brand_name || undefined,
          confidenceScore: score,
          matchReasons: reasons,
        });
      }
    }

    // Sort by descending confidence score
    matches.sort((a, b) => b.confidenceScore - a.confidenceScore);

    return {
      hasPotentialDuplicates: matches.length > 0,
      highestConfidence: matches.length > 0 ? matches[0].confidenceScore : 0,
      matches,
    };
  }
}
