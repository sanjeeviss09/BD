import * as XLSX from 'xlsx';
import { BenchmarkingResult } from './cdmo-benchmarking.service';

export class CommercialDecisionReportService {
  /**
   * Generate an 11-Sheet Excel Workbook matching Phase 9 Specification
   * Sheet 1 is the configurable Executive Summary
   */
  public static generateManagementExcelWorkbook(
    evaluation: any,
    benchmark: BenchmarkingResult
  ): { buffer: Buffer; fileName: string } {
    const workbook = XLSX.utils.book_new();

    const ev = evaluation;
    const bm = benchmark;
    const econ = bm.axxelentCommercialViability;
    const opp = bm.opportunitySummary;
    const feas = bm.axxelentManufacturingFeasibility;
    const rec = bm.strategicRecommendation;
    const qAnswers = bm.managementQuestionsAnswers;

    // =========================================================================
    // SHEET 1: EXECUTIVE SUMMARY (MANDATORY PHASE 9 CONFIGURABLE SUMMARY)
    // =========================================================================
    const sheet1Data = [
      { Parameter: 'Evaluation ID & Number', Value: ev.evaluation_number || ev.id },
      { Parameter: 'Evaluation Title', Value: ev.title },
      { Parameter: 'Customer Name', Value: ev.customer_name || 'N/A' },
      { Parameter: 'Product / Molecule', Value: opp.productOrMolecule },
      { Parameter: 'Target Market Country', Value: opp.targetMarketCountry },
      { Parameter: 'Requested Quantity & Unit', Value: `${opp.quantity.toLocaleString()} ${opp.quantityUnit}` },
      { Parameter: 'Internal Proposed Price', Value: `${opp.currency} ${opp.proposedPrice.toFixed(2)}` },
      { Parameter: 'Customer Target Price', Value: opp.customerTargetPrice ? `${opp.currency} ${opp.customerTargetPrice.toFixed(2)}` : 'Not Specified' },
      { Parameter: 'Axxelent Manufacturing Assessment', Value: feas.isTechnicallyFeasible ? `FEASIBLE (${feas.facilityName})` : 'NOT FEASIBLE' },
      { Parameter: 'Axxelent Commercial Assessment', Value: `${econ.meetsHurdle ? 'ATTRACTIVE' : 'MARGINAL'} (Gross Margin: ${econ.grossMarginPct}%)` },
      { Parameter: 'Overall Strategic Recommendation', Value: `${rec.decisionBadge}: ${rec.headlineRationale}` },
      { Parameter: 'Competitive Position Summary', Value: qAnswers.question4_howDoesAxxelentCompare.answer },
      { Parameter: 'Critical Risks', Value: bm.riskRegister.map(r => `[${r.severity}] ${r.risk}`).join('; ') },
      { Parameter: 'Missing Information / Unknowns', Value: bm.advantagesAndGaps.missingCompetitorInformation.join('; ') },
      { Parameter: 'Top Recommended Action', Value: bm.actionPlan[0]?.action || 'Initiate customer engagement' },
      { Parameter: 'Assessment Date & Version', Value: `${bm.evaluatedAt.split('T')[0]} (Version ${bm.benchmarkVersion})` },
      { Parameter: 'Competitive Suitability Score', Value: `${bm.scoring.competitiveSuitabilityScore} / 100` },
      { Parameter: 'Evidence Completeness Score', Value: `${bm.scoring.evidenceCompletenessScore} / 100` },
      { Parameter: 'AI & Calculation Traceability', Value: `Model: ${bm.auditAndProvenance.aiModelIdentifier} | Engine: ${bm.auditAndProvenance.calculationVersion}` },
      { Parameter: 'Governance Notice', Value: 'Deterministic financial model. Binding commercial decisions require executive sign-off.' },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet1Data), 'Executive_Summary');

    // =========================================================================
    // SHEET 2: OPPORTUNITY & REQUIREMENT PROFILE
    // =========================================================================
    const sheet2Data = [
      { Field: 'RFQ / Opportunity Code', Value: ev.rfq_id || 'Direct Tender RFP' },
      { Field: 'Client Name', Value: ev.customer_name },
      { Field: 'Target Market', Value: opp.targetMarketCountry },
      { Field: 'Product Formulation', Value: opp.productOrMolecule },
      { Field: 'Dosage Form', Value: opp.dosageForm },
      { Field: 'Order Volume Basis', Value: `${opp.quantity} ${opp.quantityUnit}` },
      { Field: 'Target Delivery Lead Time', Value: `${opp.requiredTimelineDays} Days` },
      { Field: 'Customer Target Price', Value: opp.customerTargetPrice ? `${opp.currency} ${opp.customerTargetPrice}` : 'Unknown' },
      { Field: 'Payment Terms', Value: ev.pricing?.payment_terms || 'NET_60' },
      { Field: 'Incoterm Basis', Value: ev.pricing?.incoterm || 'DDP' },
      { Field: 'Regulatory Jurisdiction', Value: opp.targetMarketCountry === 'US' ? 'US FDA 21 CFR' : 'EU EMA cGMP' },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet2Data), 'Opportunity_Profile');

    // =========================================================================
    // SHEET 3: AXXELENT MANUFACTURING FEASIBILITY
    // =========================================================================
    const sheet3Data = [
      { Parameter: 'Technical Feasibility', Value: feas.isTechnicallyFeasible ? 'CONFIRMED FEASIBLE' : 'INFEASIBLE' },
      { Parameter: 'Designated Manufacturing Facility', Value: feas.facilityName },
      { Parameter: 'Assigned Production Line', Value: feas.productionLine },
      { Parameter: 'Standard Production Batch Size', Value: `${feas.batchSize.toLocaleString()} Units` },
      { Parameter: 'Estimated Production Batches', Value: feas.estimatedBatches },
      { Parameter: 'Facility Capacity Status', Value: feas.availableCapacityStatus },
      { Parameter: 'Internal Manufacturing Lead Time', Value: `${feas.manufacturingLeadTimeDays} Hours/Days` },
      { Parameter: 'Total Customer Lead Time', Value: `${feas.customerLeadTimeDays} Days from PO` },
      { Parameter: 'Timeline Feasibility', Value: feas.timelineFeasibility },
      { Parameter: 'Development Required', Value: feas.developmentRequired ? 'YES' : 'NO' },
      { Parameter: 'Technology Transfer Required', Value: feas.techTransferRequired ? 'YES (60-Day Method Transfer Protocol)' : 'NO' },
      { Parameter: 'Site Regulatory Approval Status', Value: feas.regulatoryApprovalStatus },
      { Parameter: 'Identified Feasibility Gaps', Value: feas.unresolvedGaps.join('; ') || 'None' },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet3Data), 'Manufacturing_Feasibility');

    // =========================================================================
    // SHEET 4: COMMERCIAL ECONOMICS & UNIT COSTING
    // =========================================================================
    const sheet4Data = [
      { Metric: 'Order Quantity', Value: opp.quantity },
      { Metric: 'Proposed Unit Selling Price', Value: `${opp.currency} ${econ.unitSellingPrice}` },
      { Metric: 'Total Evaluated Revenue', Value: `${opp.currency} ${econ.totalEvaluatedRevenue.toLocaleString()}` },
      { Metric: 'Total Direct & Indirect Cost', Value: `${opp.currency} ${econ.totalCost.toLocaleString()}` },
      { Metric: 'Calculated Unit Cost', Value: `${opp.currency} ${econ.unitCost}` },
      { Metric: 'Gross Profit Per Unit', Value: `${opp.currency} ${econ.grossProfitPerUnit}` },
      { Metric: 'Gross Profit Margin %', Value: `${econ.grossMarginPct}%` },
      { Metric: 'Customer Target Price', Value: opp.customerTargetPrice ? `${opp.currency} ${opp.customerTargetPrice}` : 'N/A' },
      { Metric: 'Target Price Variance (Gap)', Value: econ.targetPriceGap !== null ? `${opp.currency} ${econ.targetPriceGap}` : 'N/A' },
      { Metric: 'Meets Profitability Hurdle (>15%)', Value: econ.meetsHurdle ? 'YES' : 'NO' },
      { Metric: 'Break-Even Production Units', Value: econ.breakEvenUnits ? econ.breakEvenUnits.toLocaleString() : 'N/A' },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet4Data), 'Commercial_Economics');

    // =========================================================================
    // SHEET 5: COMPETITOR CAPABILITY LANDSCAPE
    // =========================================================================
    const sheet5Data = bm.discoveredCompetitors.map(c => ({
      'Competitor Name': c.cdmo_name,
      Classification: c.classification,
      'Classification Reason': c.reason,
      'Headquarters Country': c.profile.headquarters_country,
      'Primary Facilities': c.profile.manufacturing_locations.map(l => `${l.site} (${l.country})`).join('; '),
      'Dosage Capabilities': c.profile.dosage_forms.join(', '),
      'Sterile Capable': c.profile.is_sterile_capable ? 'YES' : 'NO',
      'Non-Sterile Capable': c.profile.is_non_sterile_capable ? 'YES' : 'NO',
      'Batch Size Range': `${c.profile.batch_size_ranges.min} - ${c.profile.batch_size_ranges.max} ${c.profile.batch_size_ranges.unit}`,
      'Published Capacity': c.capacityStatus,
      'Published Pricing': c.pricingStatus,
      'Regulatory Authorizations': c.profile.regulatory_approvals.join(', '),
      'Source Reference': c.evidenceReference,
      'Last Verified Date': c.retrievalDate,
      'Data Freshness': c.dataFreshness,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet5Data), 'Competitor_Landscape');

    // =========================================================================
    // SHEET 6: 14-POINT COMPARISON MATRIX
    // =========================================================================
    const sheet6Data: any[] = [];
    for (const item of bm.comparisonMatrix) {
      for (const comp of item.competitorAssessments) {
        sheet6Data.push({
          'Comparison Dimension': item.categoryName,
          'Axxelent Value': item.axxelentAssessment.value,
          'Competitor Name': comp.cdmoName,
          'Competitor Value': comp.value,
          'Relative Position': comp.relativePosition,
          'Supporting Evidence': comp.supportingEvidence,
          'Evidence Date': comp.evidenceDate,
          'Confidence Status': comp.confidenceStatus,
          'Business Implication': item.businessImplication,
        });
      }
    }
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet6Data), 'Comparison_Matrix_14Point');

    // =========================================================================
    // SHEET 7: ADVANTAGES, PARITY & CAPABILITY GAPS
    // =========================================================================
    const sheet7Data = [
      ...bm.advantagesAndGaps.confirmedAxxelentAdvantages.map(a => ({ Category: 'CONFIRMED AXXELENT ADVANTAGE', Description: a })),
      ...bm.advantagesAndGaps.competitorDocumentedAdvantages.map(a => ({ Category: 'COMPETITOR DOCUMENTED ADVANTAGE', Description: a })),
      ...bm.advantagesAndGaps.comparableCapabilities.map(a => ({ Category: 'COMPARABLE / PARITY CAPABILITY', Description: a })),
      ...bm.advantagesAndGaps.axxelentUnresolvedGaps.map(a => ({ Category: 'AXXELENT UNRESOLVED GAP', Description: a })),
      ...bm.advantagesAndGaps.missingCompetitorInformation.map(a => ({ Category: 'UNDISCLOSED / MISSING COMPETITOR DATA', Description: a })),
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet7Data), 'Advantages_and_Gaps');

    // =========================================================================
    // SHEET 8: RISK REGISTER & SEVERITY MATRIX
    // =========================================================================
    const sheet8Data = bm.riskRegister.map(r => ({
      'Risk ID': r.id,
      Risk: r.risk,
      Category: r.category,
      Evidence: r.evidence,
      Likelihood: r.likelihood,
      Impact: r.impact,
      Severity: r.severity,
      Mitigation: r.mitigation,
      'Responsible Function': r.responsibleFunction,
      Status: r.status,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet8Data), 'Risk_Register');

    // =========================================================================
    // SHEET 9: SCENARIOS & SENSITIVITY
    // =========================================================================
    const scenarios = ev.scenarios || [];
    const sheet9Data = scenarios.map((s: any) => ({
      Scenario: s.scenario_name,
      Quantity: s.quantity,
      'Unit Price': s.unit_price,
      'Unit Cost': s.unit_cost,
      Revenue: s.calculated_revenue,
      'Total Cost': s.calculated_total_cost,
      'Gross Profit': s.calculated_gross_profit,
      'Gross Margin %': `${s.calculated_gross_margin_pct}%`,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet9Data.length > 0 ? sheet9Data : [{ Notice: 'Base case evaluation models applied' }]), 'Scenarios_and_Sensitivity');

    // =========================================================================
    // SHEET 10: STRATEGIC RECOMMENDATION & ACTION PLAN
    // =========================================================================
    const sheet10Data = bm.actionPlan.map(a => ({
      'Step #': a.stepNumber,
      Action: a.action,
      Department: a.department,
      'Target Completion (Days)': a.targetCompletionDays,
      'Required Approval': a.requiredApproval,
      Dependencies: a.dependencies,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet10Data), 'Recommendation_Action_Plan');

    // =========================================================================
    // SHEET 11: EVIDENCE REGISTER & SOURCE LINEAGE
    // =========================================================================
    const sheet11Data = bm.sourceRegister.map(s => ({
      'Source Title': s.title,
      Organization: s.organization,
      'Document Ref / URL': s.documentIdOrUrl,
      'Retrieval Date': s.retrievalDate,
      'Source Publication Date': s.sourceDate,
      'Verification Status': s.verificationStatus,
      'Claims Supported': s.claimsSupported,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet11Data), 'Evidence_and_Sources');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `${ev.evaluation_number || 'CE'}_CDMO_Decision_Intelligence_Report.xlsx`;

    return { buffer, fileName };
  }
}
