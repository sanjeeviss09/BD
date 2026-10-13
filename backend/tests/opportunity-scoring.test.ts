import { OpportunityScoringService } from '../src/services/opportunity-scoring.service';

describe('OpportunityScoringService - Multi-Criteria Weighted Qualification', () => {
  it('calculates weighted score accurately and marks as QUALIFIED when score >= 70%', () => {
    // 8 standard criteria (weights sum to 100)
    const inputs = [
      { criterion_key: 'STRATEGIC_FIT', score: 80 }, // weight 15 -> 12
      { criterion_key: 'MARKET_POTENTIAL', score: 85 }, // weight 15 -> 12.75
      { criterion_key: 'CUSTOMER_DEMAND', score: 70 }, // weight 10 -> 7
      { criterion_key: 'TECHNICAL_FEASIBILITY', score: 90 }, // weight 15 -> 13.5
      { criterion_key: 'REGULATORY_FEASIBILITY', score: 80 }, // weight 15 -> 12
      { criterion_key: 'MANUFACTURING_CAPABILITY', score: 75 }, // weight 10 -> 7.5
      { criterion_key: 'COMMERCIAL_POTENTIAL', score: 80 }, // weight 10 -> 8
      { criterion_key: 'TIMELINE_FEASIBILITY', score: 70 }, // weight 10 -> 7
    ];

    const result = OpportunityScoringService.calculateQualification(inputs);

    expect(result.totalScore).toBe(79.75);
    expect(result.qualificationResult).toBe('QUALIFIED');
    expect(result.criteriaScores).toHaveLength(8);
  });

  it('determines CONDITIONAL qualification when score is between 50% and 69.9%', () => {
    const inputs = [
      { criterion_key: 'STRATEGIC_FIT', score: 60 },
      { criterion_key: 'MARKET_POTENTIAL', score: 60 },
      { criterion_key: 'CUSTOMER_DEMAND', score: 50 },
      { criterion_key: 'TECHNICAL_FEASIBILITY', score: 60 },
      { criterion_key: 'REGULATORY_FEASIBILITY', score: 50 },
      { criterion_key: 'MANUFACTURING_CAPABILITY', score: 55 },
      { criterion_key: 'COMMERCIAL_POTENTIAL', score: 60 },
      { criterion_key: 'TIMELINE_FEASIBILITY', score: 50 },
    ];

    const result = OpportunityScoringService.calculateQualification(inputs);

    expect(result.totalScore).toBeGreaterThanOrEqual(50);
    expect(result.totalScore).toBeLessThan(70);
    expect(result.qualificationResult).toBe('CONDITIONAL');
  });

  it('determines NOT_QUALIFIED when score is below 50%', () => {
    const inputs = [
      { criterion_key: 'STRATEGIC_FIT', score: 40 },
      { criterion_key: 'MARKET_POTENTIAL', score: 30 },
      { criterion_key: 'CUSTOMER_DEMAND', score: 20 },
      { criterion_key: 'TECHNICAL_FEASIBILITY', score: 40 },
      { criterion_key: 'REGULATORY_FEASIBILITY', score: 30 },
      { criterion_key: 'MANUFACTURING_CAPABILITY', score: 35 },
      { criterion_key: 'COMMERCIAL_POTENTIAL', score: 40 },
      { criterion_key: 'TIMELINE_FEASIBILITY', score: 30 },
    ];

    const result = OpportunityScoringService.calculateQualification(inputs);

    expect(result.totalScore).toBeLessThan(50);
    expect(result.qualificationResult).toBe('NOT_QUALIFIED');
  });
});
