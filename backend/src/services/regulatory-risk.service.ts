export interface RegulatoryRiskRuleResult {
  riskCode: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  explanation: string;
  mitigationSuggestion: string;
}

export class RegulatoryRiskService {
  /**
   * Evaluates deterministic regulatory risk rules for a product across specified target jurisdictions.
   * Rule-based decision support, transparent and free of black-box AI.
   */
  public static evaluateRisks(
    targetJurisdiction: string,
    records: any[],
    product: any
  ): RegulatoryRiskRuleResult[] {
    const identifiedRisks: RegulatoryRiskRuleResult[] = [];

    // Filter records for this jurisdiction
    const jurisdictionRecords = records.filter(r => 
      r.jurisdiction_code?.toUpperCase() === targetJurisdiction.toUpperCase()
    );

    // 1. Rule: NO_REGULATORY_DATA
    if (jurisdictionRecords.length === 0) {
      identifiedRisks.push({
        riskCode: 'NO_REGULATORY_DATA',
        severity: 'HIGH',
        title: `No Regulatory Records in ${targetJurisdiction}`,
        explanation: `No verified marketing authorizations, filings, or approvals are registered in the system for jurisdiction ${targetJurisdiction}.`,
        mitigationSuggestion: 'Conduct primary regulatory authority inquiries or ingest an authorized jurisdiction dossier.',
      });
      return identifiedRisks;
    }

    // Check statuses
    const activeApprovals = jurisdictionRecords.filter(r => 
      ['APPROVED', 'AUTHORIZED', 'MARKETED'].includes(r.normalized_status)
    );
    const withdrawnOrRevoked = jurisdictionRecords.filter(r => 
      ['WITHDRAWN', 'REVOKED', 'SUSPENDED'].includes(r.normalized_status)
    );
    const expired = jurisdictionRecords.filter(r => 
      r.normalized_status === 'EXPIRED' || (r.expiry_date && new Date(r.expiry_date) < new Date())
    );
    const pending = jurisdictionRecords.filter(r => 
      ['PENDING', 'UNDER_REVIEW', 'SUBMITTED'].includes(r.normalized_status)
    );

    // 2. Rule: WITHDRAWN_STATUS or SUSPENDED_STATUS
    if (withdrawnOrRevoked.length > 0) {
      const isSuspended = withdrawnOrRevoked.some(r => r.normalized_status === 'SUSPENDED');
      identifiedRisks.push({
        riskCode: isSuspended ? 'SUSPENDED_STATUS' : 'WITHDRAWN_STATUS',
        severity: 'CRITICAL',
        title: `Product Authorization ${isSuspended ? 'Suspended' : 'Withdrawn'} in ${targetJurisdiction}`,
        explanation: `A regulatory record indicates that authorization has been ${isSuspended ? 'suspended' : 'withdrawn or revoked'} by the competent authority.`,
        mitigationSuggestion: 'Investigate the withdrawal reason (safety action, commercial discontinuation, or GMP compliance).',
      });
    }

    // 3. Rule: EXPIRED_STATUS
    if (expired.length > 0) {
      identifiedRisks.push({
        riskCode: 'EXPIRED_STATUS',
        severity: 'HIGH',
        title: `Marketing Authorization Expired in ${targetJurisdiction}`,
        explanation: `The marketing authorization or registration has lapsed past its validity date without recorded renewal.`,
        mitigationSuggestion: 'Verify if a renewal application has been lodged with the regulatory authority.',
      });
    }

    // 4. Rule: PENDING_APPLICATION
    if (activeApprovals.length === 0 && pending.length > 0) {
      identifiedRisks.push({
        riskCode: 'PENDING_APPLICATION',
        severity: 'MEDIUM',
        title: `Filing Pending Evaluation in ${targetJurisdiction}`,
        explanation: `An active submission/application is under regulatory review. Formal marketing authorization has not yet been granted.`,
        mitigationSuggestion: 'Track statutory review timelines and regulatory agency inquiry milestones.',
      });
    }

    // 5. Rule: APPROVAL_NOT_FOUND
    if (activeApprovals.length === 0 && withdrawnOrRevoked.length === 0 && pending.length === 0) {
      identifiedRisks.push({
        riskCode: 'APPROVAL_NOT_FOUND',
        severity: 'HIGH',
        title: `Commercial Approval Not Established in ${targetJurisdiction}`,
        explanation: `Records exist for this product/molecule but none confirm active commercial market authorization in ${targetJurisdiction}.`,
        mitigationSuggestion: 'Evaluate regulatory filing pathways (e.g. ANDA, MRP, DCP) required for new market entry.',
      });
    }

    // 6. Rule: DATA_STALE
    const now = Date.now();
    const staleRecords = jurisdictionRecords.filter(r => {
      const lastCheck = r.source_last_updated_date || r.ingested_at;
      if (!lastCheck) return false;
      const diffDays = (now - new Date(lastCheck).getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 180;
    });

    if (staleRecords.length > 0) {
      identifiedRisks.push({
        riskCode: 'DATA_STALE',
        severity: 'LOW',
        title: `Regulatory Data Requires Freshness Verification in ${targetJurisdiction}`,
        explanation: `Source regulatory data for this product was last refreshed over 180 days ago.`,
        mitigationSuggestion: 'Schedule a source feed refresh or verify against current official regulatory gazettes.',
      });
    }

    // 7. Rule: SOURCE_CONFLICT
    const uniqueStatuses = Array.from(new Set(jurisdictionRecords.map(r => r.normalized_status)));
    if (uniqueStatuses.length > 1 && (uniqueStatuses.includes('APPROVED') && uniqueStatuses.includes('WITHDRAWN'))) {
      identifiedRisks.push({
        riskCode: 'SOURCE_CONFLICT',
        severity: 'HIGH',
        title: `Conflicting Regulatory Status Records in ${targetJurisdiction}`,
        explanation: `Multiple sources report divergent statuses (e.g. APPROVED vs WITHDRAWN) for this product in ${targetJurisdiction}.`,
        mitigationSuggestion: 'Trigger operator conflict review in the Regulatory Data Quality Center.',
      });
    }

    return identifiedRisks;
  }
}
