export type OpportunityHealthStatus = 'HEALTHY' | 'ATTENTION' | 'AT_RISK' | 'CRITICAL';

export interface OpportunityHealthInput {
  nextActionDate?: string | null;
  overdueTasksCount?: number;
  highestTaskDelayDays?: number;
  qualificationStatus?: string;
  riskLevel?: string;
  probability?: number;
  stage?: string;
  status?: string;
}

export class OpportunityMetricsService {
  /**
   * Computes weighted pipeline financial value.
   */
  public static calculateWeightedValue(
    estimatedValue?: number | null,
    probability?: number | null
  ): number {
    if (!estimatedValue || estimatedValue <= 0) return 0;
    const prob = probability !== undefined && probability !== null ? Math.min(100, Math.max(0, probability)) : 0;
    return Number(((estimatedValue * prob) / 100).toFixed(2));
  }

  /**
   * Computes age in elapsed calendar days.
   */
  public static calculateOpportunityAgeDays(
    createdAt: string | Date,
    closedAt?: string | Date | null,
    referenceDate: Date = new Date()
  ): number {
    const start = new Date(createdAt);
    const end = closedAt ? new Date(closedAt) : referenceDate;
    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Computes next action delay in calendar days.
   */
  public static calculateNextActionDelayDays(
    nextActionDate?: string | null,
    linkedMaxTaskDelayDays: number = 0,
    referenceDate: Date = new Date()
  ): number {
    let dateDelay = 0;
    if (nextActionDate) {
      const target = new Date(nextActionDate);
      target.setHours(0, 0, 0, 0);
      const today = new Date(referenceDate);
      today.setHours(0, 0, 0, 0);

      const diffMs = today.getTime() - target.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        dateDelay = diffDays;
      }
    }

    // Return the max of action date delay and linked overdue task delay
    return Math.max(dateDelay, linkedMaxTaskDelayDays);
  }

  /**
   * Evaluates deterministic health state based on delay, risks, and stage progress.
   */
  public static evaluateHealth(input: OpportunityHealthInput, referenceDate: Date = new Date()): {
    health: OpportunityHealthStatus;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const delayDays = this.calculateNextActionDelayDays(
      input.nextActionDate,
      input.highestTaskDelayDays || 0,
      referenceDate
    );

    const isClosed = input.status === 'WON' || input.status === 'LOST' || input.status === 'CANCELLED';
    if (isClosed) {
      return { health: 'HEALTHY', reasons: ['Opportunity is resolved/closed.'] };
    }

    // Critical checks
    if (delayDays > 14) {
      reasons.push(`Severe operational delay (${delayDays} days overdue)`);
    }
    if (input.riskLevel === 'CRITICAL') {
      reasons.push('Unmitigated critical risk recorded');
    }
    if (input.qualificationStatus === 'NOT_QUALIFIED') {
      reasons.push('Disqualified during structured evaluation');
    }

    if (reasons.length > 0) {
      return { health: 'CRITICAL', reasons };
    }

    // At-Risk checks
    if (delayDays > 5) {
      reasons.push(`Moderate operational delay (${delayDays} days overdue)`);
    }
    if (input.riskLevel === 'HIGH') {
      reasons.push('High risk item pending mitigation');
    }
    if ((input.overdueTasksCount || 0) > 1) {
      reasons.push(`${input.overdueTasksCount} linked tasks are overdue`);
    }

    if (reasons.length > 0) {
      return { health: 'AT_RISK', reasons };
    }

    // Attention checks
    if (delayDays >= 1) {
      reasons.push(`Next action due date passed (${delayDays} day delay)`);
    }
    if (input.qualificationStatus === 'NOT_EVALUATED') {
      reasons.push('Pending formal qualification scoring');
    }

    if (reasons.length > 0) {
      return { health: 'ATTENTION', reasons };
    }

    return { health: 'HEALTHY', reasons: ['Opportunity on schedule with no blocking delays or critical risks'] };
  }
}
