import * as XLSX from 'xlsx';
import { SupabaseClient } from '@supabase/supabase-js';

export interface ExtractedFacility {
  facility_code: string;
  facility_name: string;
  site_type?: string;
  building_block?: string;
  address?: string;
  city?: string;
  state?: string;
  country_iso2?: string;
  operational_hours_per_day?: number;
  operational_days_per_year?: number;
  regulatory_approvals?: string[];
  contact_person?: string;
  contact_email?: string;
}

export interface ExtractedLine {
  facility_code: string;
  line_code: string;
  line_name: string;
  manufacturing_type: string;
  applicable_dosage_forms?: string[];
  batch_size_min?: number;
  batch_size_max?: number;
  batch_size_unit?: string;
  nominal_hourly_capacity?: number;
  nominal_annual_capacity?: number;
  operating_hours_per_day?: number;
  working_days_per_year?: number;
  qualification_status?: string;
}

export interface ExtractedEquipment {
  facility_code: string;
  line_code?: string;
  equipment_code: string;
  equipment_name: string;
  equipment_type: string;
  manufacturer?: string;
  model?: string;
  capacity_min?: number;
  capacity_max?: number;
  capacity_nominal?: number;
  capacity_unit?: string;
  qualification_status?: string;
  calibration_status?: string;
}

export interface ImportPreviewResult {
  sessionId: string;
  fileName: string;
  totalFacilities: number;
  totalLines: number;
  totalEquipment: number;
  facilities: ExtractedFacility[];
  lines: ExtractedLine[];
  equipment: ExtractedEquipment[];
  errors: Array<{ sheet: string; row: number; field: string; message: string }>;
  warnings: Array<{ sheet: string; row: number; field: string; message: string }>;
  status: 'PREVIEW' | 'VALIDATED';
}

export class FacilityImportService {
  constructor(
    private supabase: SupabaseClient,
    private organizationId: string,
    private userId?: string
  ) {}

  /**
   * Generates a standard multi-sheet XLSX template for CDMO facilities.
   */
  public static generateTemplateWorkbook(): Buffer {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Facilities
    const facilitiesData = [
      {
        'Facility Code': 'FAC-001',
        'Facility Name': 'Main Oral Solid Dosage Plant',
        'Site Type': 'COMMERCIAL',
        'City': 'Hyderabad',
        'State': 'Telangana',
        'Country ISO2': 'IN',
        'Operating Hours/Day': 16,
        'Operating Days/Year': 300,
        'Regulatory Approvals (Comma-separated)': 'USFDA, MHRA, EMA, WHO_GMP',
        'Contact Person': 'Dr. Rajesh Sharma',
        'Contact Email': 'r.sharma@cdmoplant.com',
      },
      {
        'Facility Code': 'FAC-002',
        'Facility Name': 'Sterile Injectables & Lyophilization Site',
        'Site Type': 'COMMERCIAL',
        'City': 'Bengaluru',
        'State': 'Karnataka',
        'Country ISO2': 'IN',
        'Operating Hours/Day': 20,
        'Operating Days/Year': 310,
        'Regulatory Approvals (Comma-separated)': 'USFDA, ANVISA, PMDA',
        'Contact Person': 'Anita Desai',
        'Contact Email': 'a.desai@cdmoplant.com',
      },
    ];
    const wsFacilities = XLSX.utils.json_to_sheet(facilitiesData);
    XLSX.utils.book_append_sheet(wb, wsFacilities, 'Facilities');

    // Sheet 2: Production Lines
    const linesData = [
      {
        'Facility Code': 'FAC-001',
        'Line Code': 'LINE-TAB-01',
        'Line Name': 'High-Speed Tablet Compression Line 1',
        'Manufacturing Type': 'ORAL_SOLID_DOSAGE',
        'Dosage Forms (Comma-separated)': 'TABLET, COATED_TABLET',
        'Min Batch Size': 50000,
        'Max Batch Size': 1000000,
        'Batch Size Unit': 'TABLETS',
        'Nominal Hourly Capacity': 120000,
        'Nominal Annual Capacity': 80000000,
        'Operating Hours/Day': 16,
        'Working Days/Year': 300,
        'Qualification Status': 'QUALIFIED',
      },
      {
        'Facility Code': 'FAC-001',
        'Line Code': 'LINE-CAP-01',
        'Line Name': 'Automatic Capsule Filling Line 1',
        'Manufacturing Type': 'ORAL_SOLID_DOSAGE',
        'Dosage Forms (Comma-separated)': 'HARD_GELATIN_CAPSULE',
        'Min Batch Size': 30000,
        'Max Batch Size': 500000,
        'Batch Size Unit': 'CAPSULES',
        'Nominal Hourly Capacity': 60000,
        'Nominal Annual Capacity': 40000000,
        'Operating Hours/Day': 16,
        'Working Days/Year': 300,
        'Qualification Status': 'QUALIFIED',
      },
      {
        'Facility Code': 'FAC-002',
        'Line Code': 'LINE-INJ-01',
        'Line Name': 'Sterile Vial Aseptic Filling & Capping Line',
        'Manufacturing Type': 'STERILE_INJECTABLE',
        'Dosage Forms (Comma-separated)': 'VIAL, LYOPHILIZED_VIAL',
        'Min Batch Size': 10000,
        'Max Batch Size': 150000,
        'Batch Size Unit': 'VIALS',
        'Nominal Hourly Capacity': 15000,
        'Nominal Annual Capacity': 12000000,
        'Operating Hours/Day': 20,
        'Working Days/Year': 310,
        'Qualification Status': 'QUALIFIED',
      },
    ];
    const wsLines = XLSX.utils.json_to_sheet(linesData);
    XLSX.utils.book_append_sheet(wb, wsLines, 'Production Lines');

    // Sheet 3: Equipment
    const equipmentData = [
      {
        'Facility Code': 'FAC-001',
        'Line Code': 'LINE-TAB-01',
        'Equipment Code': 'EQP-CMP-01',
        'Equipment Name': 'Fette 3090 Double Rotary Press',
        'Equipment Type': 'Compression Machine',
        'Manufacturer': 'Fette Compacting',
        'Min Capacity': 30000,
        'Max Capacity': 250000,
        'Nominal Capacity': 150000,
        'Capacity Unit': 'tabs/hr',
        'Qualification Status': 'QUALIFIED',
        'Calibration Status': 'CALIBRATED',
      },
      {
        'Facility Code': 'FAC-001',
        'Line Code': 'LINE-TAB-01',
        'Equipment Code': 'EQP-COT-01',
        'Equipment Name': 'Glatt Pan Coater 48 inch',
        'Equipment Type': 'Coating Machine',
        'Manufacturer': 'Glatt Air Techniques',
        'Min Capacity': 100,
        'Max Capacity': 350,
        'Nominal Capacity': 250,
        'Capacity Unit': 'kg/batch',
        'Qualification Status': 'QUALIFIED',
        'Calibration Status': 'CALIBRATED',
      },
      {
        'Facility Code': 'FAC-002',
        'Line Code': 'LINE-INJ-01',
        'Equipment Code': 'EQP-FIL-01',
        'Equipment Name': 'Bosch Aseptic Vial Filler',
        'Equipment Type': 'Filling Machine',
        'Manufacturer': 'Syntegon (Bosch)',
        'Min Capacity': 5000,
        'Max Capacity': 20000,
        'Nominal Capacity': 15000,
        'Capacity Unit': 'vials/hr',
        'Qualification Status': 'QUALIFIED',
        'Calibration Status': 'CALIBRATED',
      },
    ];
    const wsEquipment = XLSX.utils.json_to_sheet(equipmentData);
    XLSX.utils.book_append_sheet(wb, wsEquipment, 'Equipment');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Parses an uploaded file buffer (XLSX, XLS, or CSV) and produces a validated preview.
   */
  async parseAndPreview(fileBuffer: Buffer, fileName: string): Promise<ImportPreviewResult> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    const facilities: ExtractedFacility[] = [];
    const lines: ExtractedLine[] = [];
    const equipment: ExtractedEquipment[] = [];
    const errors: ImportPreviewResult['errors'] = [];
    const warnings: ImportPreviewResult['warnings'] = [];

    // 1. Parse Facilities Sheet
    const facSheetName = sheetNames.find(s => /facilit/i.test(s)) || sheetNames[0];
    if (facSheetName && workbook.Sheets[facSheetName]) {
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[facSheetName], { defval: '' });
      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const code = String(row['Facility Code'] || row['facility_code'] || row['Code'] || '').trim();
        const name = String(row['Facility Name'] || row['facility_name'] || row['Name'] || '').trim();

        if (!code || !name) {
          if (code || name) {
            errors.push({
              sheet: facSheetName,
              row: rowNum,
              field: !code ? 'Facility Code' : 'Facility Name',
              message: 'Both Facility Code and Facility Name are required.',
            });
          }
          return;
        }

        const approvalsRaw = row['Regulatory Approvals (Comma-separated)'] || row['regulatory_approvals'] || '';
        const approvals = typeof approvalsRaw === 'string'
          ? approvalsRaw.split(',').map(s => s.trim()).filter(Boolean)
          : Array.isArray(approvalsRaw) ? approvalsRaw : [];

        facilities.push({
          facility_code: code,
          facility_name: name,
          site_type: (row['Site Type'] || row['site_type'] || 'COMMERCIAL').toString().toUpperCase(),
          city: String(row['City'] || row['city'] || ''),
          state: String(row['State'] || row['state'] || ''),
          country_iso2: String(row['Country ISO2'] || row['country_iso2'] || 'IN').toUpperCase(),
          operational_hours_per_day: Number(row['Operating Hours/Day'] || row['operational_hours_per_day']) || 16,
          operational_days_per_year: Number(row['Operating Days/Year'] || row['operational_days_per_year']) || 300,
          regulatory_approvals: approvals,
          contact_person: String(row['Contact Person'] || row['contact_person'] || ''),
          contact_email: String(row['Contact Email'] || row['contact_email'] || ''),
        });
      });
    }

    // 2. Parse Lines Sheet
    const lineSheetName = sheetNames.find(s => /line/i.test(s)) || (sheetNames.length > 1 ? sheetNames[1] : null);
    if (lineSheetName && workbook.Sheets[lineSheetName]) {
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[lineSheetName], { defval: '' });
      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const facCode = String(row['Facility Code'] || row['facility_code'] || '').trim();
        const lineCode = String(row['Line Code'] || row['line_code'] || '').trim();
        const lineName = String(row['Line Name'] || row['line_name'] || '').trim();
        const mfgType = String(row['Manufacturing Type'] || row['manufacturing_type'] || 'ORAL_SOLID_DOSAGE').trim();

        if (!lineCode || !lineName) {
          if (lineCode || lineName) {
            errors.push({
              sheet: lineSheetName,
              row: rowNum,
              field: !lineCode ? 'Line Code' : 'Line Name',
              message: 'Line Code and Line Name are required.',
            });
          }
          return;
        }

        const minBatch = Number(row['Min Batch Size'] || row['batch_size_min']) || 10000;
        const maxBatch = Number(row['Max Batch Size'] || row['batch_size_max']) || 1000000;
        if (minBatch > maxBatch) {
          errors.push({
            sheet: lineSheetName,
            row: rowNum,
            field: 'Min Batch Size',
            message: `Min batch size (${minBatch}) cannot exceed max batch size (${maxBatch}).`,
          });
        }

        const dosageFormsRaw = row['Dosage Forms (Comma-separated)'] || row['applicable_dosage_forms'] || '';
        const dosageForms = typeof dosageFormsRaw === 'string'
          ? dosageFormsRaw.split(',').map(s => s.trim()).filter(Boolean)
          : Array.isArray(dosageFormsRaw) ? dosageFormsRaw : ['TABLET'];

        lines.push({
          facility_code: facCode || (facilities[0]?.facility_code || 'FAC-001'),
          line_code: lineCode,
          line_name: lineName,
          manufacturing_type: mfgType,
          applicable_dosage_forms: dosageForms,
          batch_size_min: minBatch,
          batch_size_max: maxBatch,
          batch_size_unit: String(row['Batch Size Unit'] || row['batch_size_unit'] || 'UNITS'),
          nominal_hourly_capacity: Number(row['Nominal Hourly Capacity'] || row['nominal_hourly_capacity']) || 50000,
          nominal_annual_capacity: Number(row['Nominal Annual Capacity'] || row['nominal_annual_capacity']) || 50000000,
          operating_hours_per_day: Number(row['Operating Hours/Day'] || row['operating_hours_per_day']) || 16,
          working_days_per_year: Number(row['Working Days/Year'] || row['working_days_per_year']) || 300,
          qualification_status: String(row['Qualification Status'] || row['qualification_status'] || 'QUALIFIED'),
        });
      });
    }

    // 3. Parse Equipment Sheet
    const eqSheetName = sheetNames.find(s => /equip/i.test(s)) || (sheetNames.length > 2 ? sheetNames[2] : null);
    if (eqSheetName && workbook.Sheets[eqSheetName]) {
      const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[eqSheetName], { defval: '' });
      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const facCode = String(row['Facility Code'] || row['facility_code'] || '').trim();
        const lineCode = String(row['Line Code'] || row['line_code'] || '').trim();
        const eqCode = String(row['Equipment Code'] || row['equipment_code'] || '').trim();
        const eqName = String(row['Equipment Name'] || row['equipment_name'] || '').trim();
        const eqType = String(row['Equipment Type'] || row['equipment_type'] || 'Processing Equipment').trim();

        if (!eqCode || !eqName) {
          if (eqCode || eqName) {
            errors.push({
              sheet: eqSheetName,
              row: rowNum,
              field: !eqCode ? 'Equipment Code' : 'Equipment Name',
              message: 'Equipment Code and Equipment Name are required.',
            });
          }
          return;
        }

        equipment.push({
          facility_code: facCode || (facilities[0]?.facility_code || 'FAC-001'),
          line_code: lineCode || (lines[0]?.line_code || undefined),
          equipment_code: eqCode,
          equipment_name: eqName,
          equipment_type: eqType,
          manufacturer: String(row['Manufacturer'] || row['manufacturer'] || ''),
          capacity_min: Number(row['Min Capacity'] || row['capacity_min']) || undefined,
          capacity_max: Number(row['Max Capacity'] || row['capacity_max']) || undefined,
          capacity_nominal: Number(row['Nominal Capacity'] || row['capacity_nominal']) || undefined,
          capacity_unit: String(row['Capacity Unit'] || row['capacity_unit'] || 'units/hr'),
          qualification_status: String(row['Qualification Status'] || row['qualification_status'] || 'QUALIFIED'),
          calibration_status: String(row['Calibration Status'] || row['calibration_status'] || 'CALIBRATED'),
        });
      });
    }

    // Save session in database
    const { data: session, error } = await this.supabase
      .from('facility_import_sessions')
      .insert({
        organization_id: this.organizationId,
        file_name: fileName,
        file_format: 'XLSX',
        file_size_bytes: fileBuffer.length,
        total_facilities_extracted: facilities.length,
        total_lines_extracted: lines.length,
        total_equipment_extracted: equipment.length,
        status: errors.length === 0 ? 'VALIDATED' : 'PREVIEW',
        extracted_data: { facilities, lines, equipment },
        validation_errors: errors,
        verification_status: 'PENDING',
        imported_by: this.userId || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to persist import session:', error);
    }

    return {
      sessionId: session?.id || 'local-preview',
      fileName,
      totalFacilities: facilities.length,
      totalLines: lines.length,
      totalEquipment: equipment.length,
      facilities,
      lines,
      equipment,
      errors,
      warnings,
      status: errors.length === 0 ? 'VALIDATED' : 'PREVIEW',
    };
  }

  /**
   * Commits the reviewed and validated data from an import session into master tables.
   */
  async commitImport(sessionId: string): Promise<{
    committedFacilities: number;
    committedLines: number;
    committedEquipment: number;
  }> {
    const { data: session, error } = await this.supabase
      .from('facility_import_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('organization_id', this.organizationId)
      .single();

    if (error || !session) {
      throw new Error('Import session not found or unauthorized');
    }

    const { facilities = [], lines = [], equipment = [] } = session.extracted_data || {};
    const facilityCodeToIdMap = new Map<string, string>();
    const lineCodeToIdMap = new Map<string, string>();

    // 1. Upsert Facilities
    let committedFacilities = 0;
    for (const fac of facilities) {
      const payload: any = {
        organization_id: this.organizationId,
        facility_code: fac.facility_code,
        facility_name: fac.facility_name,
        site_type: fac.site_type || 'COMMERCIAL',
        city: fac.city || null,
        state: fac.state || null,
        country_iso2: fac.country_iso2 || 'IN',
        operational_hours_per_day: fac.operational_hours_per_day || 16,
        operational_days_per_year: fac.operational_days_per_year || 300,
        regulatory_approvals: fac.regulatory_approvals || [],
        contact_person: fac.contact_person || null,
        contact_email: fac.contact_email || null,
        updated_at: new Date().toISOString(),
      };

      const { data: upsertedFac, error: facErr } = await this.supabase
        .from('production_facilities')
        .upsert(payload, { onConflict: 'organization_id, facility_code' })
        .select('id, facility_code')
        .single();

      if (!facErr && upsertedFac) {
        facilityCodeToIdMap.set(upsertedFac.facility_code, upsertedFac.id);
        committedFacilities++;
      }
    }

    // 2. Upsert Lines
    let committedLines = 0;
    for (const line of lines) {
      let facId = facilityCodeToIdMap.get(line.facility_code);
      if (!facId) {
        // Query facility ID from DB if not in map
        const { data: fRec } = await this.supabase
          .from('production_facilities')
          .select('id')
          .eq('organization_id', this.organizationId)
          .eq('facility_code', line.facility_code)
          .maybeSingle();
        if (fRec) facId = fRec.id;
      }

      if (facId) {
        const payload: any = {
          organization_id: this.organizationId,
          facility_id: facId,
          line_code: line.line_code,
          line_name: line.line_name,
          manufacturing_type: line.manufacturing_type,
          applicable_dosage_forms: line.applicable_dosage_forms || [],
          batch_size_min: line.batch_size_min,
          batch_size_max: line.batch_size_max,
          batch_size_unit: line.batch_size_unit || 'UNITS',
          nominal_hourly_capacity: line.nominal_hourly_capacity || 50000,
          nominal_annual_capacity: line.nominal_annual_capacity || 50000000,
          operating_hours_per_day: line.operating_hours_per_day || 16,
          working_days_per_year: line.working_days_per_year || 300,
          qualification_status: line.qualification_status || 'QUALIFIED',
          updated_at: new Date().toISOString(),
        };

        const { data: upsertedLine, error: lineErr } = await this.supabase
          .from('production_lines')
          .upsert(payload, { onConflict: 'organization_id, facility_id, line_code' })
          .select('id, line_code')
          .single();

        if (!lineErr && upsertedLine) {
          lineCodeToIdMap.set(upsertedLine.line_code, upsertedLine.id);
          committedLines++;
        }
      }
    }

    // 3. Upsert Equipment
    let committedEquipment = 0;
    for (const eq of equipment) {
      let facId = facilityCodeToIdMap.get(eq.facility_code);
      if (!facId) {
        const { data: fRec } = await this.supabase
          .from('production_facilities')
          .select('id')
          .eq('organization_id', this.organizationId)
          .eq('facility_code', eq.facility_code)
          .maybeSingle();
        if (fRec) facId = fRec.id;
      }

      if (facId) {
        const lineId = eq.line_code ? lineCodeToIdMap.get(eq.line_code) || null : null;
        const payload: any = {
          organization_id: this.organizationId,
          facility_id: facId,
          production_line_id: lineId,
          equipment_code: eq.equipment_code,
          equipment_name: eq.equipment_name,
          equipment_type: eq.equipment_type,
          manufacturer: eq.manufacturer || null,
          capacity_min: eq.capacity_min || null,
          capacity_max: eq.capacity_max || null,
          capacity_nominal: eq.capacity_nominal || null,
          capacity_unit: eq.capacity_unit || 'units/hr',
          qualification_status: eq.qualification_status || 'QUALIFIED',
          calibration_status: eq.calibration_status || 'CALIBRATED',
          updated_at: new Date().toISOString(),
        };

        const { error: eqErr } = await this.supabase
          .from('production_equipment')
          .upsert(payload, { onConflict: 'organization_id, facility_id, equipment_code' });

        if (!eqErr) {
          committedEquipment++;
        }
      }
    }

    // Update session record as COMMITTED & VERIFIED
    await this.supabase
      .from('facility_import_sessions')
      .update({
        status: 'COMMITTED',
        verification_status: 'VERIFIED',
        verified_by: this.userId || null,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return { committedFacilities, committedLines, committedEquipment };
  }
}
