import { ProductIdentityService } from './product-identity.service';

export interface RegulatoryMatchResult {
  productId?: string;
  moleculeId?: string;
  matchType: 'EXACT_NAME_STRENGTH' | 'MOLECULE_FORM_MATCH' | 'ALIAS_MATCH' | 'FUZZY_CANDIDATE' | 'UNMATCHED';
  confidenceScore: number; // 0 - 100
  matchReasons: string[];
  matchStatus: 'AUTO_MATCHED_HIGH_CONFIDENCE' | 'CANDIDATE_REVIEW' | 'UNMATCHED';
}

export class RegulatoryMatchingService {
  /**
   * Deterministically match a source regulatory record against candidate canonical products.
   */
  public static matchRecordToProducts(
    rawRecord: {
      raw_product_name: string;
      raw_molecule_name?: string | null;
      raw_dosage_form?: string | null;
      raw_strength?: string | null;
    },
    canonicalProducts: any[],
    canonicalMolecules: any[] = []
  ): RegulatoryMatchResult {
    const rawNormalizedName = ProductIdentityService.normalizeText(rawRecord.raw_product_name);
    const rawMoleculeNormalized = ProductIdentityService.normalizeText(rawRecord.raw_molecule_name);
    const rawStrengthNormalized = rawRecord.raw_strength ? ProductIdentityService.normalizeText(rawRecord.raw_strength) : '';

    if (!rawNormalizedName && !rawMoleculeNormalized) {
      return {
        matchType: 'UNMATCHED',
        confidenceScore: 0,
        matchReasons: ['Missing product and molecule information in source record'],
        matchStatus: 'UNMATCHED',
      };
    }

    let bestMatch: any = null;
    let highestConfidence = 0;
    let reasons: string[] = [];
    let matchType: any = 'UNMATCHED';

    for (const product of canonicalProducts) {
      let score = 0;
      const currentReasons: string[] = [];

      const prodNormalized = ProductIdentityService.normalizeText(product.product_name || product.name);
      const prodGenericNormalized = ProductIdentityService.normalizeText(product.generic_name);
      const prodStrengthNormalized = product.strength_raw ? ProductIdentityService.normalizeText(product.strength_raw) : '';

      // 1. Exact Name Matching
      if (prodNormalized && (prodNormalized === rawNormalizedName || rawNormalizedName.includes(prodNormalized))) {
        score += 60;
        currentReasons.push(`Product name matched canonical product: "${product.product_name}"`);
      } else if (prodGenericNormalized && (prodGenericNormalized === rawNormalizedName || rawNormalizedName.includes(prodGenericNormalized))) {
        score += 50;
        currentReasons.push(`Generic name matched canonical product: "${product.generic_name}"`);
      }

      // 2. Molecule Match
      if (rawMoleculeNormalized && product.molecules?.canonical_name) {
        const molNormalized = ProductIdentityService.normalizeText(product.molecules.canonical_name);
        if (molNormalized === rawMoleculeNormalized || rawNormalizedName.includes(molNormalized)) {
          score += 25;
          currentReasons.push(`Molecule matched canonical active ingredient: "${product.molecules.canonical_name}"`);
        }
      }

      // 3. Strength Match
      if (rawStrengthNormalized && prodStrengthNormalized && rawStrengthNormalized === prodStrengthNormalized) {
        score += 15;
        currentReasons.push(`Strength representation matches: "${product.strength_raw}"`);
      }

      // Bound score to 100 max
      const finalScore = Math.min(score, 100);

      if (finalScore > highestConfidence) {
        highestConfidence = finalScore;
        bestMatch = product;
        reasons = currentReasons;

        if (finalScore >= 90) {
          matchType = 'EXACT_NAME_STRENGTH';
        } else if (finalScore >= 70) {
          matchType = 'MOLECULE_FORM_MATCH';
        } else if (finalScore >= 50) {
          matchType = 'FUZZY_CANDIDATE';
        }
      }
    }

    // Determine status: high confidence (>=80) can be auto-linked; candidate review (50-79); unmatched (<50)
    let matchStatus: any = 'UNMATCHED';
    if (highestConfidence >= 80) {
      matchStatus = 'AUTO_MATCHED_HIGH_CONFIDENCE';
    } else if (highestConfidence >= 45) {
      matchStatus = 'CANDIDATE_REVIEW';
    }

    return {
      productId: bestMatch ? bestMatch.id : undefined,
      moleculeId: bestMatch?.molecule_id || undefined,
      matchType: matchType,
      confidenceScore: highestConfidence,
      matchReasons: reasons.length > 0 ? reasons : ['No confident match found among existing canonical products'],
      matchStatus,
    };
  }
}
