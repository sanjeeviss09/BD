import { SupabaseClient } from '@supabase/supabase-js';

export interface WorkflowDefinitionInput {
  code: string;
  name: string;
  description?: string;
  entity_type?: string;
}

export interface WorkflowVersionInput {
  name: string;
  description?: string;
}

export interface WorkflowStageInput {
  stage_code: string;
  stage_name: string;
  description?: string;
  sort_order: number;
  stage_type: 'START' | 'PROCESS' | 'DECISION' | 'TERMINAL';
  default_probability?: number;
  sla_days?: number;
  warning_days?: number;
  color?: string;
  icon?: string;
  responsible_role_id?: string;
  responsible_department_id?: string;
  default_owner_id?: string;
  entry_conditions?: any[];
  completion_conditions?: any[];
}

export interface WorkflowTransitionInput {
  transition_code: string;
  transition_name: string;
  from_stage_id: string;
  to_stage_id: string;
  required_permission?: string;
  requires_comment?: boolean;
  comment_prompt?: string;
  conditions_json?: any[];
  sort_order?: number;
}

export interface ExecuteTransitionInput {
  transition_id?: string;
  target_stage_code?: string;
  reason?: string;
  comment?: string;
  expected_version?: number;
}

export interface TransitionValidationResult {
  is_allowed: boolean;
  error_code?: string;
  error_message?: string;
  blocking_reasons: string[];
}

export class WorkflowEngineService {
  constructor(
    private supabase: SupabaseClient,
    private organizationId: string,
    private userId: string
  ) {}

  // ==========================================
  // 1. WORKFLOW DEFINITIONS
  // ==========================================

  public async listDefinitions() {
    const { data, error } = await this.supabase
      .from('workflow_definitions')
      .select('*, default_version:default_version_id(*)')
      .eq('organization_id', this.organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list workflow definitions: ${error.message}`);
    return data || [];
  }

  public async getDefinitionById(id: string) {
    const { data, error } = await this.supabase
      .from('workflow_definitions')
      .select('*, default_version:default_version_id(*), versions:workflow_versions(*)')
      .eq('id', id)
      .eq('organization_id', this.organizationId)
      .single();

    if (error) throw new Error(`Workflow definition not found: ${error.message}`);
    return data;
  }

  public async createDefinition(input: WorkflowDefinitionInput) {
    const { data, error } = await this.supabase
      .from('workflow_definitions')
      .insert({
        organization_id: this.organizationId,
        code: input.code.toUpperCase().trim(),
        name: input.name.trim(),
        description: input.description,
        entity_type: input.entity_type || 'OPPORTUNITY',
        created_by: this.userId,
        updated_by: this.userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create workflow definition: ${error.message}`);
    return data;
  }

  // ==========================================
  // 2. WORKFLOW VERSIONS
  // ==========================================

  public async listVersions(definitionId: string) {
    const { data, error } = await this.supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_definition_id', definitionId)
      .eq('organization_id', this.organizationId)
      .order('version_number', { ascending: false });

    if (error) throw new Error(`Failed to list versions: ${error.message}`);
    return data || [];
  }

  public async getVersionById(versionId: string) {
    const { data, error } = await this.supabase
      .from('workflow_versions')
      .select(`
        *,
        stages:workflow_stages(*),
        transitions:workflow_transitions(*, from_stage:from_stage_id(stage_code, stage_name), to_stage:to_stage_id(stage_code, stage_name))
      `)
      .eq('id', versionId)
      .eq('organization_id', this.organizationId)
      .single();

    if (error) throw new Error(`Workflow version not found: ${error.message}`);
    return data;
  }

  public async createVersion(definitionId: string, input: WorkflowVersionInput) {
    // Get latest version number
    const { data: latest } = await this.supabase
      .from('workflow_versions')
      .select('version_number')
      .eq('workflow_definition_id', definitionId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVer = (latest?.version_number || 0) + 1;

    const { data, error } = await this.supabase
      .from('workflow_versions')
      .insert({
        organization_id: this.organizationId,
        workflow_definition_id: definitionId,
        version_number: nextVer,
        name: input.name,
        description: input.description,
        status: 'DRAFT',
        is_default: false,
        is_immutable: false,
        created_by: this.userId,
        updated_by: this.userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create version: ${error.message}`);
    return data;
  }

  public async validateVersionGraph(versionId: string): Promise<{ isValid: boolean; errors: string[] }> {
    const ver = await this.getVersionById(versionId);
    const stages: any[] = ver.stages || [];
    const transitions: any[] = ver.transitions || [];
    const errors: string[] = [];

    if (stages.length === 0) {
      errors.push('Workflow version must have at least one stage.');
      return { isValid: false, errors };
    }

    // 1. Must have exactly one START stage
    const startStages = stages.filter(s => s.stage_type === 'START');
    if (startStages.length === 0) {
      errors.push('Workflow version is missing a START stage.');
    } else if (startStages.length > 1) {
      errors.push('Workflow version cannot have multiple START stages.');
    }

    // 2. Must have at least one TERMINAL stage
    const terminalStages = stages.filter(s => s.stage_type === 'TERMINAL');
    if (terminalStages.length === 0) {
      errors.push('Workflow version is missing at least one TERMINAL stage (e.g. WON, LOST).');
    }

    // 3. Duplicate stage codes check
    const stageCodes = new Set<string>();
    for (const s of stages) {
      if (stageCodes.has(s.stage_code)) {
        errors.push(`Duplicate stage code found: ${s.stage_code}`);
      }
      stageCodes.add(s.stage_code);
    }

    // 4. Duplicate transition codes check
    const transCodes = new Set<string>();
    for (const t of transitions) {
      if (transCodes.has(t.transition_code)) {
        errors.push(`Duplicate transition code found: ${t.transition_code}`);
      }
      transCodes.add(t.transition_code);
    }

    // 5. Orphan stages check (stages with neither incoming nor outgoing transitions, excluding start/terminal)
    const stageIds = new Set(stages.map(s => s.id));
    const targetStageIds = new Set(transitions.map(t => t.to_stage_id));
    const fromStageIds = new Set(transitions.map(t => t.from_stage_id));

    for (const s of stages) {
      if (s.stage_type !== 'START' && !targetStageIds.has(s.id)) {
        errors.push(`Unreachable stage detected: ${s.stage_name} (${s.stage_code}) has no incoming transitions.`);
      }
      if (s.stage_type !== 'TERMINAL' && !fromStageIds.has(s.id)) {
        errors.push(`Dead-end stage detected: ${s.stage_name} (${s.stage_code}) is not terminal but has no outgoing transitions.`);
      }
    }

    // Save validation status on version
    await this.supabase
      .from('workflow_versions')
      .update({
        validation_status: errors.length === 0 ? 'VALID' : 'INVALID',
        validation_errors: errors,
        updated_at: new Date().toISOString(),
      })
      .eq('id', versionId);

    return { isValid: errors.length === 0, errors };
  }

  public async activateVersion(versionId: string) {
    const validation = await this.validateVersionGraph(versionId);
    if (!validation.isValid) {
      throw new Error(`Cannot activate invalid workflow version: ${validation.errors.join('; ')}`);
    }

    const version = await this.getVersionById(versionId);

    // Unset current default version for this definition
    await this.supabase
      .from('workflow_versions')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('workflow_definition_id', version.workflow_definition_id)
      .eq('is_default', true);

    // Set this version as active and default
    const { data: activated, error } = await this.supabase
      .from('workflow_versions')
      .update({
        status: 'ACTIVE',
        is_default: true,
        is_immutable: true,
        effective_from: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: this.userId,
      })
      .eq('id', versionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to activate version: ${error.message}`);

    // Update definition default_version_id
    await this.supabase
      .from('workflow_definitions')
      .update({
        default_version_id: versionId,
        updated_at: new Date().toISOString(),
        updated_by: this.userId,
      })
      .eq('id', version.workflow_definition_id);

    return activated;
  }

  // ==========================================
  // 3. WORKFLOW STAGES & TRANSITIONS
  // ==========================================

  public async createStage(versionId: string, input: WorkflowStageInput) {
    const version = await this.getVersionById(versionId);
    if (version.is_immutable) {
      throw new Error('Cannot add stages to an immutable active workflow version. Create a new draft version instead.');
    }

    const { data, error } = await this.supabase
      .from('workflow_stages')
      .insert({
        organization_id: this.organizationId,
        workflow_version_id: versionId,
        stage_code: input.stage_code.toUpperCase().trim(),
        stage_name: input.stage_name.trim(),
        description: input.description,
        sort_order: input.sort_order,
        stage_type: input.stage_type,
        default_probability: input.default_probability ?? 10,
        sla_days: input.sla_days ?? 7,
        warning_days: input.warning_days ?? 2,
        color: input.color || '#06b6d4',
        icon: input.icon || 'activity',
        responsible_role_id: input.responsible_role_id,
        responsible_department_id: input.responsible_department_id,
        default_owner_id: input.default_owner_id,
        entry_conditions: input.entry_conditions || [],
        completion_conditions: input.completion_conditions || [],
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create stage: ${error.message}`);
    return data;
  }

  public async createTransition(versionId: string, input: WorkflowTransitionInput) {
    const version = await this.getVersionById(versionId);
    if (version.is_immutable) {
      throw new Error('Cannot add transitions to an immutable active workflow version. Create a new draft version instead.');
    }

    const { data, error } = await this.supabase
      .from('workflow_transitions')
      .insert({
        organization_id: this.organizationId,
        workflow_version_id: versionId,
        transition_code: input.transition_code.toUpperCase().trim(),
        transition_name: input.transition_name.trim(),
        from_stage_id: input.from_stage_id,
        to_stage_id: input.to_stage_id,
        required_permission: input.required_permission || 'workflow.execute',
        requires_comment: input.requires_comment ?? false,
        comment_prompt: input.comment_prompt,
        conditions_json: input.conditions_json || [],
        sort_order: input.sort_order ?? 1,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create transition: ${error.message}`);
    return data;
  }

  // ==========================================
  // 4. OPPORTUNITY WORKFLOW INSTANCE LIFECYCLE
  // ==========================================

  public async getOrCreateInstanceForOpportunity(opportunityId: string) {
    // 1. Check existing instance
    const { data: existing } = await this.supabase
      .from('workflow_instances')
      .select(`
        *,
        current_stage:current_stage_id(*),
        workflow_definition:workflow_definition_id(*),
        workflow_version:workflow_version_id(*),
        assigned_user:assigned_user_id(id, email, full_name)
      `)
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', this.organizationId)
      .single();

    if (existing) {
      return this.enrichInstanceSla(existing);
    }

    // 2. Fetch default active workflow version for the organization
    let { data: defaultDef } = await this.supabase
      .from('workflow_definitions')
      .select('id, default_version_id')
      .eq('organization_id', this.organizationId)
      .eq('code', 'PHARMA_BD_CORE')
      .single();

    if (!defaultDef) {
      const { data: anyDef } = await this.supabase
        .from('workflow_definitions')
        .select('id, default_version_id')
        .eq('organization_id', this.organizationId)
        .eq('is_active', true)
        .limit(1)
        .single();
      defaultDef = anyDef;
    }

    if (!defaultDef || !defaultDef.default_version_id) {
      throw new Error('No active default workflow configured for organization. Please seed workflow definitions.');
    }

    // 3. Find START stage
    const { data: startStage } = await this.supabase
      .from('workflow_stages')
      .select('*')
      .eq('workflow_version_id', defaultDef.default_version_id)
      .eq('stage_type', 'START')
      .limit(1)
      .single();

    if (!startStage) {
      throw new Error('Default workflow is missing a START stage.');
    }

    // 4. Calculate initial SLA
    const now = new Date();
    const slaDays = startStage.sla_days || 3;
    const dueAt = new Date(now.getTime() + slaDays * 24 * 60 * 60 * 1000);

    // 5. Create workflow instance
    const { data: newInstance, error: createErr } = await this.supabase
      .from('workflow_instances')
      .insert({
        organization_id: this.organizationId,
        workflow_definition_id: defaultDef.id,
        workflow_version_id: defaultDef.default_version_id,
        opportunity_id: opportunityId,
        current_stage_id: startStage.id,
        status: 'ACTIVE',
        stage_started_at: now.toISOString(),
        stage_due_at: dueAt.toISOString(),
        sla_status: 'ON_TRACK',
        version: 1,
        created_by: this.userId,
      })
      .select(`
        *,
        current_stage:current_stage_id(*),
        workflow_definition:workflow_definition_id(*),
        workflow_version:workflow_version_id(*),
        assigned_user:assigned_user_id(id, email, full_name)
      `)
      .single();

    if (createErr) throw new Error(`Failed to initialize workflow instance: ${createErr.message}`);

    // Update opportunity's workflow_instance_id and stage
    await this.supabase
      .from('opportunities')
      .update({
        workflow_instance_id: newInstance.id,
        stage: startStage.stage_code,
        probability: startStage.default_probability || 10,
        updated_at: now.toISOString(),
      })
      .eq('id', opportunityId);

    // Record initial stage history entry
    await this.supabase.from('workflow_stage_history').insert({
      organization_id: this.organizationId,
      workflow_instance_id: newInstance.id,
      opportunity_id: opportunityId,
      from_stage_id: null,
      to_stage_id: startStage.id,
      transitioned_by: this.userId,
      transitioned_at: now.toISOString(),
      stage_duration_seconds: 0,
      sla_status_at_transition: 'ON_TRACK',
      reason: 'Workflow initialized',
      comment: 'Opportunity entered operational stage gate lifecycle',
    });

    return this.enrichInstanceSla(newInstance);
  }

  public async getValidTransitions(opportunityId: string) {
    const instance = await this.getOrCreateInstanceForOpportunity(opportunityId);

    // Fetch all transitions departing from current_stage_id
    const { data: transitions, error } = await this.supabase
      .from('workflow_transitions')
      .select(`
        *,
        to_stage:to_stage_id(*)
      `)
      .eq('from_stage_id', instance.current_stage_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`Failed to fetch transitions: ${error.message}`);

    // Fetch opportunity details to evaluate business rules
    const { data: opp } = await this.supabase
      .from('opportunities')
      .select(`
        *,
        opportunity_products(id, is_primary),
        tasks(id, status, is_mandatory)
      `)
      .eq('id', opportunityId)
      .single();

    // Evaluate each transition
    const evaluatedTransitions = (transitions || []).map(tr => {
      const targetStage = tr.to_stage;
      const blockingReasons: string[] = [];

      // Rule 1: LOST requires comment / reason
      if (targetStage.stage_code === 'LOST' || tr.requires_comment) {
        // Will be prompted in the transition modal
      }

      // Rule 2: Post-qualification operational stages require completed qualification
      const postQualStages = [
        'MARKET_INTELLIGENCE',
        'TECHNICAL_EVALUATION',
        'REGULATORY_EVALUATION',
        'PRODUCTION_FEASIBILITY',
        'COMMERCIAL_EVALUATION',
        'RFQ_CUSTOMER_ENGAGEMENT',
        'OPPORTUNITY_DECISION',
        'WON',
      ];

      if (postQualStages.includes(targetStage.stage_code)) {
        if (
          !opp?.qualification_status ||
          opp.qualification_status === 'NOT_EVALUATED' ||
          opp.qualification_status === 'NOT_QUALIFIED'
        ) {
          blockingReasons.push(
            `Opportunity qualification score is pending or disqualified (Current: ${opp?.qualification_status || 'NOT_EVALUATED'}).`
          );
        }
      }

      // Rule 3: Commercial & technical stages require associated product
      const productReqStages = [
        'TECHNICAL_EVALUATION',
        'PRODUCTION_FEASIBILITY',
        'COMMERCIAL_EVALUATION',
        'RFQ_CUSTOMER_ENGAGEMENT',
        'OPPORTUNITY_DECISION',
        'WON',
      ];

      if (productReqStages.includes(targetStage.stage_code)) {
        const prodCount = opp?.opportunity_products?.length || 0;
        if (prodCount === 0) {
          blockingReasons.push('At least one pharmaceutical product must be associated before advancing.');
        }
      }

      // Rule 4: Mandatory tasks for current stage must be completed
      const incompleteMandatoryTasks = (opp?.tasks || []).filter(
        (t: any) => t.is_mandatory && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
      );
      if (incompleteMandatoryTasks.length > 0 && targetStage.stage_code !== 'LOST') {
        blockingReasons.push(
          `${incompleteMandatoryTasks.length} mandatory evaluation task(s) must be completed before stage advancement.`
        );
      }

      return {
        ...tr,
        is_allowed: blockingReasons.length === 0,
        blocking_reasons: blockingReasons,
      };
    });

    return {
      instance,
      valid_transitions: evaluatedTransitions,
    };
  }

  // ==========================================
  // 5. ATOMIC TRANSITION EXECUTION (CONCURRENCY-SAFE)
  // ==========================================

  public async executeTransition(opportunityId: string, input: ExecuteTransitionInput) {
    const now = new Date();

    // 1. Fetch current workflow instance with optimistic concurrency lock check
    const { data: instance, error: instErr } = await this.supabase
      .from('workflow_instances')
      .select('*, current_stage:current_stage_id(*)')
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', this.organizationId)
      .single();

    if (instErr || !instance) {
      throw new Error('Workflow instance not found for this opportunity.');
    }

    if (input.expected_version !== undefined && instance.version !== input.expected_version) {
      throw new Error('CONCURRENT_UPDATE: The opportunity workflow was updated by another user. Please refresh and retry.');
    }

    if (instance.status === 'COMPLETED' && !input.target_stage_code?.includes('RESUME')) {
      throw new Error('WORKFLOW_COMPLETED: Workflow is in a terminal state.');
    }

    // 2. Identify target transition
    let transitionQuery = this.supabase
      .from('workflow_transitions')
      .select('*, to_stage:to_stage_id(*)')
      .eq('from_stage_id', instance.current_stage_id)
      .eq('is_active', true);

    if (input.transition_id) {
      transitionQuery = transitionQuery.eq('id', input.transition_id);
    }

    const { data: candidates, error: candErr } = await transitionQuery;
    if (candErr || !candidates || candidates.length === 0) {
      throw new Error(`TRANSITION_NOT_ALLOWED: No valid transition exists from current stage.`);
    }

    let selectedTransition = candidates[0];
    if (input.target_stage_code) {
      const match = candidates.find(c => c.to_stage?.stage_code === input.target_stage_code);
      if (!match) {
        throw new Error(`TRANSITION_NOT_ALLOWED: Cannot transition to ${input.target_stage_code} from current stage.`);
      }
      selectedTransition = match;
    }

    const targetStage = selectedTransition.to_stage;

    // 3. Validate comment requirement
    if ((selectedTransition.requires_comment || targetStage.stage_code === 'LOST') && !input.reason && !input.comment) {
      throw new Error('REQUIRED_FIELD_MISSING: A reason or comment is required for this stage transition.');
    }

    // 4. Validate opportunity business rules
    const { data: opp } = await this.supabase
      .from('opportunities')
      .select('*, opportunity_products(id), tasks(id, status, is_mandatory)')
      .eq('id', opportunityId)
      .single();

    // 4.1 Qualification check
    const postQualStages = [
      'MARKET_INTELLIGENCE',
      'TECHNICAL_EVALUATION',
      'REGULATORY_EVALUATION',
      'PRODUCTION_FEASIBILITY',
      'COMMERCIAL_EVALUATION',
      'RFQ_CUSTOMER_ENGAGEMENT',
      'OPPORTUNITY_DECISION',
      'WON',
    ];
    if (postQualStages.includes(targetStage.stage_code)) {
      if (!opp?.qualification_status || opp.qualification_status === 'NOT_EVALUATED' || opp.qualification_status === 'NOT_QUALIFIED') {
        throw new Error(`REQUIRED_EVALUATION_INCOMPLETE: Qualification score must be recorded before advancing to ${targetStage.stage_name}.`);
      }
    }

    // 4.2 Associated products check
    if (['TECHNICAL_EVALUATION', 'PRODUCTION_FEASIBILITY', 'COMMERCIAL_EVALUATION', 'RFQ_CUSTOMER_ENGAGEMENT', 'OPPORTUNITY_DECISION', 'WON'].includes(targetStage.stage_code)) {
      if (!opp?.opportunity_products || opp.opportunity_products.length === 0) {
        throw new Error(`REQUIRED_FIELD_MISSING: At least one product must be associated before advancing to ${targetStage.stage_name}.`);
      }
    }

    // 4.3 Mandatory task check
    const incompleteTasks = (opp?.tasks || []).filter(
      (t: any) => t.is_mandatory && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    );
    if (incompleteTasks.length > 0 && targetStage.stage_code !== 'LOST') {
      throw new Error(`REQUIRED_TASK_INCOMPLETE: ${incompleteTasks.length} mandatory task(s) must be completed before advancing.`);
    }

    // 5. Calculate Stage Durations and next SLA
    const startedAt = new Date(instance.stage_started_at);
    const durationSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
    const nextSlaDays = targetStage.sla_days || 7;
    const nextDueAt = targetStage.stage_type === 'TERMINAL' ? null : new Date(now.getTime() + nextSlaDays * 24 * 60 * 60 * 1000);

    const isTerminalWon = targetStage.stage_code === 'WON';
    const isTerminalLost = targetStage.stage_code === 'LOST';
    const isHold = targetStage.stage_code === 'ON_HOLD';
    const isTerminal = targetStage.stage_type === 'TERMINAL';

    // 6. Execute atomic update on workflow_instances
    const nextInstanceVersion = instance.version + 1;
    const { data: updatedInstance, error: updateInstErr } = await this.supabase
      .from('workflow_instances')
      .update({
        current_stage_id: targetStage.id,
        status: isTerminal ? 'COMPLETED' : 'ACTIVE',
        stage_started_at: now.toISOString(),
        stage_due_at: nextDueAt ? nextDueAt.toISOString() : null,
        sla_status: isTerminal ? 'COMPLETED' : 'ON_TRACK',
        version: nextInstanceVersion,
        completed_at: isTerminal ? now.toISOString() : null,
        updated_at: now.toISOString(),
      })
      .eq('id', instance.id)
      .eq('version', instance.version)
      .select(`
        *,
        current_stage:current_stage_id(*),
        workflow_definition:workflow_definition_id(*),
        workflow_version:workflow_version_id(*),
        assigned_user:assigned_user_id(id, email, full_name)
      `)
      .single();

    if (updateInstErr || !updatedInstance) {
      throw new Error('CONCURRENT_UPDATE: Stage transition conflict. The opportunity was updated concurrently.');
    }

    // 7. Insert immutable stage history record
    await this.supabase.from('workflow_stage_history').insert({
      organization_id: this.organizationId,
      workflow_instance_id: instance.id,
      opportunity_id: opportunityId,
      from_stage_id: instance.current_stage_id,
      to_stage_id: targetStage.id,
      transition_id: selectedTransition.id,
      transitioned_by: this.userId,
      transitioned_at: now.toISOString(),
      stage_duration_seconds: durationSeconds,
      sla_status_at_transition: instance.sla_status || 'ON_TRACK',
      reason: input.reason || selectedTransition.transition_name,
      comment: input.comment,
      metadata_json: {
        transition_code: selectedTransition.transition_code,
        previous_stage: instance.current_stage?.stage_name,
        target_stage: targetStage.stage_name,
      },
    });

    // 8. Synchronize Opportunity status and probability
    const oppStatus = isTerminalWon ? 'WON' : isTerminalLost ? 'LOST' : isHold ? 'ON_HOLD' : 'OPEN';
    const oppUpdate: any = {
      stage: targetStage.stage_code,
      status: oppStatus,
      probability: targetStage.default_probability ?? opp.probability,
      updated_at: now.toISOString(),
      updated_by: this.userId,
    };

    if (isTerminalWon || isTerminalLost) {
      oppUpdate.closed_at = now.toISOString();
      oppUpdate.closed_reason = input.reason || input.comment || (isTerminalWon ? 'Commercial win' : 'Opportunity closed');
    }

    await this.supabase.from('opportunities').update(oppUpdate).eq('id', opportunityId);

    // 9. Append timeline event
    await this.supabase.from('opportunity_timeline').insert({
      organization_id: this.organizationId,
      opportunity_id: opportunityId,
      event_type: 'STAGE_TRANSITION',
      actor_id: this.userId,
      description: `Stage transitioned from ${instance.current_stage?.stage_name || 'Previous'} to ${targetStage.stage_name} (Probability: ${targetStage.default_probability}%)`,
      metadata_json: {
        transition_code: selectedTransition.transition_code,
        reason: input.reason,
        comment: input.comment,
      },
    });

    return {
      instance: this.enrichInstanceSla(updatedInstance),
      transition: selectedTransition,
      opportunity: {
        id: opportunityId,
        stage: targetStage.stage_code,
        status: oppStatus,
        probability: targetStage.default_probability,
      },
    };
  }

  // ==========================================
  // 6. STAGE REASSIGNMENT & HISTORY
  // ==========================================

  public async reassignStageOwner(opportunityId: string, newOwnerId: string, reason?: string) {
    const { data: updated, error } = await this.supabase
      .from('workflow_instances')
      .update({
        assigned_user_id: newOwnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', this.organizationId)
      .select('*, assigned_user:assigned_user_id(id, email, full_name)')
      .single();

    if (error) throw new Error(`Failed to reassign stage owner: ${error.message}`);

    // Update opportunity owner for consistency
    await this.supabase
      .from('opportunities')
      .update({
        owner_id: newOwnerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId);

    // Timeline event
    await this.supabase.from('opportunity_timeline').insert({
      organization_id: this.organizationId,
      opportunity_id: opportunityId,
      event_type: 'OWNER_REASSIGNED',
      actor_id: this.userId,
      description: `Workflow stage owner reassigned`,
      metadata_json: { new_owner_id: newOwnerId, reason },
    });

    return updated;
  }

  public async getStageHistory(opportunityId: string) {
    const { data, error } = await this.supabase
      .from('workflow_stage_history')
      .select(`
        *,
        from_stage:from_stage_id(stage_code, stage_name, color, icon),
        to_stage:to_stage_id(stage_code, stage_name, color, icon),
        transition:transition_id(transition_code, transition_name),
        transitioned_by_user:transitioned_by(id, email, full_name)
      `)
      .eq('opportunity_id', opportunityId)
      .eq('organization_id', this.organizationId)
      .order('transitioned_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch stage history: ${error.message}`);
    return data || [];
  }

  // ==========================================
  // 7. WORKFLOW ANALYTICS
  // ==========================================

  public async getWorkflowAnalytics(params: { date_from?: string; date_to?: string } = {}) {
    // 1. Fetch active instances for stage distribution
    const { data: instances } = await this.supabase
      .from('workflow_instances')
      .select(`
        id,
        current_stage:current_stage_id(stage_code, stage_name, sort_order, color),
        stage_started_at,
        stage_due_at,
        sla_status,
        status,
        opportunity:opportunity_id(id, estimated_value, priority, title)
      `)
      .eq('organization_id', this.organizationId);

    // 2. Fetch history for cycle time and bottleneck calculation
    let historyQuery = this.supabase
      .from('workflow_stage_history')
      .select(`
        id,
        stage_duration_seconds,
        transitioned_at,
        to_stage:to_stage_id(stage_code, stage_name)
      `)
      .eq('organization_id', this.organizationId);

    if (params.date_from) {
      historyQuery = historyQuery.gte('transitioned_at', params.date_from);
    }
    if (params.date_to) {
      historyQuery = historyQuery.lte('transitioned_at', params.date_to);
    }

    const { data: history } = await historyQuery;

    // 3. Compute metrics
    const stageDistribution: Record<string, { name: string; count: number; total_value: number; color: string; sort_order: number }> = {};
    let onTrackCount = 0;
    let dueSoonCount = 0;
    let overdueCount = 0;
    let totalActive = 0;
    const stuckOpportunities: any[] = [];

    const now = Date.now();

    for (const rawInst of instances || []) {
      const inst = rawInst as any;
      const stageName = inst.current_stage?.stage_name || 'Unknown';
      const stageCode = inst.current_stage?.stage_code || 'UNKNOWN';
      const color = inst.current_stage?.color || '#06b6d4';
      const sortOrder = inst.current_stage?.sort_order || 99;
      const value = Number(inst.opportunity?.estimated_value || 0);

      if (inst.status === 'ACTIVE') {
        totalActive++;
        if (!stageDistribution[stageCode]) {
          stageDistribution[stageCode] = { name: stageName, count: 0, total_value: 0, color, sort_order: sortOrder };
        }
        stageDistribution[stageCode].count++;
        stageDistribution[stageCode].total_value += value;

        // SLA status
        const dueAt = inst.stage_due_at ? new Date(inst.stage_due_at).getTime() : null;
        if (dueAt) {
          if (now > dueAt) {
            overdueCount++;
            const daysOverdue = Math.floor((now - dueAt) / (1000 * 60 * 60 * 24));
            stuckOpportunities.push({
              id: inst.opportunity?.id,
              title: inst.opportunity?.title,
              stage_name: stageName,
              days_in_stage: Math.floor((now - new Date(inst.stage_started_at).getTime()) / (1000 * 60 * 60 * 24)),
              days_overdue: daysOverdue,
              value,
            });
          } else if (dueAt - now < 2 * 24 * 60 * 60 * 1000) {
            dueSoonCount++;
          } else {
            onTrackCount++;
          }
        } else {
          onTrackCount++;
        }
      }
    }

    // Average duration per stage
    const durationByStage: Record<string, { total_seconds: number; count: number; name: string }> = {};
    for (const rawH of history || []) {
      const h = rawH as any;
      const code = h.to_stage?.stage_code || 'UNKNOWN';
      const name = h.to_stage?.stage_name || code;
      if (!durationByStage[code]) {
        durationByStage[code] = { total_seconds: 0, count: 0, name };
      }
      durationByStage[code].total_seconds += h.stage_duration_seconds || 0;
      durationByStage[code].count++;
    }

    const averageStageDuration = Object.entries(durationByStage).map(([code, data]) => ({
      stage_code: code,
      stage_name: data.name,
      avg_days: Number((data.total_seconds / (data.count * 86400)).toFixed(1)),
      transitions_count: data.count,
    }));

    const slaComplianceRate = totalActive > 0 ? Number(((onTrackCount / totalActive) * 100).toFixed(1)) : 100;

    return {
      active_opportunities_count: totalActive,
      stage_distribution: Object.values(stageDistribution).sort((a, b) => a.sort_order - b.sort_order),
      average_stage_duration: averageStageDuration,
      sla_metrics: {
        compliance_rate: slaComplianceRate,
        on_track: onTrackCount,
        due_soon: dueSoonCount,
        overdue: overdueCount,
      },
      stuck_opportunities: stuckOpportunities.sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 10),
    };
  }

  // ==========================================
  // HELPER: SLA DYNAMIC ENRICHMENT
  // ==========================================

  private enrichInstanceSla(instance: any) {
    if (!instance || instance.status === 'COMPLETED' || !instance.stage_due_at) {
      return instance;
    }

    const now = Date.now();
    const dueAt = new Date(instance.stage_due_at).getTime();
    const warningMs = (instance.current_stage?.warning_days || 2) * 24 * 60 * 60 * 1000;

    let dynamicSlaStatus = 'ON_TRACK';
    if (now > dueAt) {
      dynamicSlaStatus = 'OVERDUE';
    } else if (dueAt - now <= warningMs) {
      dynamicSlaStatus = 'DUE_SOON';
    }

    const daysInStage = Math.max(
      0,
      Math.floor((now - new Date(instance.stage_started_at).getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      ...instance,
      sla_status: dynamicSlaStatus,
      days_in_stage: daysInStage,
      is_overdue: dynamicSlaStatus === 'OVERDUE',
      is_due_soon: dynamicSlaStatus === 'DUE_SOON',
    };
  }
}
