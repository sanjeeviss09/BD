import { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { DepartmentService } from './department.service';

export interface UserProfileRecord {
  id: string;
  organization_id: string;
  auth_user_id?: string | null;
  employee_code?: string;
  full_name: string;
  email: string;
  department_id?: string | null;
  team_id?: string | null;
  location_id?: string | null;
  designation?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
  departments?: { name: string; code?: string };
}

export class UserUploadService {
  public static fallbackUsers: UserProfileRecord[] = [
    {
      id: 'b1000000-0000-0000-0000-000000000001',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-RA01',
      full_name: 'Dr. Sarah Jenkins',
      email: 'sjenkins@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000001',
      designation: 'VP Regulatory Affairs',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Regulatory Affairs', code: 'RA-01' },
    },
    {
      id: 'b1000000-0000-0000-0000-000000000002',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-FR01',
      full_name: 'Dr. Rajesh Sharma',
      email: 'rsharma@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000002',
      designation: 'Principal Formulation Scientist',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Formulation & Pre-formulation R&D', code: 'FORM-01' },
    },
    {
      id: 'b1000000-0000-0000-0000-000000000003',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-QA01',
      full_name: 'Elena Rostova',
      email: 'erostova@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000003',
      designation: 'Head of Quality Assurance & Compliance',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Quality Assurance', code: 'QA-01' },
    },
    {
      id: 'b1000000-0000-0000-0000-000000000004',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-QC01',
      full_name: 'David Chen',
      email: 'dchen@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000004',
      designation: 'Lead QC Analytical Chemist',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Quality Control', code: 'QC-01' },
    },
    {
      id: 'b1000000-0000-0000-0000-000000000005',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-PR01',
      full_name: 'Michael Torres',
      email: 'mtorres@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000005',
      designation: 'Commercial Production Operations Director',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Manufacturing & Commercial Production', code: 'PROD-01' },
    },
    {
      id: 'b1000000-0000-0000-0000-000000000006',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-BD01',
      full_name: 'Amanda Clark',
      email: 'aclark@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000006',
      designation: 'Senior Director BD & Global Licensing',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Business Development & Licensing', code: 'BD-01' },
    },
    {
      id: 'b1000000-0000-0000-0000-000000000007',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-SC01',
      full_name: 'Vikram Patel',
      email: 'vpatel@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000007',
      designation: 'Global Supply Chain & API Sourcing Lead',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Supply Chain & Procurement', code: 'SCM-01' },
    },
    {
      id: 'b1000000-0000-0000-0000-000000000008',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-EN01',
      full_name: 'Marcus Vance',
      email: 'mvance@bdiq-pharma.com',
      department_id: 'd1000000-0000-0000-0000-000000000008',
      designation: 'Chief Facilities & Validation Engineer',
      status: 'ACTIVE',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date('2026-01-01').toISOString(),
      departments: { name: 'Engineering & Maintenance', code: 'ENG-01' },
    },
  ];

  constructor(
    private supabase: SupabaseClient,
    private orgId: string,
    private userId: string
  ) {}

  /**
   * Get all users with merged fallback store
   */
  async getUsers(departmentId?: string, search?: string): Promise<UserProfileRecord[]> {
    let list: UserProfileRecord[] = [];

    try {
      let query = this.supabase
        .from('user_profiles')
        .select('*, departments(name, code), teams(name), locations(name)')
        .eq('organization_id', this.orgId)
        .order('full_name', { ascending: true });

      if (departmentId && departmentId !== 'ALL') {
        query = query.eq('department_id', departmentId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        list = data as UserProfileRecord[];
      }
    } catch (err: any) {
      logger.warn('Failed to query user_profiles from DB', { error: err.message });
    }

    if (list.length === 0) {
      list = UserUploadService.fallbackUsers.filter(
        u => !u.organization_id || u.organization_id === this.orgId || u.organization_id.startsWith('a0000000')
      );
      if (departmentId && departmentId !== 'ALL') {
        list = list.filter(u => u.department_id === departmentId);
      }
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        u =>
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.employee_code && u.employee_code.toLowerCase().includes(q)) ||
          (u.designation && u.designation.toLowerCase().includes(q))
      );
    }

    return list;
  }

  /**
   * Generate downloadable standard Excel template for Employees / Persons
   */
  generateExcelTemplate(): Buffer {
    const headers = [
      'Employee Code*',
      'Full Name*',
      'Email*',
      'Department Code or Name*',
      'Designation*',
      'Status (ACTIVE/INACTIVE)',
    ];

    const sampleRows = [
      {
        'Employee Code*': 'EMP-RA01',
        'Full Name*': 'Dr. Sarah Jenkins',
        'Email*': 'sjenkins@bdiq-pharma.com',
        'Department Code or Name*': 'RA-01',
        'Designation*': 'VP Regulatory Affairs',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Employee Code*': 'EMP-FR01',
        'Full Name*': 'Dr. Rajesh Sharma',
        'Email*': 'rsharma@bdiq-pharma.com',
        'Department Code or Name*': 'Formulation & Pre-formulation R&D',
        'Designation*': 'Principal Formulation Scientist',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Employee Code*': 'EMP-QA01',
        'Full Name*': 'Elena Rostova',
        'Email*': 'erostova@bdiq-pharma.com',
        'Department Code or Name*': 'QA-01',
        'Designation*': 'Head of Quality Assurance & Compliance',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Employee Code*': 'EMP-QC01',
        'Full Name*': 'David Chen',
        'Email*': 'dchen@bdiq-pharma.com',
        'Department Code or Name*': 'QC-01',
        'Designation*': 'Lead QC Analytical Chemist',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Employee Code*': 'EMP-PR01',
        'Full Name*': 'Michael Torres',
        'Email*': 'mtorres@bdiq-pharma.com',
        'Department Code or Name*': 'PROD-01',
        'Designation*': 'Commercial Production Operations Director',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Employee Code*': 'EMP-BD01',
        'Full Name*': 'Amanda Clark',
        'Email*': 'aclark@bdiq-pharma.com',
        'Department Code or Name*': 'BD-01',
        'Designation*': 'Senior Director BD & Global Licensing',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Employee Code*': 'EMP-SC01',
        'Full Name*': 'Vikram Patel',
        'Email*': 'vpatel@bdiq-pharma.com',
        'Department Code or Name*': 'Supply Chain & Procurement',
        'Designation*': 'Global Supply Chain & API Sourcing Lead',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
      {
        'Employee Code*': 'EMP-EN01',
        'Full Name*': 'Marcus Vance',
        'Email*': 'mvance@bdiq-pharma.com',
        'Department Code or Name*': 'ENG-01',
        'Designation*': 'Chief Facilities & Validation Engineer',
        'Status (ACTIVE/INACTIVE)': 'ACTIVE',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });

    worksheet['!cols'] = [
      { wch: 18 }, // Employee Code
      { wch: 28 }, // Full Name
      { wch: 32 }, // Email
      { wch: 38 }, // Department Code or Name
      { wch: 38 }, // Designation
      { wch: 24 }, // Status
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees_Template');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Bulk upload employees / persons with automatic department matching
   */
  async bulkUpload(payload: any[] | Buffer): Promise<{
    success: boolean;
    totalProcessed: number;
    inserted: number;
    updated: number;
    errors: string[];
    users: UserProfileRecord[];
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

    // Retrieve canonical departments to match codes and names
    const deptService = new DepartmentService(this.supabase, this.orgId, this.userId);
    const existingDepts = await deptService.getDepartments();

    const deptLookup = new Map<string, { id: string; name: string; code: string }>();
    existingDepts.forEach(d => {
      deptLookup.set(d.code.trim().toUpperCase(), { id: d.id, name: d.name, code: d.code });
      deptLookup.set(d.name.trim().toUpperCase(), { id: d.id, name: d.name, code: d.code });
    });

    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;
    const processedUsers: UserProfileRecord[] = [];
    const seenEmailsInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const empCodeRaw =
        row['Employee Code*'] || row['Employee Code'] || row['employee_code'] || row['code'] || '';
      const nameRaw = row['Full Name*'] || row['Full Name'] || row['full_name'] || row['name'] || '';
      const emailRaw = row['Email*'] || row['Email'] || row['email'] || '';
      const deptRaw =
        row['Department Code or Name*'] ||
        row['Department Code'] ||
        row['Department Name'] ||
        row['department'] ||
        row['department_id'] ||
        '';
      const designationRaw =
        row['Designation*'] || row['Designation'] || row['designation'] || row['title'] || '';
      const statusRaw = row['Status (ACTIVE/INACTIVE)'] || row['Status'] || row['status'] || 'ACTIVE';

      const employee_code = String(empCodeRaw).trim() || undefined;
      const full_name = String(nameRaw).trim();
      const email = String(emailRaw).trim().toLowerCase();
      const designation = String(designationRaw).trim() || undefined;
      const status: 'ACTIVE' | 'INACTIVE' =
        String(statusRaw).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      if (!full_name) {
        errors.push(`Row ${rowNum}: Missing required Full Name.`);
        continue;
      }

      if (!email || !email.includes('@')) {
        errors.push(`Row ${rowNum}: Invalid or missing email address "${emailRaw}".`);
        continue;
      }

      if (seenEmailsInBatch.has(email)) {
        errors.push(`Row ${rowNum}: Duplicate email "${email}" within the file.`);
        continue;
      }
      seenEmailsInBatch.add(email);

      // Resolve department
      let department_id: string | null = null;
      let departmentInfo: { name: string; code?: string } | undefined;

      if (deptRaw) {
        const key = String(deptRaw).trim().toUpperCase();
        const matched = deptLookup.get(key);
        if (matched) {
          department_id = matched.id;
          departmentInfo = { name: matched.name, code: matched.code };
        } else {
          // Check if valid UUID passed
          const uuidMatch = existingDepts.find(d => d.id === deptRaw);
          if (uuidMatch) {
            department_id = uuidMatch.id;
            departmentInfo = { name: uuidMatch.name, code: uuidMatch.code };
          } else {
            errors.push(
              `Row ${rowNum}: Department "${deptRaw}" could not be found. Please enter a valid Department Code (e.g. RA-01) or Name.`
            );
            continue;
          }
        }
      }

      // Check if user profile already exists
      const existingInFallback = UserUploadService.fallbackUsers.find(
        u => u.email.toLowerCase() === email
      );

      let targetId = existingInFallback ? existingInFallback.id : crypto.randomUUID();

      // Upsert into Supabase
      try {
        const { data: dbData, error: dbError } = await this.supabase
          .from('user_profiles')
          .upsert(
            {
              id: targetId,
              organization_id: this.orgId,
              employee_code,
              full_name,
              email,
              department_id,
              designation,
              status,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'organization_id, email' }
          )
          .select('*, departments(name, code)')
          .single();

        if (!dbError && dbData) {
          targetId = dbData.id;
          departmentInfo = dbData.departments;
        }
      } catch (err: any) {
        logger.warn(`Failed DB upsert for user profile ${email}, saving to local store`, {
          error: err.message,
        });
      }

      const record: UserProfileRecord = {
        id: targetId,
        organization_id: this.orgId,
        employee_code,
        full_name,
        email,
        department_id,
        designation,
        status,
        created_at: existingInFallback?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departments: departmentInfo,
      };

      if (existingInFallback) {
        const idx = UserUploadService.fallbackUsers.findIndex(u => u.id === targetId);
        if (idx >= 0) UserUploadService.fallbackUsers[idx] = record;
        updated++;
      } else {
        UserUploadService.fallbackUsers.push(record);
        inserted++;
      }

      processedUsers.push(record);
    }

    return {
      success: errors.length === 0 || processedUsers.length > 0,
      totalProcessed: rows.length,
      inserted,
      updated,
      errors,
      users: processedUsers,
    };
  }
}
