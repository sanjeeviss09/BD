import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';

export interface ResponsibilityResolutionContext {
  taskType?: string | null;
  businessArea?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
  productId?: string | null;
  moleculeId?: string | null;
  opportunityType?: string | null;
  date?: string | null; // Defaults to current date
}

export interface ResponsibilityRuleRecord {
  id: string;
  organization_id: string;
  rule_code: string;
  rule_name: string;
  description?: string;
  unit_id?: string | null;
  department_id?: string | null;
  task_type?: string | null;
  business_area?: string | null;
  product_type?: string | null;
  product_id?: string | null;
  molecule_id?: string | null;
  opportunity_type?: string | null;
  responsible_department_id: string;
  primary_member_id?: string | null;
  backup_member_id?: string | null;
  escalation_manager_id?: string | null;
  escalation_level2_id?: string | null;
  escalation_level3_id?: string | null;
  response_sla_days: number;
  completion_sla_days: number;
  followup_interval_days: number;
  escalation_delay_days: number;
  sla_calendar_type: 'BUSINESS_DAYS' | 'CALENDAR_DAYS';
  assignment_mode: 'AUTO_ASSIGN' | 'SUGGEST' | 'MANUAL';
  priority_score: number;
  effective_from: string;
  effective_to?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  version: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export class ResponsibilityService {
  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId?: string
  ) {}

  /**
   * Generates a sequential rule code like RULE-2026-0001
   */
  private async generateRuleCode(): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('generate_next_resp_rule_code');
      if (!error && data) return data as string;
    } catch {
      // Fallback
    }

    const year = new Date().getFullYear();
    const { data: latest } = await this.supabase
      .from('responsibility_rules')
      .select('rule_code')
      .eq('organization_id', this.orgId)
      .like('rule_code', `RULE-${year}-%`)
      .order('rule_code', { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = 1;
    if (latest && latest.rule_code) {
      const parts = latest.rule_code.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) seq = parsed + 1;
      }
    }
    return `RULE-${year}-${seq.toString().padStart(4, '0')}`;
  }

  /**
   * Calculates business days from a start date (skipping Saturdays & Sundays)
   */
  static addBusinessDays(startDate: Date, days: number): Date {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      // 0 = Sunday, 6 = Saturday
      if (day !== 0 && day !== 6) {
        added++;
      }
    }
    return result;
  }

  /**
   * Computes target due date based on SLA days and calendar type
   */
  static computeDueDate(slaDays: number, calendarType: string = 'BUSINESS_DAYS', fromDate: Date = new Date()): string {
    if (calendarType === 'BUSINESS_DAYS') {
      return ResponsibilityService.addBusinessDays(fromDate, slaDays).toISOString().split('T')[0];
    }
    const target = new Date(fromDate);
    target.setDate(target.getDate() + slaDays);
    return target.toISOString().split('T')[0];
  }

  /**
   * Computes rule specificity score for precedence matching
   */
  private computeRuleScore(rule: ResponsibilityRuleRecord, ctx: ResponsibilityResolutionContext): number {
    let score = 10; // Base platform default score

    if (rule.product_id && ctx.productId && rule.product_id === ctx.productId) {
      score += 800; // Exact Product match (Highest precedence)
    } else if (rule.product_id && (!ctx.productId || rule.product_id !== ctx.productId)) {
      return -1; // Scope mismatch
    }

    if (rule.molecule_id && ctx.moleculeId && rule.molecule_id === ctx.moleculeId) {
      score += 600; // Exact Molecule match
    } else if (rule.molecule_id && (!ctx.moleculeId || rule.molecule_id !== ctx.moleculeId)) {
      return -1;
    }

    if (rule.opportunity_type && ctx.opportunityType && rule.opportunity_type.toUpperCase() === ctx.opportunityType.toUpperCase()) {
      score += 300;
    } else if (rule.opportunity_type && (!ctx.opportunityType || rule.opportunity_type.toUpperCase() !== ctx.opportunityType.toUpperCase())) {
      return -1;
    }

    if (rule.unit_id && ctx.unitId && rule.unit_id === ctx.unitId) {
      score += 200;
    } else if (rule.unit_id && (!ctx.unitId || rule.unit_id !== ctx.unitId)) {
      return -1;
    }

    if (rule.business_area && ctx.businessArea && rule.business_area.toUpperCase() === ctx.businessArea.toUpperCase()) {
      score += 150;
    } else if (rule.business_area && (!ctx.businessArea || rule.business_area.toUpperCase() !== ctx.businessArea.toUpperCase())) {
      return -1;
    }

    if (rule.department_id && ctx.departmentId && rule.department_id === ctx.departmentId) {
      score += 100;
    } else if (rule.department_id && (!ctx.departmentId || rule.department_id !== ctx.departmentId)) {
      return -1;
    }

    if (rule.task_type && ctx.taskType && rule.task_type.toUpperCase() === ctx.taskType.toUpperCase()) {
      score += 80;
    } else if (rule.task_type && (!ctx.taskType || rule.task_type.toUpperCase() !== ctx.taskType.toUpperCase())) {
      return -1;
    }

    return score;
  }

  /**
   * RESOLUTION ENGINE: Resolves responsibility based on context dimensions
   */
  async resolveResponsibility(context: ResponsibilityResolutionContext) {
    const targetDate = context.date ? context.date.split('T')[0] : new Date().toISOString().split('T')[0];

    // Fetch all active rules within effective dates
    let query = this.supabase
      .from('responsibility_rules')
      .select(`
        *,
        responsible_department:departments!responsible_department_id(id, name, code),
        primary_member:user_profiles!primary_member_id(id, full_name, email, designation, status),
        backup_member:user_profiles!backup_member_id(id, full_name, email, designation, status),
        escalation_manager:user_profiles!escalation_manager_id(id, full_name, email, designation, status),
        escalation_level2:user_profiles!escalation_level2_id(id, full_name, email, designation, status),
        escalation_level3:user_profiles!escalation_level3_id(id, full_name, email, designation, status)
      `)
      .eq('organization_id', this.orgId)
      .eq('status', 'ACTIVE');

    if (typeof (query as any).lte === 'function') {
      query = (query as any).lte('effective_from', targetDate);
    }

    const { data: rules, error } = await query;
    if (error) throw new AppError(error.message, 500);

    const activeRules = (rules || []).filter((r: any) => {
      if (!r.effective_to) return true;
      return r.effective_to >= targetDate;
    });

    if (activeRules.length === 0) {
      return {
        matchedRule: null,
        responsibleDepartment: null,
        suggestedMember: null,
        backupMember: null,
        escalationManager: null,
        escalationLevel2: null,
        escalationLevel3: null,
        sla: {
          response_sla_days: 2,
          completion_sla_days: 7,
          followup_interval_days: 2,
          escalation_delay_days: 2,
          sla_calendar_type: 'BUSINESS_DAYS',
          calculated_due_date: ResponsibilityService.computeDueDate(7, 'BUSINESS_DAYS'),
        },
        assignmentMode: 'MANUAL',
        explanation: 'Responsibility Not Configured: No active matching rule found for this scope.',
        conflicts: [],
        hasConflict: false,
      };
    }

    // Score rules based on specificity
    const scoredRules: { rule: any; score: number }[] = [];
    for (const r of activeRules) {
      const score = this.computeRuleScore(r, context);
      if (score >= 0) {
        scoredRules.push({ rule: r, score });
      }
    }

    if (scoredRules.length === 0) {
      return {
        matchedRule: null,
        responsibleDepartment: null,
        suggestedMember: null,
        backupMember: null,
        escalationManager: null,
        escalationLevel2: null,
        escalationLevel3: null,
        sla: {
          response_sla_days: 2,
          completion_sla_days: 7,
          followup_interval_days: 2,
          escalation_delay_days: 2,
          sla_calendar_type: 'BUSINESS_DAYS',
          calculated_due_date: ResponsibilityService.computeDueDate(7, 'BUSINESS_DAYS'),
        },
        assignmentMode: 'MANUAL',
        explanation: 'Responsibility Not Configured: None of the active rules match the specified parameters.',
        conflicts: [],
        hasConflict: false,
      };
    }

    // Sort by score descending
    scoredRules.sort((a, b) => b.score - a.score);

    const topScore = scoredRules[0].score;
    const candidates = scoredRules.filter(sr => sr.score === topScore);

    // Conflict detection: if multiple rules share top score and assign different departments or members
    const conflicts: any[] = [];
    if (candidates.length > 1) {
      const first = candidates[0].rule;
      const hasDivergence = candidates.some(c => 
        c.rule.responsible_department_id !== first.responsible_department_id ||
        c.rule.primary_member_id !== first.primary_member_id
      );

      if (hasDivergence) {
        conflicts.push(...candidates.map(c => c.rule));
      }
    }

    const matchedRule = candidates[0].rule;

    // Active status verification: ensure suggested member is active
    let suggestedMember = null;
    let memberStatusNote = '';

    if (matchedRule.primary_member) {
      if (matchedRule.primary_member.status === 'ACTIVE') {
        suggestedMember = matchedRule.primary_member;
      } else {
        memberStatusNote = ` (Primary member ${matchedRule.primary_member.full_name} is inactive`;
        if (matchedRule.backup_member && matchedRule.backup_member.status === 'ACTIVE') {
          suggestedMember = matchedRule.backup_member;
          memberStatusNote += ` -> Suggested backup member ${matchedRule.backup_member.full_name})`;
        } else {
          memberStatusNote += ' -> No active backup member configured)';
        }
      }
    } else if (matchedRule.backup_member && matchedRule.backup_member.status === 'ACTIVE') {
      suggestedMember = matchedRule.backup_member;
      memberStatusNote = ' (Primary unassigned -> Suggested backup member)';
    }

    // Compose explanation
    const deptName = matchedRule.responsible_department?.name || 'Assigned Department';
    const ruleCode = matchedRule.rule_code;
    const ruleName = matchedRule.rule_name;
    const taskTypeLabel = context.taskType ? context.taskType.replace(/_/g, ' ') : 'General Task';
    
    let explanation = `Assigned based on: ${taskTypeLabel} → ${deptName} → Rule ${ruleCode} (${ruleName})${memberStatusNote}.`;
    if (conflicts.length > 0) {
      explanation = `[CONFIGURATION CONFLICT DETECTED] Multiple overlapping rules (${conflicts.map(c => c.rule_code).join(', ')}) share priority score ${topScore}. Please resolve configuration conflict.`;
    }

    const calculatedDueDate = ResponsibilityService.computeDueDate(
      matchedRule.completion_sla_days || 7,
      matchedRule.sla_calendar_type || 'BUSINESS_DAYS'
    );

    return {
      matchedRule: {
        id: matchedRule.id,
        rule_code: matchedRule.rule_code,
        rule_name: matchedRule.rule_name,
        description: matchedRule.description,
        assignment_mode: matchedRule.assignment_mode,
        priority_score: matchedRule.priority_score,
      },
      responsibleDepartment: matchedRule.responsible_department,
      suggestedMember: suggestedMember ? {
        id: suggestedMember.id,
        full_name: suggestedMember.full_name,
        email: suggestedMember.email,
        designation: suggestedMember.designation,
      } : null,
      backupMember: matchedRule.backup_member ? {
        id: matchedRule.backup_member.id,
        full_name: matchedRule.backup_member.full_name,
        email: matchedRule.backup_member.email,
        designation: matchedRule.backup_member.designation,
      } : null,
      escalationManager: matchedRule.escalation_manager ? {
        id: matchedRule.escalation_manager.id,
        full_name: matchedRule.escalation_manager.full_name,
        email: matchedRule.escalation_manager.email,
        designation: matchedRule.escalation_manager.designation,
      } : null,
      escalationLevel2: matchedRule.escalation_level2 ? {
        id: matchedRule.escalation_level2.id,
        full_name: matchedRule.escalation_level2.full_name,
        email: matchedRule.escalation_level2.email,
      } : null,
      escalationLevel3: matchedRule.escalation_level3 ? {
        id: matchedRule.escalation_level3.id,
        full_name: matchedRule.escalation_level3.full_name,
        email: matchedRule.escalation_level3.email,
      } : null,
      sla: {
        response_sla_days: matchedRule.response_sla_days,
        completion_sla_days: matchedRule.completion_sla_days,
        followup_interval_days: matchedRule.followup_interval_days,
        escalation_delay_days: matchedRule.escalation_delay_days,
        sla_calendar_type: matchedRule.sla_calendar_type,
        calculated_due_date: calculatedDueDate,
      },
      assignmentMode: matchedRule.assignment_mode || 'SUGGEST',
      explanation,
      conflicts,
      hasConflict: conflicts.length > 0,
    };
  }

  /**
   * List all responsibility rules with relations
   */
  async listRules(filters: any = {}) {
    let q = this.supabase
      .from('responsibility_rules')
      .select(`
        *,
        unit:business_units(id, name, code),
        department:departments!department_id(id, name, code),
        responsible_department:departments!responsible_department_id(id, name, code),
        primary_member:user_profiles!primary_member_id(id, full_name, email, designation, status),
        backup_member:user_profiles!backup_member_id(id, full_name, email, designation, status),
        escalation_manager:user_profiles!escalation_manager_id(id, full_name, email, designation, status),
        product:products(id, product_name, product_code)
      `)
      .eq('organization_id', this.orgId)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'ALL') {
      q = q.eq('status', filters.status);
    }
    if (filters.department_id) {
      q = q.eq('responsible_department_id', filters.department_id);
    }
    if (filters.task_type && filters.task_type !== 'ALL') {
      q = q.eq('task_type', filters.task_type);
    }
    if (filters.assignment_mode && filters.assignment_mode !== 'ALL') {
      q = q.eq('assignment_mode', filters.assignment_mode);
    }

    const { data, error } = await q;
    if (error) throw new AppError(error.message, 500);
    return data || [];
  }

  /**
   * Get single rule by ID
   */
  async getRule(id: string) {
    const { data, error } = await this.supabase
      .from('responsibility_rules')
      .select(`
        *,
        unit:business_units(id, name, code),
        department:departments!department_id(id, name, code),
        responsible_department:departments!responsible_department_id(id, name, code),
        primary_member:user_profiles!primary_member_id(id, full_name, email, designation, status),
        backup_member:user_profiles!backup_member_id(id, full_name, email, designation, status),
        escalation_manager:user_profiles!escalation_manager_id(id, full_name, email, designation, status),
        escalation_level2:user_profiles!escalation_level2_id(id, full_name, email, designation, status),
        escalation_level3:user_profiles!escalation_level3_id(id, full_name, email, designation, status),
        product:products(id, product_name, product_code)
      `)
      .eq('organization_id', this.orgId)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundError('Responsibility rule not found');
    return data;
  }

  /**
   * Create a new responsibility rule
   */
  async createRule(payload: any, userId?: string) {
    const ruleCode = payload.rule_code || (await this.generateRuleCode());
    const actorId = userId || this.userId;

    const insertData: any = {
      organization_id: this.orgId,
      rule_code: ruleCode,
      rule_name: payload.rule_name,
      description: payload.description,
      unit_id: payload.unit_id || null,
      department_id: payload.department_id || null,
      task_type: payload.task_type || null,
      business_area: payload.business_area || null,
      product_type: payload.product_type || null,
      product_id: payload.product_id || null,
      molecule_id: payload.molecule_id || null,
      opportunity_type: payload.opportunity_type || null,
      responsible_department_id: payload.responsible_department_id,
      primary_member_id: payload.primary_member_id || null,
      backup_member_id: payload.backup_member_id || null,
      escalation_manager_id: payload.escalation_manager_id || null,
      escalation_level2_id: payload.escalation_level2_id || null,
      escalation_level3_id: payload.escalation_level3_id || null,
      response_sla_days: payload.response_sla_days || 2,
      completion_sla_days: payload.completion_sla_days || 7,
      followup_interval_days: payload.followup_interval_days || 2,
      escalation_delay_days: payload.escalation_delay_days || 2,
      sla_calendar_type: payload.sla_calendar_type || 'BUSINESS_DAYS',
      assignment_mode: payload.assignment_mode || 'SUGGEST',
      priority_score: payload.priority_score || 100,
      effective_from: payload.effective_from || new Date().toISOString().split('T')[0],
      effective_to: payload.effective_to || null,
      status: payload.status || 'ACTIVE',
      version: 1,
      created_by: actorId,
      updated_by: actorId,
    };

    const { data: created, error } = await this.supabase
      .from('responsibility_rules')
      .insert(insertData)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);

    // Audit History Record
    await this.supabase.from('responsibility_rule_history').insert({
      organization_id: this.orgId,
      rule_id: created.id,
      version: 1,
      changed_by: actorId,
      change_type: 'CREATED',
      change_reason: payload.change_reason || 'Initial rule creation',
      previous_values: null,
      new_values: created,
    });

    return created;
  }

  /**
   * Update an existing responsibility rule (Versioned & Audited)
   */
  async updateRule(id: string, payload: any, userId?: string, reason?: string) {
    const existing = await this.getRule(id);
    const actorId = userId || this.userId;
    const nextVersion = (existing.version || 1) + 1;

    const updateData: any = {
      rule_name: payload.rule_name !== undefined ? payload.rule_name : existing.rule_name,
      description: payload.description !== undefined ? payload.description : existing.description,
      unit_id: payload.unit_id !== undefined ? payload.unit_id : existing.unit_id,
      department_id: payload.department_id !== undefined ? payload.department_id : existing.department_id,
      task_type: payload.task_type !== undefined ? payload.task_type : existing.task_type,
      business_area: payload.business_area !== undefined ? payload.business_area : existing.business_area,
      product_type: payload.product_type !== undefined ? payload.product_type : existing.product_type,
      product_id: payload.product_id !== undefined ? payload.product_id : existing.product_id,
      molecule_id: payload.molecule_id !== undefined ? payload.molecule_id : existing.molecule_id,
      opportunity_type: payload.opportunity_type !== undefined ? payload.opportunity_type : existing.opportunity_type,
      responsible_department_id: payload.responsible_department_id !== undefined ? payload.responsible_department_id : existing.responsible_department_id,
      primary_member_id: payload.primary_member_id !== undefined ? payload.primary_member_id : existing.primary_member_id,
      backup_member_id: payload.backup_member_id !== undefined ? payload.backup_member_id : existing.backup_member_id,
      escalation_manager_id: payload.escalation_manager_id !== undefined ? payload.escalation_manager_id : existing.escalation_manager_id,
      escalation_level2_id: payload.escalation_level2_id !== undefined ? payload.escalation_level2_id : existing.escalation_level2_id,
      escalation_level3_id: payload.escalation_level3_id !== undefined ? payload.escalation_level3_id : existing.escalation_level3_id,
      response_sla_days: payload.response_sla_days !== undefined ? payload.response_sla_days : existing.response_sla_days,
      completion_sla_days: payload.completion_sla_days !== undefined ? payload.completion_sla_days : existing.completion_sla_days,
      followup_interval_days: payload.followup_interval_days !== undefined ? payload.followup_interval_days : existing.followup_interval_days,
      escalation_delay_days: payload.escalation_delay_days !== undefined ? payload.escalation_delay_days : existing.escalation_delay_days,
      sla_calendar_type: payload.sla_calendar_type !== undefined ? payload.sla_calendar_type : existing.sla_calendar_type,
      assignment_mode: payload.assignment_mode !== undefined ? payload.assignment_mode : existing.assignment_mode,
      priority_score: payload.priority_score !== undefined ? payload.priority_score : existing.priority_score,
      effective_from: payload.effective_from !== undefined ? payload.effective_from : existing.effective_from,
      effective_to: payload.effective_to !== undefined ? payload.effective_to : existing.effective_to,
      status: payload.status !== undefined ? payload.status : existing.status,
      version: nextVersion,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await this.supabase
      .from('responsibility_rules')
      .update(updateData)
      .eq('organization_id', this.orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new AppError(error.message, 500);

    // Audit History Record
    await this.supabase.from('responsibility_rule_history').insert({
      organization_id: this.orgId,
      rule_id: id,
      version: nextVersion,
      changed_by: actorId,
      change_type: 'UPDATED',
      change_reason: reason || payload.change_reason || 'Rule configuration updated',
      previous_values: existing,
      new_values: updated,
    });

    return updated;
  }

  /**
   * Deactivate a rule with reason
   */
  async deactivateRule(id: string, userId?: string, reason?: string) {
    return this.updateRule(id, { status: 'INACTIVE' }, userId, reason || 'Rule deactivated by administrator');
  }

  /**
   * Duplicate a rule
   */
  async duplicateRule(id: string, userId?: string) {
    const original = await this.getRule(id);
    const newName = `${original.rule_name} (Copy)`;
    const duplicatedPayload = {
      ...original,
      id: undefined,
      rule_code: undefined,
      rule_name: newName,
      status: 'DRAFT',
    };
    return this.createRule(duplicatedPayload, userId);
  }

  /**
   * Detect overlapping / conflicting rules in the organization
   */
  async detectConflicts() {
    const rules = await this.listRules({ status: 'ACTIVE' });
    const conflicts: {
      ruleA: any;
      ruleB: any;
      reason: string;
      conflictType: 'DUPLICATE_SCOPE' | 'EQUAL_PRIORITY_DIVERGENCE' | 'OVERLAPPING_PERIOD';
    }[] = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rA = rules[i];
        const rB = rules[j];

        // Check if effective periods overlap
        const rAStart = rA.effective_from;
        const rAEnd = rA.effective_to || '9999-12-31';
        const rBStart = rB.effective_from;
        const rBEnd = rB.effective_to || '9999-12-31';

        const periodsOverlap = rAStart <= rBEnd && rBStart <= rAEnd;
        if (!periodsOverlap) continue;

        // Check scope equivalence
        const sameTaskType = (rA.task_type || null) === (rB.task_type || null);
        const sameProduct = (rA.product_id || null) === (rB.product_id || null);
        const sameMolecule = (rA.molecule_id || null) === (rB.molecule_id || null);
        const sameUnit = (rA.unit_id || null) === (rB.unit_id || null);
        const sameDept = (rA.department_id || null) === (rB.department_id || null);
        const sameArea = (rA.business_area || null) === (rB.business_area || null);

        const identicalScope = sameTaskType && sameProduct && sameMolecule && sameUnit && sameDept && sameArea;

        if (identicalScope) {
          if (rA.responsible_department_id !== rB.responsible_department_id || rA.primary_member_id !== rB.primary_member_id) {
            conflicts.push({
              ruleA: rA,
              ruleB: rB,
              reason: `Rules "${rA.rule_code}" and "${rB.rule_code}" have identical matching scopes but assign different departments/members.`,
              conflictType: 'DUPLICATE_SCOPE',
            });
          }
        } else if (rA.priority_score === rB.priority_score && (rA.task_type === rB.task_type || (!rA.task_type && !rB.task_type))) {
          // Equal priority with differing outputs
          if (rA.responsible_department_id !== rB.responsible_department_id || rA.primary_member_id !== rB.primary_member_id) {
            conflicts.push({
              ruleA: rA,
              ruleB: rB,
              reason: `Rules "${rA.rule_code}" and "${rB.rule_code}" share the same priority score (${rA.priority_score}) with conflicting responsibility.`,
              conflictType: 'EQUAL_PRIORITY_DIVERGENCE',
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Get audit history for a rule
   */
  async getAuditHistory(ruleId: string) {
    const { data, error } = await this.supabase
      .from('responsibility_rule_history')
      .select(`
        *,
        changer:user_profiles!changed_by(id, full_name, email, designation)
      `)
      .eq('organization_id', this.orgId)
      .eq('rule_id', ruleId)
      .order('version', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    return data || [];
  }

  /**
   * Matrix view: Business requirement / task type vs Department, Primary, Backup, SLA, Escalation
   */
  async getMatrixView() {
    const rules = await this.listRules({ status: 'ACTIVE' });
    return rules.map((r: any) => ({
      id: r.id,
      ruleCode: r.rule_code,
      ruleName: r.rule_name,
      businessRequirement: r.task_type ? r.task_type.replace(/_/g, ' ') : (r.business_area ? r.business_area.replace(/_/g, ' ') : 'General'),
      department: r.responsible_department?.name || 'Unassigned',
      departmentCode: r.responsible_department?.code || '',
      primaryMember: r.primary_member ? r.primary_member.full_name : 'Pending Assignment',
      primaryEmail: r.primary_member?.email,
      backupMember: r.backup_member ? r.backup_member.full_name : 'None',
      slaDays: `${r.completion_sla_days}d (${r.sla_calendar_type === 'BUSINESS_DAYS' ? 'Biz' : 'Cal'})`,
      escalationManager: r.escalation_manager ? r.escalation_manager.full_name : 'None',
      assignmentMode: r.assignment_mode,
      status: r.status,
    }));
  }

  /**
   * Fetch active members of a department
   */
  async getDepartmentMembers(departmentId: string) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id, full_name, email, designation, employee_code, status')
        .eq('organization_id', this.orgId)
        .eq('department_id', departmentId)
        .eq('status', 'ACTIVE')
        .order('full_name');

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err: any) {
      // Non-blocking fallback
    }

    const { UserUploadService } = require('./user-upload.service');
    const matched = (UserUploadService?.fallbackUsers || []).filter(
      (u: any) => u.department_id === departmentId && u.status === 'ACTIVE'
    );
    return matched;
  }

  /**
   * Log a task-level assignment override
   */
  async recordTaskOverride(
    taskId: string,
    ruleId: string | null,
    suggestedDeptId: string | null,
    suggestedUserId: string | null,
    assignedDeptId: string | null,
    assignedUserId: string | null,
    overrideReason: string,
    actorId?: string
  ) {
    const { data, error } = await this.supabase
      .from('task_responsibility_overrides')
      .insert({
        organization_id: this.orgId,
        task_id: taskId,
        rule_id: ruleId,
        suggested_department_id: suggestedDeptId,
        suggested_member_id: suggestedUserId,
        assigned_department_id: assignedDeptId,
        assigned_member_id: assignedUserId,
        override_reason: overrideReason,
        overridden_by: actorId || this.userId,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return data;
  }

  /**
   * Export all responsibility rules to Excel format (Buffer)
   */
  async exportRulesToExcel(): Promise<Buffer> {
    const rules = await this.listRules();

    const rows = rules.map((r: any) => ({
      'Rule Code': r.rule_code,
      'Rule Name': r.rule_name,
      'Description': r.description || '',
      'Unit Code': r.unit?.code || '',
      'Department Code': r.department?.code || '',
      'Task Type': r.task_type || '',
      'Business Area': r.business_area || '',
      'Product Code': r.product?.product_code || '',
      'Responsible Department Code': r.responsible_department?.code || '',
      'Responsible Department Name': r.responsible_department?.name || '',
      'Primary Member Email': r.primary_member?.email || '',
      'Backup Member Email': r.backup_member?.email || '',
      'Escalation Manager Email': r.escalation_manager?.email || '',
      'Response SLA (Days)': r.response_sla_days || 2,
      'Completion SLA (Days)': r.completion_sla_days || 7,
      'Follow-up Interval (Days)': r.followup_interval_days || 2,
      'Escalation Delay (Days)': r.escalation_delay_days || 2,
      'SLA Calendar Type': r.sla_calendar_type || 'BUSINESS_DAYS',
      'Assignment Mode': r.assignment_mode || 'SUGGEST',
      'Priority Score': r.priority_score || 100,
      'Effective From': r.effective_from,
      'Effective To': r.effective_to || '',
      'Status': r.status || 'ACTIVE',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Responsibility Rules');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Import responsibility rules from Excel with strict canonical resolution
   */
  async importRulesFromExcel(buffer: Buffer, actorId?: string): Promise<{
    created: number;
    updated: number;
    conflicts: any[];
    errors: string[];
  }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new ValidationError('Excel file contains no sheets');

    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (rows.length === 0) throw new ValidationError('Excel sheet contains no data');

    // Fetch canonical departments, user_profiles, products
    const [departmentsRes, usersRes, productsRes] = await Promise.all([
      this.supabase.from('departments').select('id, code, name').eq('organization_id', this.orgId),
      this.supabase.from('user_profiles').select('id, email, full_name, status').eq('organization_id', this.orgId),
      this.supabase.from('products').select('id, product_code').eq('organization_id', this.orgId),
    ]);

    const deptMap = new Map<string, string>(); // code/name -> id
    (departmentsRes.data || []).forEach((d: any) => {
      deptMap.set(d.code.toUpperCase(), d.id);
      deptMap.set(d.name.toUpperCase(), d.id);
    });

    const userEmailMap = new Map<string, string>(); // email -> id
    (usersRes.data || []).forEach((u: any) => {
      userEmailMap.set(u.email.toLowerCase(), u.id);
    });

    const productMap = new Map<string, string>(); // code -> id
    (productsRes.data || []).forEach((p: any) => {
      productMap.set(p.product_code.toUpperCase(), p.id);
    });

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 2;

      const ruleName = row['Rule Name'];
      if (!ruleName) {
        errors.push(`Row ${rowNum}: "Rule Name" is required.`);
        continue;
      }

      const respDeptCode = (row['Responsible Department Code'] || row['Responsible Department Name'] || '').toString().trim().toUpperCase();
      const respDeptId = deptMap.get(respDeptCode);
      if (!respDeptId) {
        errors.push(`Row ${rowNum}: Responsible department "${respDeptCode}" does not match any canonical department in organization.`);
        continue;
      }

      let primaryMemberId: string | null = null;
      if (row['Primary Member Email']) {
        const email = row['Primary Member Email'].toString().trim().toLowerCase();
        primaryMemberId = userEmailMap.get(email) || null;
        if (!primaryMemberId) {
          errors.push(`Row ${rowNum}: Primary member email "${email}" not found in canonical user directory.`);
          continue;
        }
      }

      let backupMemberId: string | null = null;
      if (row['Backup Member Email']) {
        const email = row['Backup Member Email'].toString().trim().toLowerCase();
        backupMemberId = userEmailMap.get(email) || null;
      }

      let escalationManagerId: string | null = null;
      if (row['Escalation Manager Email']) {
        const email = row['Escalation Manager Email'].toString().trim().toLowerCase();
        escalationManagerId = userEmailMap.get(email) || null;
      }

      let productId: string | null = null;
      if (row['Product Code']) {
        const pCode = row['Product Code'].toString().trim().toUpperCase();
        productId = productMap.get(pCode) || null;
      }

      const ruleCode = row['Rule Code'] ? row['Rule Code'].toString().trim() : null;

      const payload: any = {
        rule_name: ruleName,
        description: row['Description'] || '',
        task_type: row['Task Type'] || null,
        business_area: row['Business Area'] || null,
        product_id: productId,
        responsible_department_id: respDeptId,
        primary_member_id: primaryMemberId,
        backup_member_id: backupMemberId,
        escalation_manager_id: escalationManagerId,
        response_sla_days: parseInt(row['Response SLA (Days)'], 10) || 2,
        completion_sla_days: parseInt(row['Completion SLA (Days)'], 10) || 7,
        followup_interval_days: parseInt(row['Follow-up Interval (Days)'], 10) || 2,
        escalation_delay_days: parseInt(row['Escalation Delay (Days)'], 10) || 2,
        sla_calendar_type: row['SLA Calendar Type'] || 'BUSINESS_DAYS',
        assignment_mode: row['Assignment Mode'] || 'SUGGEST',
        priority_score: parseInt(row['Priority Score'], 10) || 100,
        effective_from: row['Effective From'] || new Date().toISOString().split('T')[0],
        effective_to: row['Effective To'] || null,
        status: row['Status'] || 'ACTIVE',
      };

      if (ruleCode) {
        // Check if rule code exists
        const { data: existing } = await this.supabase
          .from('responsibility_rules')
          .select('id')
          .eq('organization_id', this.orgId)
          .eq('rule_code', ruleCode)
          .maybeSingle();

        if (existing) {
          await this.updateRule(existing.id, payload, actorId, 'Imported from Excel');
          updatedCount++;
          continue;
        }
      }

      payload.rule_code = ruleCode;
      await this.createRule(payload, actorId);
      createdCount++;
    }

    const conflicts = await this.detectConflicts();

    return {
      created: createdCount,
      updated: updatedCount,
      conflicts,
      errors,
    };
  }
}
