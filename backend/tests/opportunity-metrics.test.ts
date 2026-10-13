import { OpportunityMetricsService } from '../src/services/opportunity-metrics.service';

describe('OpportunityMetricsService - Pipeline Value, Age, Delays & Health Ratings', () => {
  it('calculates weighted pipeline financial value correctly', () => {
    // 1,000,000 at 30% probability -> 300,000
    expect(OpportunityMetricsService.calculateWeightedValue(1000000, 30)).toBe(300000);
    // 250,000 at 75% probability -> 187,500
    expect(OpportunityMetricsService.calculateWeightedValue(250000, 75)).toBe(187500);
    // Zero or missing estimated value
    expect(OpportunityMetricsService.calculateWeightedValue(0, 50)).toBe(0);
    expect(OpportunityMetricsService.calculateWeightedValue(null, 50)).toBe(0);
  });

  it('calculates opportunity age in elapsed calendar days', () => {
    const created = new Date('2026-09-01T00:00:00Z');
    const today = new Date('2026-10-01T00:00:00Z');
    expect(OpportunityMetricsService.calculateOpportunityAgeDays(created, null, today)).toBe(30);

    const closed = new Date('2026-09-15T00:00:00Z');
    expect(OpportunityMetricsService.calculateOpportunityAgeDays(created, closed, today)).toBe(14);
  });

  it('calculates next action delay factoring both date and linked overdue tasks', () => {
    const refDate = new Date('2026-10-10T00:00:00Z');
    // Action was due 2026-10-05 (5 days overdue)
    expect(OpportunityMetricsService.calculateNextActionDelayDays('2026-10-05', 0, refDate)).toBe(5);

    // If a linked task is delayed 8 days, delay reflects the maximum (8 days)
    expect(OpportunityMetricsService.calculateNextActionDelayDays('2026-10-05', 8, refDate)).toBe(8);

    // Action due in future (no delay)
    expect(OpportunityMetricsService.calculateNextActionDelayDays('2026-10-15', 0, refDate)).toBe(0);
  });

  it('evaluates deterministic health rating accurately', () => {
    const refDate = new Date('2026-10-10T00:00:00Z');

    // Case 1: Healthy
    const healthy = OpportunityMetricsService.evaluateHealth(
      {
        nextActionDate: '2026-10-15',
        qualificationStatus: 'QUALIFIED',
        riskLevel: 'LOW',
        status: 'OPEN',
      },
      refDate
    );
    expect(healthy.health).toBe('HEALTHY');

    // Case 2: Attention needed (un-evaluated qualification)
    const attention = OpportunityMetricsService.evaluateHealth(
      {
        nextActionDate: '2026-10-15',
        qualificationStatus: 'NOT_EVALUATED',
        riskLevel: 'LOW',
        status: 'OPEN',
      },
      refDate
    );
    expect(attention.health).toBe('ATTENTION');

    // Case 3: At Risk (High risk item or delay > 5 days)
    const atRisk = OpportunityMetricsService.evaluateHealth(
      {
        nextActionDate: '2026-10-02', // 8 days overdue
        qualificationStatus: 'QUALIFIED',
        riskLevel: 'HIGH',
        status: 'OPEN',
      },
      refDate
    );
    expect(atRisk.health).toBe('AT_RISK');

    // Case 4: Critical (Severe delay > 14 days or Critical risk)
    const critical = OpportunityMetricsService.evaluateHealth(
      {
        nextActionDate: '2026-09-20', // 20 days overdue
        qualificationStatus: 'NOT_QUALIFIED',
        riskLevel: 'CRITICAL',
        status: 'OPEN',
      },
      refDate
    );
    expect(critical.health).toBe('CRITICAL');
  });
});
