export interface StageDefinition {
  key: string;
  name: string;
  description: string;
  sort_order: number;
  default_probability: number;
  stage_type?: 'START' | 'PROCESS' | 'DECISION' | 'TERMINAL';
  is_terminal?: boolean;
}

/**
 * Standard Operational Workflow for Pharmaceutical BD (Step 10 Target Architecture)
 * NOTE: Strictly operational stage progression. No management review or approval stages.
 */
export const OPPORTUNITY_STAGES: StageDefinition[] = [
  { key: 'IDENTIFIED', name: 'Identified', description: 'Opportunity logged from lead or internal idea', sort_order: 1, default_probability: 10, stage_type: 'START' },
  { key: 'OPPORTUNITY_CREATED', name: 'Opportunity Created', description: 'Opportunity intake and commercial thesis recorded', sort_order: 1, default_probability: 10, stage_type: 'START' },
  { key: 'INITIAL_SCREENING', name: 'Initial Screening', description: 'Preliminary strategic fit check', sort_order: 2, default_probability: 20, stage_type: 'PROCESS' },
  { key: 'QUALIFICATION', name: 'Qualification', description: 'Structured multi-criteria qualification scoring', sort_order: 3, default_probability: 30, stage_type: 'PROCESS' },
  { key: 'MARKET_INTELLIGENCE', name: 'Market Intelligence', description: 'Addressable volume, pricing corridor, and competitive landscape', sort_order: 4, default_probability: 40, stage_type: 'PROCESS' },
  { key: 'MARKET_EVALUATION', name: 'Market Evaluation', description: 'Market size, volume, and competitor assessment', sort_order: 4, default_probability: 40, stage_type: 'PROCESS' },
  { key: 'TECHNICAL_EVALUATION', name: 'Technical Evaluation', description: 'Formulation, dosage form, batch size, and analytical feasibility', sort_order: 5, default_probability: 50, stage_type: 'PROCESS' },
  { key: 'REGULATORY_EVALUATION', name: 'Regulatory Evaluation', description: 'Filing pathway, patent exclusivity, and bioequivalence review', sort_order: 6, default_probability: 60, stage_type: 'PROCESS' },
  { key: 'PRODUCTION_FEASIBILITY', name: 'Production Feasibility', description: 'Manufacturing site selection, capacity, and lead time', sort_order: 7, default_probability: 65, stage_type: 'PROCESS' },
  { key: 'COMMERCIAL_EVALUATION', name: 'Commercial Evaluation', description: 'Cost of goods, pricing, margin modeling, and multi-year DCF', sort_order: 8, default_probability: 70, stage_type: 'PROCESS' },
  { key: 'RFQ', name: 'RFQ & Quotation', description: 'Request for Quotation submitted or reviewed', sort_order: 9, default_probability: 75, stage_type: 'PROCESS' },
  { key: 'CUSTOMER_EVALUATION', name: 'Customer Evaluation', description: 'Customer engagement and demand validation', sort_order: 9, default_probability: 75, stage_type: 'PROCESS' },
  { key: 'RFQ_CUSTOMER_ENGAGEMENT', name: 'RFQ / Customer Engagement', description: 'Quotation submitted, customer negotiation, and binding terms review', sort_order: 9, default_probability: 75, stage_type: 'PROCESS' },
  { key: 'NEGOTIATION', name: 'Commercial Negotiation', description: 'Commercial terms and supply agreements negotiation', sort_order: 10, default_probability: 85, stage_type: 'DECISION' },
  { key: 'OPPORTUNITY_DECISION', name: 'Opportunity Decision', description: 'Final commercial and partner decision checkpoint for deal execution', sort_order: 11, default_probability: 90, stage_type: 'DECISION' },
  { key: 'WON', name: 'Won / Contracted', description: 'Commercially secured or development greenlit', sort_order: 12, default_probability: 100, stage_type: 'TERMINAL', is_terminal: true },
  { key: 'LOST', name: 'Lost / Closed', description: 'Discontinued or declined opportunity', sort_order: 13, default_probability: 0, stage_type: 'TERMINAL', is_terminal: true },
  { key: 'ON_HOLD', name: 'On Hold', description: 'Temporarily paused due to customer postponement or market constraint', sort_order: 14, default_probability: 10, stage_type: 'TERMINAL', is_terminal: true },
];

export class OpportunityWorkflowService {
  /**
   * Retrieves all canonical operational stages (filtering aliases for UI display).
   */
  public static getStages(): StageDefinition[] {
    // Return primary stages
    const primaryKeys = [
      'OPPORTUNITY_CREATED',
      'QUALIFICATION',
      'MARKET_INTELLIGENCE',
      'TECHNICAL_EVALUATION',
      'REGULATORY_EVALUATION',
      'PRODUCTION_FEASIBILITY',
      'COMMERCIAL_EVALUATION',
      'RFQ_CUSTOMER_ENGAGEMENT',
      'OPPORTUNITY_DECISION',
      'WON',
      'LOST',
      'ON_HOLD',
    ];
    return OPPORTUNITY_STAGES.filter(s => primaryKeys.includes(s.key));
  }

  /**
   * Retrieves definition for any stage key, including legacy aliases.
   */
  public static getStage(key: string): StageDefinition | undefined {
    return OPPORTUNITY_STAGES.find(s => s.key === key.toUpperCase());
  }

  /**
   * Validates if transition from currentStage to targetStage is permissible.
   */
  public static validateTransition(
    currentStage: string,
    targetStage: string,
    opportunityState: {
      qualification_status?: string;
      closed_reason?: string;
      estimated_value?: number;
      products_count?: number;
    }
  ): { isValid: boolean; error?: string; suggestedProbability?: number } {
    const currentDef = this.getStage(currentStage);
    const targetDef = this.getStage(targetStage);

    if (!targetDef) {
      return { isValid: false, error: `Invalid target stage: ${targetStage}` };
    }

    if (currentStage.toUpperCase() === targetStage.toUpperCase()) {
      return { isValid: true, suggestedProbability: targetDef.default_probability };
    }

    // Rule 1: Moving to LOST requires closure justification
    if (targetStage.toUpperCase() === 'LOST' && !opportunityState.closed_reason) {
      return { isValid: false, error: 'A closure reason is mandatory when transitioning to LOST.' };
    }

    // Rule 2: Cannot advance past QUALIFICATION to technical or commercial stages if NOT qualified
    const postQualificationStages = [
      'MARKET_INTELLIGENCE',
      'MARKET_EVALUATION',
      'TECHNICAL_EVALUATION',
      'REGULATORY_EVALUATION',
      'PRODUCTION_FEASIBILITY',
      'COMMERCIAL_EVALUATION',
      'CUSTOMER_EVALUATION',
      'RFQ',
      'RFQ_CUSTOMER_ENGAGEMENT',
      'NEGOTIATION',
      'OPPORTUNITY_DECISION',
      'WON',
    ];

    if (postQualificationStages.includes(targetStage.toUpperCase())) {
      if (
        !opportunityState.qualification_status ||
        opportunityState.qualification_status === 'NOT_EVALUATED' ||
        opportunityState.qualification_status === 'NOT_QUALIFIED'
      ) {
        return {
          isValid: false,
          error: `Cannot transition to ${targetDef.name} without completing qualification (Current Status: ${opportunityState.qualification_status || 'NOT_EVALUATED'}).`,
        };
      }
    }

    // Rule 3: Moving to RFQ or commercial evaluation requires at least one associated product
    if (['COMMERCIAL_EVALUATION', 'RFQ', 'RFQ_CUSTOMER_ENGAGEMENT', 'NEGOTIATION', 'OPPORTUNITY_DECISION', 'WON'].includes(targetStage.toUpperCase())) {
      if (opportunityState.products_count !== undefined && opportunityState.products_count === 0) {
        return {
          isValid: false,
          error: `Opportunity must have at least one product associated before advancing to ${targetDef.name}.`,
        };
      }
    }

    return {
      isValid: true,
      suggestedProbability: targetDef.default_probability,
    };
  }
}
