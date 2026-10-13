export interface QualificationCriterionInput {
  criterion_key: string;
  criterion_name?: string;
  score: number; // 0 - 100
  weight?: number;
  comment?: string;
  evidence_reference?: string;
}

export interface CalculatedQualificationScore {
  criterion_key: string;
  criterion_name: string;
  score: number;
  weight: number;
  weighted_score: number;
  comment?: string;
  evidence_reference?: string;
}

export interface QualificationRunResult {
  totalScore: number; // Percentage 0 - 100
  qualificationResult: 'QUALIFIED' | 'CONDITIONAL' | 'NOT_QUALIFIED';
  criteriaScores: CalculatedQualificationScore[];
  summary: string;
}

export const DEFAULT_QUALIFICATION_CRITERIA: Array<{
  key: string;
  name: string;
  defaultWeight: number;
  description: string;
}> = [
  { key: 'STRATEGIC_FIT', name: 'Strategic Portfolio Fit', defaultWeight: 15, description: 'Alignment with corporate therapeutic and geographic strategy' },
  { key: 'MARKET_POTENTIAL', name: 'Market Potential & Value', defaultWeight: 15, description: 'Market size, volume growth, and unmet need' },
  { key: 'CUSTOMER_DEMAND', name: 'Customer / Buyer Demand', defaultWeight: 10, description: 'Identified buyers, tenders, or distributor interest' },
  { key: 'TECHNICAL_FEASIBILITY', name: 'Technical & Formulation Feasibility', defaultWeight: 15, description: 'API availability, stability, formulation complexity' },
  { key: 'REGULATORY_FEASIBILITY', name: 'Regulatory & IP Feasibility', defaultWeight: 15, description: 'Filing pathway, patent landscape, DMF/CEP readiness' },
  { key: 'MANUFACTURING_CAPABILITY', name: 'Manufacturing & CMO Capability', defaultWeight: 10, description: 'Capacity, dosage line capability, batch scalability' },
  { key: 'COMMERCIAL_POTENTIAL', name: 'Commercial Viability & Margin', defaultWeight: 10, description: 'Gross margin, COGS, target pricing, payback period' },
  { key: 'TIMELINE_FEASIBILITY', name: 'Timeline & Investment Feasibility', defaultWeight: 10, description: 'Launch window, Capex, and R&D milestone timeline' },
];

export class OpportunityScoringService {
  /**
   * Retrieves standard qualification criteria schema.
   */
  public static getCriteria() {
    return DEFAULT_QUALIFICATION_CRITERIA;
  }

  /**
   * Calculates overall weighted score and determines qualification outcome.
   */
  public static calculateQualification(
    inputs: QualificationCriterionInput[]
  ): QualificationRunResult {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    const criteriaScores: CalculatedQualificationScore[] = [];

    for (const def of DEFAULT_QUALIFICATION_CRITERIA) {
      const provided = inputs.find(i => i.criterion_key === def.key);
      const rawScore = provided ? Math.min(100, Math.max(0, provided.score)) : 0;
      const weight = provided?.weight !== undefined && provided.weight > 0 ? provided.weight : def.defaultWeight;

      const weightedContribution = (rawScore * weight) / 100;
      totalWeightedScore += (rawScore * weight);
      totalWeight += weight;

      criteriaScores.push({
        criterion_key: def.key,
        criterion_name: provided?.criterion_name || def.name,
        score: rawScore,
        weight,
        weighted_score: Number(weightedContribution.toFixed(2)),
        comment: provided?.comment,
        evidence_reference: provided?.evidence_reference,
      });
    }

    const finalScorePercentage = totalWeight > 0 ? Number((totalWeightedScore / totalWeight).toFixed(2)) : 0;

    let qualificationResult: 'QUALIFIED' | 'CONDITIONAL' | 'NOT_QUALIFIED';
    if (finalScorePercentage >= 70) {
      qualificationResult = 'QUALIFIED';
    } else if (finalScorePercentage >= 50) {
      qualificationResult = 'CONDITIONAL';
    } else {
      qualificationResult = 'NOT_QUALIFIED';
    }

    const summary = `Opportunity scored ${finalScorePercentage}% (${qualificationResult}) across ${criteriaScores.length} weighted criteria.`;

    return {
      totalScore: finalScorePercentage,
      qualificationResult,
      criteriaScores,
      summary,
    };
  }
}
