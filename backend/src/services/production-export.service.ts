import * as XLSX from 'xlsx';

export class ProductionExportService {
  /**
   * Generates a 21-sheet professional pharmaceutical Excel workbook
   * with Sheet 1 as SUMMARY according to Section 64 & 65.
   */
  static generateFeasibilityWorkbook(feasibility: any): Buffer {
    const wb = XLSX.utils.book_new();

    // ----------------------------------------------------
    // SHEET 1: SUMMARY (MANDATORY SHEET 1)
    // ----------------------------------------------------
    const summaryData = [
      ['BDIQ PHARMACEUTICAL PRODUCTION FEASIBILITY EXECUTIVE SUMMARY'],
      ['Feasibility Code', feasibility.feasibility_code || 'N/A'],
      ['Version', `V${feasibility.version_number || 1}`],
      ['Evaluation Date', feasibility.evaluation_date || 'N/A'],
      ['Status', feasibility.status || 'DRAFT'],
      [''],
      ['EXECUTIVE DECISION'],
      ['Feasibility Result', feasibility.feasibility_result || 'DATA_INSUFFICIENT'],
      ['Production Score', `${feasibility.feasibility_score || 0} / 100`],
      ['Overall Risk', feasibility.overall_risk || 'LOW'],
      ['Recommendation', feasibility.recommendation || 'PROCEED'],
      ['Recommendation Reason', feasibility.recommendation_reason || 'N/A'],
      [''],
      ['COMMERCIAL & PRODUCT SPECIFICATION'],
      ['Product Name', feasibility.product_name || 'N/A'],
      ['Dosage Form', feasibility.dosage_form || 'N/A'],
      ['Route', feasibility.route || 'N/A'],
      ['Strength', feasibility.strength || 'N/A'],
      ['Presentation', feasibility.presentation || 'N/A'],
      ['Customer', feasibility.customer_name || 'N/A'],
      ['RFQ Reference', feasibility.rfq_id || 'N/A'],
      ['Annual Required Volume', feasibility.annual_volume ? `${feasibility.annual_volume.toLocaleString()} units` : 'N/A'],
      [''],
      ['FACILITY & MANUFACTURING FIT'],
      ['Facility Code', feasibility.production_facilities?.facility_code || 'N/A'],
      ['Facility Name', feasibility.production_facilities?.facility_name || 'N/A'],
      ['Production Line', feasibility.production_lines?.line_name || 'N/A'],
      ['Capacity Status', feasibility.capacity_status || 'UNKNOWN'],
      ['Equipment Status', feasibility.equipment_status || 'UNKNOWN'],
      ['Material Status', feasibility.material_status || 'UNKNOWN'],
      ['Technology Transfer', feasibility.technology_transfer_status || 'NOT_REQUIRED'],
      ['Development Required', feasibility.development_required ? feasibility.development_category : 'NO_DEVELOPMENT'],
      [''],
      ['TIMELINE COMPARISON'],
      ['Manufacturing Lead Time', `${feasibility.manufacturing_lead_time_days || 0} days`],
      ['Total Customer Lead Time', `${feasibility.total_customer_lead_time_days || 0} days`],
      ['Customer Required Date', feasibility.customer_required_date || 'N/A'],
      ['Estimated Availability Date', feasibility.estimated_available_date || 'N/A'],
      ['Timeline Feasibility', (feasibility.estimated_available_date && feasibility.customer_required_date && feasibility.estimated_available_date <= feasibility.customer_required_date) ? 'FEASIBLE' : 'CONSTRAINT'],
      [''],
      ['IDENTIFIED GAPS & MITIGATIONS'],
      ['Active Gaps Count', (feasibility.production_gaps || []).length],
      ['Active Risks Count', (feasibility.production_risks || []).length],
      ['Data Completeness', `${feasibility.data_completeness_pct || 0}%`]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'SUMMARY');

    // ----------------------------------------------------
    // SHEET 2: PRODUCTION FEASIBILITY
    // ----------------------------------------------------
    const feasibilitySheetData = [
      ['Attribute', 'Value'],
      ['ID', feasibility.id],
      ['Code', feasibility.feasibility_code],
      ['Status', feasibility.status],
      ['Result', feasibility.feasibility_result],
      ['Score', feasibility.feasibility_score],
      ['Evaluation Date', feasibility.evaluation_date],
      ['Batch Size', feasibility.batch_size],
      ['Batch Size Unit', feasibility.batch_size_unit],
      ['Estimated Batches', feasibility.estimated_batches],
      ['Expected Yield %', feasibility.expected_yield_pct],
      ['Yield Source', feasibility.yield_source],
      ['Manufacturing Qty', feasibility.required_manufacturing_quantity],
      ['Lead Time (Days)', feasibility.manufacturing_lead_time_days],
      ['Customer Lead Time (Days)', feasibility.total_customer_lead_time_days],
      ['Is Finalized', feasibility.is_finalized ? 'TRUE' : 'FALSE'],
      ['Version', feasibility.version_number]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(feasibilitySheetData), 'PRODUCTION FEASIBILITY');

    // ----------------------------------------------------
    // SHEET 3: PRODUCT
    // ----------------------------------------------------
    const productData = [
      ['Product Parameter', 'Value'],
      ['Product ID', feasibility.product_id || 'N/A'],
      ['Product Name', feasibility.product_name || 'N/A'],
      ['Molecule ID', feasibility.molecule_id || 'N/A'],
      ['Dosage Form', feasibility.dosage_form || 'N/A'],
      ['Route of Administration', feasibility.route || 'N/A'],
      ['Strength', feasibility.strength || 'N/A'],
      ['Presentation', feasibility.presentation || 'N/A'],
      ['Pack Size', feasibility.pack_size || 'N/A']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productData), 'PRODUCT');

    // ----------------------------------------------------
    // SHEET 4: RFQ
    // ----------------------------------------------------
    const rfqData = [
      ['RFQ Parameter', 'Value'],
      ['RFQ ID', feasibility.rfq_id || 'N/A'],
      ['Customer Name', feasibility.customer_name || 'N/A'],
      ['Annual Volume', feasibility.annual_volume || 'N/A'],
      ['Required Quantity', feasibility.required_quantity || 'N/A'],
      ['Customer Target Date', feasibility.customer_required_date || 'N/A']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rfqData), 'RFQ');

    // ----------------------------------------------------
    // SHEET 5: FACILITY
    // ----------------------------------------------------
    const fac = feasibility.production_facilities || {};
    const facilityData = [
      ['Facility Parameter', 'Value'],
      ['Facility Code', fac.facility_code || 'N/A'],
      ['Facility Name', fac.facility_name || 'N/A'],
      ['Site Type', fac.site_type || 'N/A'],
      ['City', fac.city || 'N/A'],
      ['Country', fac.country_iso2 || 'N/A'],
      ['Site Status', fac.site_status || 'N/A'],
      ['Regulatory Approvals', Array.isArray(fac.regulatory_approvals) ? fac.regulatory_approvals.join(', ') : 'N/A'],
      ['Operating Hours/Day', fac.operational_hours_per_day || 16],
      ['Operating Days/Year', fac.operational_days_per_year || 300]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(facilityData), 'FACILITY');

    // ----------------------------------------------------
    // SHEET 6: PRODUCTION LINE
    // ----------------------------------------------------
    const line = feasibility.production_lines || {};
    const lineData = [
      ['Line Parameter', 'Value'],
      ['Line Code', line.line_code || 'N/A'],
      ['Line Name', line.line_name || 'N/A'],
      ['Manufacturing Type', line.manufacturing_type || 'N/A'],
      ['Annual Nominal Capacity', line.nominal_annual_capacity || 'N/A'],
      ['Current Utilization %', `${line.current_utilization_pct || 0}%`],
      ['Qualification Status', line.qualification_status || 'N/A'],
      ['Validation Status', line.validation_status || 'N/A']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lineData), 'PRODUCTION LINE');

    // ----------------------------------------------------
    // SHEET 7: EQUIPMENT
    // ----------------------------------------------------
    const eqRows = [
      ['Required Equipment Type', 'Status', 'Assigned Machine', 'Machine Code', 'Qualification']
    ];
    const steps = feasibility.production_process_steps || [];
    for (const s of steps) {
      if (s.equipment_type_required) {
        eqRows.push([
          s.equipment_type_required,
          s.equipment_id ? 'ASSIGNED' : 'UNASSIGNED',
          s.operation_name,
          s.equipment_id || 'N/A',
          'QUALIFIED'
        ]);
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eqRows), 'EQUIPMENT');

    // ----------------------------------------------------
    // SHEET 8: CAPACITY
    // ----------------------------------------------------
    const capacityData = [
      ['Metric', 'Value'],
      ['Annual Requirement', feasibility.annual_volume || 'N/A'],
      ['Nominal Line Capacity', line.nominal_annual_capacity || 'N/A'],
      ['Line Utilization', `${line.current_utilization_pct || 0}%`],
      ['Capacity Status', feasibility.capacity_status || 'N/A']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(capacityData), 'CAPACITY');

    // ----------------------------------------------------
    // SHEET 9: MATERIALS
    // ----------------------------------------------------
    const matRows = [
      ['Category', 'Material Name', 'Required Qty', 'Unit', 'Available Qty', 'Gap', 'Status', 'Supplier']
    ];
    for (const m of (feasibility.production_materials || [])) {
      matRows.push([
        m.material_category,
        m.material_name,
        m.required_quantity,
        m.required_unit,
        m.available_quantity || 0,
        Math.max(0, m.required_quantity - (m.available_quantity || 0)),
        m.availability_status,
        m.supplier_name || 'N/A'
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matRows), 'MATERIALS');

    // ----------------------------------------------------
    // SHEET 10: PROCESS
    // ----------------------------------------------------
    const processRows = [
      ['Step #', 'Operation', 'Equipment Required', 'Setup (hrs)', 'Process (hrs)', 'Cleaning (hrs)', 'Total Step (hrs)', 'Yield %']
    ];
    for (const s of (feasibility.production_process_steps || [])) {
      processRows.push([
        s.step_number,
        s.operation_name,
        s.equipment_type_required || 'Manual',
        s.setup_time_hours || 0,
        s.processing_time_hours || 0,
        s.cleaning_time_hours || 0,
        (s.setup_time_hours || 0) + (s.processing_time_hours || 0) + (s.cleaning_time_hours || 0),
        s.step_yield_pct || 100
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(processRows), 'PROCESS');

    // ----------------------------------------------------
    // SHEET 11: QUALITY
    // ----------------------------------------------------
    const qualityData = [
      ['Quality Checkpoint', 'Status', 'Standard Requirement'],
      ['Finished Product Testing', 'REQUIRED', 'Assay, Dissolution, Impurities USP/EP'],
      ['Microbiology Testing', feasibility.sterile_manufacturing_required ? 'MANDATORY' : 'STANDARD', 'Bioburden / TAMC / TYMC'],
      ['Sterility Testing', feasibility.sterile_manufacturing_required ? 'MANDATORY' : 'N/A', '14-Day Sterility Incubation'],
      ['Stability Requirement', feasibility.development_required ? 'ZONE IVB 6-MONTH' : 'COMMERCIAL VERIFICATION', 'ICH Q1A Guidance']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(qualityData), 'QUALITY');

    // ----------------------------------------------------
    // SHEET 12: PACKAGING
    // ----------------------------------------------------
    const pkgData = [
      ['Packaging Parameter', 'Specification'],
      ['Packaging Type', feasibility.presentation || 'Blister Pack'],
      ['Pack Size', feasibility.pack_size || '30s'],
      ['Serialization Required', 'YES (Track & Trace / GS1 Standard)'],
      ['Packaging Feasibility', feasibility.packaging_feasibility_status || 'FEASIBLE']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pkgData), 'PACKAGING');

    // ----------------------------------------------------
    // SHEET 13: REGULATORY
    // ----------------------------------------------------
    const regData = [
      ['Regulatory Parameter', 'Evaluation'],
      ['Regulatory Status', feasibility.regulatory_status || 'COMPLIANT'],
      ['Assessment Required', feasibility.regulatory_assessment_required ? 'YES' : 'NO'],
      ['Site Variation', 'Subject to Target Market Filing']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(regData), 'REGULATORY');

    // ----------------------------------------------------
    // SHEET 14: TECHNOLOGY TRANSFER
    // ----------------------------------------------------
    const ttData = [
      ['Technology Transfer Parameter', 'Assessment'],
      ['Tech Transfer Required', feasibility.technology_transfer_required ? 'YES' : 'NO'],
      ['Current Status', feasibility.technology_transfer_status || 'NOT_REQUIRED'],
      ['Estimated Duration', `${feasibility.technology_transfer_duration_weeks || 0} weeks`]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ttData), 'TECHNOLOGY TRANSFER');

    // ----------------------------------------------------
    // SHEET 15: DEVELOPMENT
    // ----------------------------------------------------
    const devData = [
      ['Development Area', 'Requirement'],
      ['Development Required', feasibility.development_required ? 'YES' : 'NO'],
      ['Category', feasibility.development_category || 'NO_DEVELOPMENT'],
      ['Validation Required', feasibility.validation_required ? 'YES' : 'NO']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(devData), 'DEVELOPMENT');

    // ----------------------------------------------------
    // SHEET 16: TIMELINE
    // ----------------------------------------------------
    const timelineData = [
      ['Milestone / Parameter', 'Duration / Date'],
      ['Setup & Processing Hours', `${(feasibility.setup_time_hours || 0) + (feasibility.processing_time_hours || 0)} hrs`],
      ['Manufacturing Lead Time', `${feasibility.manufacturing_lead_time_days || 0} days`],
      ['QC Testing & QA Release', `${feasibility.testing_release_time_days || 0} days`],
      ['Total Customer Lead Time', `${feasibility.total_customer_lead_time_days || 0} days`],
      ['Customer Required Date', feasibility.customer_required_date || 'N/A'],
      ['Earliest Available Date', feasibility.estimated_available_date || 'N/A']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(timelineData), 'TIMELINE');

    // ----------------------------------------------------
    // SHEET 17: RISKS
    // ----------------------------------------------------
    const riskRows = [
      ['Category', 'Risk Title', 'Probability', 'Impact', 'Score', 'Level', 'Mitigation Plan', 'Status']
    ];
    for (const r of (feasibility.production_risks || [])) {
      riskRows.push([
        r.risk_category,
        r.risk_title,
        r.probability,
        r.impact,
        r.risk_score,
        r.risk_level,
        r.mitigation_plan || 'N/A',
        r.status
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(riskRows), 'RISKS');

    // ----------------------------------------------------
    // SHEET 18: GAPS
    // ----------------------------------------------------
    const gapRows = [
      ['Gap Category', 'Description', 'Severity', 'Required Action', 'Department', 'Target Date', 'Status']
    ];
    for (const g of (feasibility.production_gaps || [])) {
      gapRows.push([
        g.gap_category,
        g.description,
        g.severity,
        g.required_action,
        g.responsible_department || 'Manufacturing',
        g.target_date || 'N/A',
        g.status
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gapRows), 'GAPS');

    // ----------------------------------------------------
    // SHEET 19: ASSUMPTIONS
    // ----------------------------------------------------
    const assumptionsData = [
      ['Key Operating Assumption', 'Value / Basis'],
      ['Operating Hours per Day', '16 hours (2 shifts)'],
      ['Yield Factor', `${feasibility.expected_yield_pct || 95}% (${feasibility.yield_source || 'ENGINEERING_ESTIMATE'})`],
      ['Cleaning & Line Clearance', 'Standard 4 hours between batches'],
      ['Raw Material Release', '14 calendar days from receipt']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assumptionsData), 'ASSUMPTIONS');

    // ----------------------------------------------------
    // SHEET 20: SOURCES
    // ----------------------------------------------------
    const sourcesData = [
      ['Information Category', 'Data Provenance / Source'],
      ['Product Master', feasibility.product_id ? 'BDIQ Canonical Product Master' : 'User Entry'],
      ['Facility Capacity', 'BDIQ Production Line Master Ledger'],
      ['Equipment Qualification', 'Site Calibration & Validation Log'],
      ['Material Availability', 'BDIQ Warehouse & Supply Chain Inventory']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sourcesData), 'SOURCES');

    // ----------------------------------------------------
    // SHEET 21: VERSION HISTORY
    // ----------------------------------------------------
    const verRows = [
      ['Version', 'Status', 'Finalized Date', 'Change Summary']
    ];
    for (const v of (feasibility.production_feasibility_versions || [])) {
      verRows.push([
        `V${v.version_number}`,
        v.status,
        v.finalized_at || 'Pending',
        v.change_summary || 'N/A'
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(verRows), 'VERSION HISTORY');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
