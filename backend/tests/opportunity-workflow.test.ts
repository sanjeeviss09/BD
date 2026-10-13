import { OpportunityWorkflowService } from '../src/services/opportunity-workflow.service';

describe('OpportunityWorkflowService - Stage Transitions & Validation Gates', () => {
  it('allows natural progression from IDENTIFIED to INITIAL_SCREENING to QUALIFICATION', () => {
    const check1 = OpportunityWorkflowService.validateTransition('IDENTIFIED', 'INITIAL_SCREENING', {});
    expect(check1.isValid).toBe(true);
    expect(check1.suggestedProbability).toBe(20);

    const check2 = OpportunityWorkflowService.validateTransition('INITIAL_SCREENING', 'QUALIFICATION', {});
    expect(check2.isValid).toBe(true);
    expect(check2.suggestedProbability).toBe(30);
  });

  it('blocks advancing past QUALIFICATION to TECHNICAL_EVALUATION if qualification is not completed', () => {
    const check = OpportunityWorkflowService.validateTransition('QUALIFICATION', 'TECHNICAL_EVALUATION', {
      qualification_status: 'NOT_EVALUATED',
    });

    expect(check.isValid).toBe(false);
    expect(check.error).toContain('Cannot transition to Technical Evaluation without completing qualification');
  });

  it('allows advancing to TECHNICAL_EVALUATION once qualified', () => {
    const check = OpportunityWorkflowService.validateTransition('QUALIFICATION', 'TECHNICAL_EVALUATION', {
      qualification_status: 'QUALIFIED',
    });

    expect(check.isValid).toBe(true);
    expect(check.suggestedProbability).toBe(50);
  });

  it('blocks transition to LOST without a closure reason', () => {
    const check = OpportunityWorkflowService.validateTransition('NEGOTIATION', 'LOST', {
      closed_reason: undefined,
    });

    expect(check.isValid).toBe(false);
    expect(check.error).toContain('A closure reason is mandatory');
  });

  it('blocks transition to RFQ if no products are associated', () => {
    const check = OpportunityWorkflowService.validateTransition('COMMERCIAL_EVALUATION', 'RFQ', {
      qualification_status: 'QUALIFIED',
      products_count: 0,
    });

    expect(check.isValid).toBe(false);
    expect(check.error).toContain('Opportunity must have at least one product associated');
  });
});
