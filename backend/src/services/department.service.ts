import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { AppError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface DepartmentRecord {
  id: string;
  organization_id: string;
  business_unit_id?: string | null;
  name: string;
  code: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
  employee_count?: number;
  active_employee_count?: number;
}

export interface DepartmentFilterOptions {
  status?: string;
  search?: string;
}

export class DepartmentService {
  // Resilient memory cache / fallback store for development and offline operations
  private static fallbackDepartments: DepartmentRecord[] = [
    {
      id: 'd1000000-0000-0000-0000-000000000001',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      code: 'RA-01',
      name: 'Regulatory Affairs',
      description: 'Global Dossiers, eCTD, Health Authority submissions, DMF filings, and post-approval variations',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'd1000000-0000-0000-0000-000000000002',
      organization_id: 'a0000000-0000-0000-0000-000000000002',
      code: 'FORM-01',
      name: 'Formulation & Pre-formulation R&D',
      description: 'Oral solid dose & injectable formulation, pilot batches, bioavailability, and scale-up trials',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'd1000000-0000-0000-0000-000000000003',
      organization_id: 'a0000000-0000-0000-0000-000000000003',
      code: 'QA-01',
      name: 'Quality Assurance',
      description: 'GMP Compliance, site audits, batch record reviews, CAPA, change controls, and release',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'd1000000-0000-0000-0000-000000000004',
      organization_id: 'a0000000-0000-0000-0000-000000000004',
      code: 'QC-01',
      name: 'Quality Control',
      description: 'Analytical testing, HPLC/GC stability chambers, dissolution testing, and raw material qualification',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'd1000000-0000-0000-0000-000000000005',
      organization_id: 'a0000000-0000-0000-0000-000000000005',
      code: 'PROD-01',
      name: 'Manufacturing & Commercial Production',
      description: 'OSD, sterile injectables, packaging lines, granulation, coating, and batch manufacturing operations',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'd1000000-0000-0000-0000-000000000006',
      organization_id: 'a0000000-0000-0000-0000-000000000006',
      code: 'BD-01',
      name: 'Business Development & Licensing',
      description: 'Client licensing, customer negotiations, RFQ commercial feasibility, contracts, and partnerships',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'd1000000-0000-0000-0000-000000000007',
      organization_id: 'a0000000-0000-0000-0000-000000000007',
      code: 'SCM-01',
      name: 'Supply Chain & Procurement',
      description: 'Active Pharmaceutical Ingredients (API) procurement, excipient sourcing, cold-chain logistics',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
    {
      id: 'd1000000-0000-0000-0000-000000000008',
      organization_id: 'a0000000-0000-0000-0000-000000000008',
      code: 'ENG-01',
      name: 'Engineering & Maintenance',
      description: 'HVAC qualification, cleanroom certifications, equipment calibration, process automation',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
    },
  ];

  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId: string
  ) {}

  /**
   * Get all departments with aggregated staff counts
   */
  async getDepartments(filters: DepartmentFilterOptions = {}): Promise<DepartmentRecord[]> {
    let list: DepartmentRecord[] = [];

    try {
      let query = this.supabase
        .from('departments')
        .select('*')
        .eq('organization_id', this.orgId)
        .order('name', { ascending: true });

      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        list = data as DepartmentRecord[];
      }
    } catch (err: any) {
      logger.warn('Failed to query departments table, falling back to local store', { error: err.message });
    }

    // If database returned 0 records, fall back to pre-seeded enterprise departments
    if (list.length === 0) {
      list = DepartmentService.fallbackDepartments.filter(
        d => !d.organization_id || d.organization_id === this.orgId || d.organization_id.startsWith('a0000000')
      );
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter(d => d.status === filters.status);
      }
    }

    // Apply search filter if provided
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
    }

    // Aggregate staff count per department
    try {
      const { data: usersData } = await this.supabase
        .from('user_profiles')
        .select('id, department_id, status')
        .eq('organization_id', this.orgId);

      const staffByDept = new Map<string, { total: number; active: number }>();
      (usersData || []).forEach((u: any) => {
        if (u.department_id) {
          const current = staffByDept.get(u.department_id) || { total: 0, active: 0 };
          current.total += 1;
          if (u.status === 'ACTIVE') current.active += 1;
          staffByDept.set(u.department_id, current);
        }
      });

      return list.map(d => {
        const counts = staffByDept.get(d.id) || { total: 0, active: 0 };
        return {
          ...d,
          employee_count: counts.total,
          active_employee_count: counts.active,
        };
      });
    } catch (err: any) {
      logger.warn('Failed to aggregate employee counts for departments', { error: err.message });
      return list.map(d => ({
        ...d,
        employee_count: d.employee_count || 0,
        active_employee_count: d.active_employee_count || 0,
      }));
    }
  }

  /**
   * Get single department by ID with associated staff members
   */
  async getDepartmentById(id: string): Promise<any> {
    let dept: DepartmentRecord | null = null;

    try {
      const { data, error } = await this.supabase
        .from('departments')
        .select('*')
        .eq('organization_id', this.orgId)
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        dept = data as DepartmentRecord;
      }
    } catch (err: any) {
      logger.warn('DB query error for department by ID', { error: err.message });
    }

    if (!dept) {
      dept = DepartmentService.fallbackDepartments.find(d => d.id === id) || null;
    }

    if (!dept) {
      throw new NotFoundError(`Department not found with ID: ${id}`);
    }

    const members = await this.getDepartmentMembers(id);
    return {
      ...dept,
      members,
      employee_count: members.length,
      active_employee_count: members.filter((m: any) => m.status === 'ACTIVE').length,
    };
  }

  /**
   * Get active members of a department
   */
  async getDepartmentMembers(departmentId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('id, full_name, email, designation, employee_code, status')
        .eq('organization_id', this.orgId)
        .eq('department_id', departmentId)
        .order('full_name', { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err: any) {
      logger.warn('Failed to query department members from DB', { error: err.message });
    }

    const { UserUploadService } = require('./user-upload.service');
    const matchedFallback = (UserUploadService?.fallbackUsers || []).filter(
      (u: any) => u.department_id === departmentId
    );
    return matchedFallback;
  }

  /**
   * Create a single department
   */
  async createDepartment(data: {
    code: string;
    name: string;
    description?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }): Promise<DepartmentRecord> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();

    if (!code) throw new ValidationError('Department code is required.');
    if (!name) throw new ValidationError('Department name is required.');

    // Check duplicate code in fallback store
    const duplicate = DepartmentService.fallbackDepartments.find(
      d => (d.organization_id === this.orgId || d.organization_id.startsWith('a0000000')) && d.code.toUpperCase() === code
    );
    if (duplicate) {
      throw new ValidationError(`A department with code "${code}" already exists.`);
    }

    const newRecord: DepartmentRecord = {
      id: crypto.randomUUID(),
      organization_id: this.orgId,
      code,
      name,
      description: data.description?.trim() || null,
      status: data.status || 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      employee_count: 0,
      active_employee_count: 0,
    };

    try {
      const { data: dbData, error } = await this.supabase
        .from('departments')
        .insert({
          id: newRecord.id,
          organization_id: this.orgId,
          code: newRecord.code,
          name: newRecord.name,
          description: newRecord.description,
          status: newRecord.status,
        })
        .select()
        .single();

      if (!error && dbData) {
        DepartmentService.fallbackDepartments.push(dbData as DepartmentRecord);
        return dbData as DepartmentRecord;
      }
    } catch (err: any) {
      logger.warn('Failed to insert department in DB, saving to local store', { error: err.message });
    }

    DepartmentService.fallbackDepartments.push(newRecord);
    return newRecord;
  }

  /**
   * Update department metadata
   */
  async updateDepartment(
    id: string,
    data: {
      name?: string;
      code?: string;
      description?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): Promise<DepartmentRecord> {
    const existing = await this.getDepartmentById(id);
    const updates: Partial<DepartmentRecord> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name) updates.name = data.name.trim();
    if (data.code) updates.code = data.code.trim().toUpperCase();
    if (data.description !== undefined) updates.description = data.description?.trim() || null;
    if (data.status) updates.status = data.status;

    try {
      const { data: dbData, error } = await this.supabase
        .from('departments')
        .update(updates)
        .eq('organization_id', this.orgId)
        .eq('id', id)
        .select()
        .single();

      if (!error && dbData) {
        const idx = DepartmentService.fallbackDepartments.findIndex(d => d.id === id);
        if (idx >= 0) DepartmentService.fallbackDepartments[idx] = { ...existing, ...updates };
        return dbData as DepartmentRecord;
      }
    } catch (err: any) {
      logger.warn('Failed to update department in DB', { error: err.message });
    }

    const idx = DepartmentService.fallbackDepartments.findIndex(d => d.id === id);
    if (idx >= 0) {
      DepartmentService.fallbackDepartments[idx] = { ...existing, ...updates };
      return DepartmentService.fallbackDepartments[idx];
    }

    return { ...existing, ...updates };
  }

  /**
   * Delete or soft-delete a department
   */
  async deleteDepartment(id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.getDepartmentById(id);
    const members = await this.getDepartmentMembers(id);

    if (members.length > 0) {
      throw new ValidationError(
        `Cannot delete department "${existing.name}". It currently has ${members.length} assigned staff member(s). Please reassign them first or set the department status to INACTIVE.`
      );
    }

    try {
      await this.supabase.from('departments').delete().eq('organization_id', this.orgId).eq('id', id);
    } catch (err: any) {
      logger.warn('DB delete error for department', { error: err.message });
    }

    DepartmentService.fallbackDepartments = DepartmentService.fallbackDepartments.filter(d => d.id !== id);
    return { success: true, message: `Department "${existing.name}" successfully deleted.` };
  }

  /**
   * Generate downloadable standard Excel template for Departments
   */
  generateExcelTemplate(): Buffer {
    const headers = [
      'Department Code*',
      'Department Name*',
      'Description',
      'Status (ACTIVE/INACTIVE)',
    ];

    const sampleRows = [
      {
        'Department Code*': 'RA-01',
        'Department Name*': 'Regulatory Affairs',
        'Description': 'Global Dossiers, eCTD, Health Authority submissions, DMF filings, and post-approval variations',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Department Code*': 'FORM-01',
        'Department Name*': 'Formulation & Pre-formulation R&D',
        'Description': 'Oral solid dose & injectable formulation, pilot batches, bioavailability, and scale-up trials',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Department Code*': 'QA-01',
        'Department Name*': 'Quality Assurance',
        'Description': 'GMP Compliance, site audits, batch record reviews, CAPA, change controls, and release',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Department Code*': 'QC-01',
        'Department Name*': 'Quality Control',
        'Description': 'Analytical testing, HPLC/GC stability chambers, dissolution testing, and raw material qualification',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Department Code*': 'PROD-01',
        'Department Name*': 'Manufacturing & Commercial Production',
        'Description': 'OSD, sterile injectables, packaging lines, granulation, coating, and batch manufacturing operations',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Department Code*': 'BD-01',
        'Department Name*': 'Business Development & Licensing',
        'Description': 'Client licensing, customer negotiations, RFQ commercial feasibility, contracts, and partnerships',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Department Code*': 'SCM-01',
        'Department Name*': 'Supply Chain & Procurement',
        'Description': 'API procurement, excipient sourcing, cold-chain logistics, and vendor qualification',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Department Code*': 'ENG-01',
        'Department Name*': 'Engineering & Maintenance',
        'Description': 'HVAC qualification, cleanroom certifications, equipment calibration, process automation',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });

    // Set column widths for clean readability
    worksheet['!cols'] = [
      { wch: 18 }, // Department Code
      { wch: 38 }, // Department Name
      { wch: 65 }, // Description
      { wch: 24 }, // Status
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Departments_Template');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Bulk upload departments from parsed rows or raw Excel/CSV buffer
   */
  async bulkUpload(payload: any[] | Buffer): Promise<{
    success: boolean;
    totalProcessed: number;
    inserted: number;
    updated: number;
    errors: string[];
    departments: DepartmentRecord[];
  }> {
    let rows: any[] = [];

    if (Buffer.isBuffer(payload)) {
      const workbook = XLSX.read(payload, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new ValidationError('Uploaded spreadsheet contains no sheets.');
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (Array.isArray(payload)) {
      rows = payload;
    } else {
      throw new ValidationError('Invalid payload format. Expected Array of rows or File Buffer.');
    }

    if (rows.length === 0) {
      throw new ValidationError('Upload contains 0 records.');
    }

    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;
    const processedDepartments: DepartmentRecord[] = [];

    // Track duplicate codes within the current batch
    const seenCodesInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extract columns safely (handle both exact template header names and normalized keys)
      const codeRaw = row['Department Code*'] || row['Department Code'] || row['code'] || row['Code'] || '';
      const nameRaw = row['Department Name*'] || row['Department Name'] || row['name'] || row['Name'] || '';
      const descRaw = row['Description'] || row['description'] || '';
      const statusRaw = row['Status (ACTIVE/INACTIVE)'] || row['Status'] || row['status'] || 'ACTIVE';

      const code = String(codeRaw).trim().toUpperCase();
      const name = String(nameRaw).trim();
      const description = String(descRaw || '').trim() || null;
      const status: 'ACTIVE' | 'INACTIVE' = String(statusRaw).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      if (!code) {
        errors.push(`Row ${rowNum}: Missing required Department Code.`);
        continue;
      }
      if (!name) {
        errors.push(`Row ${rowNum}: Missing required Department Name for code "${code}".`);
        continue;
      }

      if (seenCodesInBatch.has(code)) {
        errors.push(`Row ${rowNum}: Duplicate code "${code}" encountered within the upload file.`);
        continue;
      }
      seenCodesInBatch.add(code);

      // Check if department already exists by code
      const existingInFallback = DepartmentService.fallbackDepartments.find(
        d => (d.organization_id === this.orgId || d.organization_id.startsWith('a0000000')) && d.code.toUpperCase() === code
      );

      let targetId = existingInFallback ? existingInFallback.id : crypto.randomUUID();

      // Upsert in Supabase
      try {
        const { data: dbData, error: dbError } = await this.supabase
          .from('departments')
          .upsert(
            {
              id: targetId,
              organization_id: this.orgId,
              code,
              name,
              description,
              status,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'organization_id, code' }
          )
          .select()
          .single();

        if (!dbError && dbData) {
          targetId = dbData.id;
        }
      } catch (err: any) {
        logger.warn(`Failed DB upsert for department ${code}, relying on memory store`, { error: err.message });
      }

      const record: DepartmentRecord = {
        id: targetId,
        organization_id: this.orgId,
        code,
        name,
        description,
        status,
        created_at: existingInFallback?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingInFallback) {
        const idx = DepartmentService.fallbackDepartments.findIndex(d => d.id === targetId);
        if (idx >= 0) DepartmentService.fallbackDepartments[idx] = record;
        updated++;
      } else {
        DepartmentService.fallbackDepartments.push(record);
        inserted++;
      }

      processedDepartments.push(record);
    }

    return {
      success: errors.length === 0 || processedDepartments.length > 0,
      totalProcessed: rows.length,
      inserted,
      updated,
      errors,
      departments: processedDepartments,
    };
  }
}
