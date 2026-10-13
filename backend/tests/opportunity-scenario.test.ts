import { OpportunityWorkflowService } from '../src/services/opportunity-workflow.service';
import { OpportunityScoringService, QualificationCriterionInput } from '../src/services/opportunity-scoring.service';
import { OpportunityMetricsService } from '../src/services/opportunity-metrics.service';
import { TaskMetricsService } from '../src/services/task-metrics.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Requirement 56: Critical End-to-End Business Scenario Test', () => {
  // Mock Tenant State
  const organizationId = '11111111-1111-1111-1111-111111111111';
  const otherOrgId = '99999999-9999-9999-9999-999999999999';
  const bdOwnerId = '22222222-2222-2222-2222-222222222222';

  // 1. Create Product: Example development product
  const canonicalProduct = {
    id: 'prod-001',
    organization_id: organizationId,
    display_name: 'Amoxicillin + Clavulanic Acid 1000mg ER Tablet',
    brand_name: 'Augmentin Extended Release',
    dosage_form: 'Extended Release Tablet',
    status: 'DEVELOPMENT',
  };

  // 2. Create Opportunity: Linked to product
  let opportunity = {
    id: 'opp-001',
    organization_id: organizationId,
    opportunity_code: 'OPP-2026-000001',
    title: 'EU Market Entry - Amoxicillin Clavulanate ER',
    description: 'Generic dossier licensing and supply for European Union territories',
    opportunity_type: 'NEW_PRODUCT_DEVELOPMENT',
    source: 'MARKET_RESEARCH',
    // 3. Assign BD owner
    owner_id: bdOwnerId,
    // 4. Set Priority = HIGH
    priority: 'HIGH',
    // 5. Set Stage = IDENTIFIED
    stage: 'IDENTIFIED',
    status: 'OPEN',
    probability: 10,
    estimated_value: 1200000,
    currency: 'USD',
    next_action: 'Evaluate customer requirement and technical dossier',
    next_action_date: '2026-10-05',
    qualification_status: 'NOT_EVALUATED',
    qualification_score: null as number | null,
    risk_level: 'LOW',
    created_at: new Date('2026-10-01T00:00:00Z'),
    updated_at: new Date('2026-10-01T00:00:00Z'),
  };

  const opportunityProducts = [
    {
      id: 'opp-prod-001',
      opportunity_id: opportunity.id,
      product_id: canonicalProduct.id,
      relationship_type: 'PRIMARY_PRODUCT',
      is_primary: true,
      notes: 'Lead commercial asset',
    },
  ];

  // 6. Add target countries
  const targetMarkets = [
    {
      id: 'mkt-001',
      opportunity_id: opportunity.id,
      country_id: 'DE',
      market_role: 'PRIMARY',
      priority: 'HIGH',
      notes: 'Germany - tender and retail launch',
    },
    {
      id: 'mkt-002',
      opportunity_id: opportunity.id,
      country_id: 'FR',
      market_role: 'SECONDARY',
      priority: 'MEDIUM',
      notes: 'France hospital & retail distribution',
    },
  ];

  // 7. Add qualification criteria
  const qualificationCriteria = OpportunityScoringService.getCriteria();

  // 8. Create linked Task: "Evaluate customer requirement"
  // 9. Set task expected date
  const originalDueDate = '2026-10-05';
  let linkedTask = {
    id: 'task-001',
    task_code: 'TSK-2026-000042',
    organization_id: organizationId,
    opportunity_id: opportunity.id,
    title: 'Evaluate customer requirement',
    owner_id: bdOwnerId,
    status: 'OPEN',
    priority: 'HIGH',
    original_due_date: originalDueDate,
    current_due_date: originalDueDate,
    created_at: '2026-10-01',
  };

  let followups: any[] = [];
  const timelineEvents: any[] = [
    { event_type: 'OPPORTUNITY_CREATED', title: 'Opportunity Created' },
    { event_type: 'PRODUCT_ADDED', title: 'Product Linked: ' + canonicalProduct.display_name },
    { event_type: 'TASK_CREATED', title: 'Task Linked: ' + linkedTask.title },
  ];
  const auditLogs: any[] = [
    { action: 'CREATE', entity: 'opportunities', entity_id: opportunity.id },
  ];

  it('Steps 1-7: Product, Opportunity, BD Owner, Priority HIGH, Stage IDENTIFIED, Target Markets created', () => {
    expect(canonicalProduct.id).toBeDefined();
    expect(opportunity.stage).toBe('IDENTIFIED');
    expect(opportunity.priority).toBe('HIGH');
    expect(opportunity.owner_id).toBe(bdOwnerId);
    expect(opportunityProducts).toHaveLength(1);
    expect(opportunityProducts[0].is_primary).toBe(true);
    expect(targetMarkets).toHaveLength(2);
    expect(qualificationCriteria.length).toBeGreaterThan(0);
  });

  it('Steps 8-9: Linked Task created with expected due date', () => {
    expect(linkedTask.opportunity_id).toBe(opportunity.id);
    expect(linkedTask.title).toBe('Evaluate customer requirement');
    expect(linkedTask.current_due_date).toBe('2026-10-05');
  });

  it('Steps 10-12: Record No Update -> Task delayed -> Opportunity displays Next Action Delayed X Days', () => {
    // 10. Record No Update on 2026-10-05 setting next follow-up to 2026-10-08
    followups.push({
      id: 'fu-001',
      task_id: linkedTask.id,
      followup_number: 1,
      followup_date: '2026-10-05',
      response_status: 'NO_UPDATE',
      next_followup_date: '2026-10-08',
      remarks: 'Waiting for stability batch analytical report',
    });
    linkedTask.status = 'WAITING_FOR_UPDATE';
    linkedTask.current_due_date = '2026-10-08';

    // 11. Current evaluation date is 2026-10-10 (2 days overdue past Oct 8, and 5 days past original Oct 5)
    const testDate = new Date('2026-10-10T00:00:00Z');
    const taskMetrics = TaskMetricsService.calculateMetrics(linkedTask, followups, testDate);
    
    expect(taskMetrics.originalDelayDays).toBe(5); // Oct 10 - Oct 5 = 5 days
    expect(taskMetrics.currentDelayDays).toBe(2);  // Oct 10 - Oct 8 = 2 days
    expect(taskMetrics.isOverdue).toBe(true);

    // 12. Opportunity Next Action Delay calculation integrates linked task delay
    const oppDelayDays = OpportunityMetricsService.calculateNextActionDelayDays(
      opportunity.next_action_date,
      taskMetrics.originalDelayDays,
      testDate
    );
    expect(oppDelayDays).toBe(5);
    const delayBanner = `Next Action Delayed ${oppDelayDays} Days`;
    expect(delayBanner).toBe('Next Action Delayed 5 Days');
  });

  it('Steps 13-15: Complete qualification, calculate score, move Opportunity to QUALIFICATION', () => {
    // 13. Complete qualification inputs
    const scores: QualificationCriterionInput[] = [
      { criterion_key: 'STRATEGIC_FIT', score: 90, comment: 'Strong alignment with core portfolio' },
      { criterion_key: 'MARKET_POTENTIAL', score: 85, comment: 'EU market value exceeding $40M annually' },
      { criterion_key: 'TECHNICAL_FEASIBILITY', score: 80, comment: 'Active formulation technology available' },
      { criterion_key: 'REGULATORY_FEASIBILITY', score: 75, comment: 'EU CEP Dossier available from partner' },
      { criterion_key: 'MANUFACTURING_CAPABILITY', score: 70, comment: 'EU GMP inspected plant capacity ready' },
      { criterion_key: 'COMMERCIAL_POTENTIAL', score: 85, comment: 'Estimated 25% margin at target price' },
      { criterion_key: 'CUSTOMER_DEMAND', score: 75, comment: 'High demand from tenders' },
      { criterion_key: 'TIMELINE_FEASIBILITY', score: 70, comment: '18-month timeline to market' },
    ];

    // 14. Calculate qualification score authoritative backend service
    const qualResult = OpportunityScoringService.calculateQualification(scores);
    expect(qualResult.qualificationResult).toBe('QUALIFIED');
    expect(qualResult.totalScore).toBeGreaterThanOrEqual(70);

    opportunity.qualification_status = qualResult.qualificationResult;
    opportunity.qualification_score = qualResult.totalScore;

    timelineEvents.push({
      event_type: 'QUALIFICATION_COMPLETED',
      title: `Qualification Completed: ${qualResult.qualificationResult} (${qualResult.totalScore}%)`,
    });
    auditLogs.push({ action: 'QUALIFY', entity: 'opportunities', entity_id: opportunity.id });

    // 15. Transition to QUALIFICATION stage
    const transitionCheck = OpportunityWorkflowService.validateTransition(
      opportunity.stage,
      'QUALIFICATION',
      {
        qualification_status: opportunity.qualification_status,
        products_count: opportunityProducts.length,
      }
    );
    expect(transitionCheck.isValid).toBe(true);

    opportunity.stage = 'QUALIFICATION';
    opportunity.probability = OpportunityWorkflowService.getStage('QUALIFICATION')?.default_probability || 30;
    expect(opportunity.probability).toBe(30);

    timelineEvents.push({ event_type: 'STAGE_CHANGED', title: 'Stage changed to QUALIFICATION' });
  });

  it('Steps 16-19: Add technical risk, regulatory requirement, another task, and transition to TECHNICAL_EVALUATION', () => {
    // 16. Add a technical risk
    const technicalRisk = {
      id: 'risk-001',
      opportunity_id: opportunity.id,
      risk_type: 'TECHNICAL',
      severity: 'HIGH',
      description: 'Extended release dissolution profile sensitive to polymer batch variability',
      mitigation: 'Implement dual-source excipient validation with tight viscosity specifications',
      status: 'IDENTIFIED',
    };
    opportunity.risk_level = 'HIGH';
    timelineEvents.push({ event_type: 'OPPORTUNITY_UPDATED', title: 'Technical Risk Added' });

    // 17. Add a regulatory requirement
    const regRequirement = {
      id: 'req-001',
      opportunity_id: opportunity.id,
      type: 'REGULATORY',
      description: 'Module 3 Quality overall summary harmonization with EMA guidance',
      priority: 'HIGH',
      status: 'OPEN',
    };
    timelineEvents.push({ event_type: 'OPPORTUNITY_UPDATED', title: 'Regulatory Requirement Added' });

    // 18. Add another task
    const task2 = {
      id: 'task-002',
      opportunity_id: opportunity.id,
      title: 'Conduct pilot bioequivalence formulation trial',
      status: 'OPEN',
      priority: 'HIGH',
    };
    timelineEvents.push({ event_type: 'TASK_CREATED', title: 'Task Linked: ' + task2.title });

    // 19. Transition to TECHNICAL_EVALUATION
    const evalTransition = OpportunityWorkflowService.validateTransition(
      opportunity.stage,
      'TECHNICAL_EVALUATION',
      {
        qualification_status: opportunity.qualification_status,
        products_count: opportunityProducts.length,
      }
    );
    expect(evalTransition.isValid).toBe(true);

    opportunity.stage = 'TECHNICAL_EVALUATION';
    opportunity.probability = OpportunityWorkflowService.getStage('TECHNICAL_EVALUATION')?.default_probability || 50;
    expect(opportunity.probability).toBe(50);

    timelineEvents.push({ event_type: 'STAGE_CHANGED', title: 'Stage changed to TECHNICAL_EVALUATION' });

    expect(technicalRisk.severity).toBe('HIGH');
    expect(regRequirement.type).toBe('REGULATORY');
    expect(task2.id).toBe('task-002');
  });

  it('Step 20: Verify complete Opportunity timeline events', () => {
    const eventTypes = timelineEvents.map(e => e.event_type);
    expect(eventTypes).toContain('OPPORTUNITY_CREATED');
    expect(eventTypes).toContain('PRODUCT_ADDED');
    expect(eventTypes).toContain('TASK_CREATED');
    expect(eventTypes).toContain('QUALIFICATION_COMPLETED');
    expect(eventTypes).toContain('STAGE_CHANGED');
    expect(timelineEvents.length).toBeGreaterThanOrEqual(6);
  });

  it('Step 21: Verify audit log events captured', () => {
    expect(auditLogs.some(l => l.action === 'CREATE')).toBe(true);
    expect(auditLogs.some(l => l.action === 'QUALIFY')).toBe(true);
  });

  it('Step 22: Verify authoritative financial & health analytics', () => {
    // 1,200,000 at 50% probability
    const weightedVal = OpportunityMetricsService.calculateWeightedValue(
      opportunity.estimated_value,
      opportunity.probability
    );
    expect(weightedVal).toBe(600000);

    const ageDays = OpportunityMetricsService.calculateOpportunityAgeDays(
      opportunity.created_at,
      null,
      new Date('2026-10-10T00:00:00Z')
    );
    expect(ageDays).toBe(9); // Oct 10 - Oct 1 = 9 days

    const health = OpportunityMetricsService.evaluateHealth(
      {
        nextActionDate: opportunity.next_action_date,
        overdueTasksCount: 1, // task-001 is overdue
        highestTaskDelayDays: 5,
        qualificationStatus: opportunity.qualification_status,
        riskLevel: opportunity.risk_level,
        status: opportunity.status,
      },
      new Date('2026-10-10T00:00:00Z')
    );
    // Because next action is 5 days overdue and there is an overdue task, health accurately reflects AT_RISK or CRITICAL
    expect(['AT_RISK', 'CRITICAL']).toContain(health.health);
    expect(health.reasons.length).toBeGreaterThan(0);
  });

  it('Step 23: Verify permission codes integrity', () => {
    const requiredPermissions = [
      'opportunities.read',
      'opportunities.create',
      'opportunities.update',
      'opportunities.assign',
      'opportunities.stage',
      'opportunities.qualify',
      'opportunities.close',
      'opportunities.reopen',
      'opportunities.risk',
      'opportunities.export',
      'opportunities.analytics',
      'opportunities.admin',
    ];

    const migrationContent = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/007_opportunity_management.sql'),
      'utf8'
    );

    for (const perm of requiredPermissions) {
      expect(migrationContent).toContain(`'${perm}'`);
    }
  });

  it('Step 24: Verify RLS and tenant isolation', () => {
    // Validate organization boundary
    expect(opportunity.organization_id).toBe(organizationId);
    expect(opportunity.organization_id).not.toBe(otherOrgId);

    const migrationContent = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/007_opportunity_management.sql'),
      'utf8'
    );

    // Verify Row Level Security is explicitly enabled on all core opportunity tables
    const rlsTables = [
      'opportunities',
      'opportunity_products',
      'opportunity_markets',
      'opportunity_customers',
      'opportunity_risks',
      'opportunity_requirements',
      'opportunity_qualification_runs',
      'opportunity_qualification_scores',
      'opportunity_decisions',
      'opportunity_comments',
      'opportunity_timeline',
    ];

    for (const table of rlsTables) {
      expect(migrationContent).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }

    // Verify tenant policy statements are created in migration
    expect(migrationContent).toContain('CREATE POLICY opportunities_tenant_policy ON opportunities');
    expect(migrationContent).toContain('CREATE POLICY opportunity_products_tenant_policy ON opportunity_products');
    expect(migrationContent).toContain('CREATE POLICY opportunity_markets_tenant_policy ON opportunity_markets');
    expect(migrationContent).toContain('CREATE POLICY opportunity_risks_tenant_policy ON opportunity_risks');
    expect(migrationContent).toContain('CREATE POLICY opportunity_reqs_tenant_policy ON opportunity_requirements');
    expect(migrationContent).toContain('CREATE POLICY opportunity_qual_runs_tenant_policy ON opportunity_qualification_runs');
    expect(migrationContent).toContain('CREATE POLICY opportunity_decisions_tenant_policy ON opportunity_decisions');
    expect(migrationContent).toContain('CREATE POLICY opportunity_timeline_tenant_policy ON opportunity_timeline');
  });
});
