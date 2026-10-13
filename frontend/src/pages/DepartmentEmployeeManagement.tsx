import { useState, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  Building2,
  Users,
  Upload,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  downloadDepartmentTemplate,
  bulkUploadDepartments,
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  downloadUserTemplate,
  bulkUploadUsers,
} from '@/services/organization-directory.api';
import type { Department, UserProfile } from '@/services/organization-directory.api';

export default function DepartmentEmployeeManagement() {
  const { session } = useAuth();
  const token = session?.access_token;

  // Active Tab: 'departments' | 'employees' | 'structure'
  const [activeTab, setActiveTab] = useState<'departments' | 'employees' | 'structure'>('departments');

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Search & Filters
  const [deptSearch, setDeptSearch] = useState<string>('');
  const [deptStatusFilter, setDeptStatusFilter] = useState<string>('ALL');

  const [userSearch, setUserSearch] = useState<string>('');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');

  // Modals
  const [deptModalOpen, setDeptModalOpen] = useState<boolean>(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptFormData, setDeptFormData] = useState<{
    code: string;
    name: string;
    description: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({ code: '', name: '', description: '', status: 'ACTIVE' });

  const [userModalOpen, setUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userFormData, setUserFormData] = useState<{
    employee_code: string;
    full_name: string;
    email: string;
    department_id: string;
    designation: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    employee_code: '',
    full_name: '',
    email: '',
    department_id: '',
    designation: '',
    status: 'ACTIVE',
  });

  // Bulk Upload Modals
  const [deptUploadModalOpen, setDeptUploadModalOpen] = useState<boolean>(false);
  const [deptParsedRows, setDeptParsedRows] = useState<any[]>([]);
  const [deptUploadErrors, setDeptUploadErrors] = useState<string[]>([]);
  const [deptUploading, setDeptUploading] = useState<boolean>(false);
  const deptFileInputRef = useRef<HTMLInputElement>(null);

  const [userUploadModalOpen, setUserUploadModalOpen] = useState<boolean>(false);
  const [userParsedRows, setUserParsedRows] = useState<any[]>([]);
  const [userUploadErrors, setUserUploadErrors] = useState<string[]>([]);
  const [userUploading, setUserUploading] = useState<boolean>(false);
  const userFileInputRef = useRef<HTMLInputElement>(null);

  // Load Data
  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [deptsData, usersData] = await Promise.all([
        fetchDepartments(token),
        fetchUsers(token),
      ]);
      setDepartments(deptsData);
      setUsers(usersData);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load organizational directory.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Flash message clear timer
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Filtered Departments
  const filteredDepartments = useMemo(() => {
    return departments.filter(d => {
      const matchSearch =
        d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
        d.code.toLowerCase().includes(deptSearch.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(deptSearch.toLowerCase()));
      const matchStatus = deptStatusFilter === 'ALL' || d.status === deptStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [departments, deptSearch, deptStatusFilter]);

  // Filtered Employees
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.employee_code && u.employee_code.toLowerCase().includes(userSearch.toLowerCase())) ||
        (u.designation && u.designation.toLowerCase().includes(userSearch.toLowerCase()));
      const matchDept = userDeptFilter === 'ALL' || u.department_id === userDeptFilter;
      const matchStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [users, userSearch, userDeptFilter, userStatusFilter]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalDepts = departments.length;
    const activeDepts = departments.filter(d => d.status === 'ACTIVE').length;
    const totalStaff = users.length;
    const activeStaff = users.filter(u => u.status === 'ACTIVE').length;
    const assignedStaff = users.filter(u => !!u.department_id).length;
    const unassignedStaff = totalStaff - assignedStaff;
    return { totalDepts, activeDepts, totalStaff, activeStaff, assignedStaff, unassignedStaff };
  }, [departments, users]);

  // Handle Department Modal Open
  const handleOpenDeptModal = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptFormData({
        code: dept.code,
        name: dept.name,
        description: dept.description || '',
        status: dept.status,
      });
    } else {
      setEditingDept(null);
      setDeptFormData({
        code: '',
        name: '',
        description: '',
        status: 'ACTIVE',
      });
    }
    setDeptModalOpen(true);
  };

  // Submit Department Form
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, deptFormData, token);
        setFeedback({ type: 'success', message: `Department "${deptFormData.name}" updated successfully.` });
      } else {
        await createDepartment(deptFormData, token);
        setFeedback({ type: 'success', message: `Department "${deptFormData.name}" created successfully.` });
      }
      setDeptModalOpen(false);
      loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save department.' });
    }
  };

  // Delete Department
  const handleDeleteDept = async (dept: Department) => {
    if (!window.confirm(`Are you sure you want to delete department "${dept.name}" (${dept.code})?`)) return;
    try {
      await deleteDepartment(dept.id, token);
      setFeedback({ type: 'success', message: `Department "${dept.name}" deleted successfully.` });
      loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete department.' });
    }
  };

  // Handle Employee Modal Open
  const handleOpenUserModal = (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({
        employee_code: user.employee_code || '',
        full_name: user.full_name,
        email: user.email,
        department_id: user.department_id || '',
        designation: user.designation || '',
        status: user.status,
      });
    } else {
      setEditingUser(null);
      setUserFormData({
        employee_code: '',
        full_name: '',
        email: '',
        department_id: departments[0]?.id || '',
        designation: '',
        status: 'ACTIVE',
      });
    }
    setUserModalOpen(true);
  };

  // Submit Employee Form
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, userFormData, token);
        setFeedback({ type: 'success', message: `Staff member "${userFormData.full_name}" updated successfully.` });
      } else {
        await createUser(userFormData, token);
        setFeedback({ type: 'success', message: `Staff member "${userFormData.full_name}" added successfully.` });
      }
      setUserModalOpen(false);
      loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save employee profile.' });
    }
  };

  // Delete / Deactivate Employee
  const handleDeleteUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to deactivate staff member "${user.full_name}"?`)) return;
    try {
      await deleteUser(user.id, token);
      setFeedback({ type: 'success', message: `Staff member "${user.full_name}" deactivated.` });
      loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to deactivate employee.' });
    }
  };

  // Download Templates
  const handleDownloadDeptTemplate = async () => {
    try {
      const blob = await downloadDepartmentTemplate(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'BDIQ_Departments_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to download department template.' });
    }
  };

  const handleDownloadUserTemplate = async () => {
    try {
      const blob = await downloadUserTemplate(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'BDIQ_Employees_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to download employee template.' });
    }
  };

  // Client-Side Department File Parse
  const handleDeptFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('File contains no sheets.');

        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (rows.length === 0) throw new Error('Spreadsheet has no rows.');

        const validated: any[] = [];
        const errors: string[] = [];
        const seenCodes = new Set<string>();

        rows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = (row['Department Code*'] || row['Department Code'] || row['code'] || '').toString().trim().toUpperCase();
          const name = (row['Department Name*'] || row['Department Name'] || row['name'] || '').toString().trim();
          const description = (row['Description'] || row['description'] || '').toString().trim();
          const status = (row['Status (ACTIVE/INACTIVE)'] || row['status'] || 'ACTIVE').toString().trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

          if (!code) errors.push(`Row ${rowNum}: Department Code is required.`);
          if (!name) errors.push(`Row ${rowNum}: Department Name is required.`);
          if (code && seenCodes.has(code)) errors.push(`Row ${rowNum}: Duplicate code "${code}" in spreadsheet.`);
          if (code) seenCodes.add(code);

          validated.push({
            code,
            name,
            description,
            status,
            isValid: !!code && !!name,
          });
        });

        setDeptParsedRows(validated);
        setDeptUploadErrors(errors);
        setDeptUploadModalOpen(true);
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Could not parse Excel/CSV file.' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Confirm Department Bulk Upload
  const handleConfirmDeptUpload = async () => {
    setDeptUploading(true);
    try {
      const validRows = deptParsedRows.filter(r => r.isValid);
      const res = await bulkUploadDepartments(validRows, token);
      setFeedback({
        type: 'success',
        message: `Successfully processed ${res.totalProcessed} department(s) (${res.inserted} created, ${res.updated} updated).`,
      });
      setDeptUploadModalOpen(false);
      setDeptParsedRows([]);
      setDeptUploadErrors([]);
      loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Bulk upload failed.' });
    } finally {
      setDeptUploading(false);
    }
  };

  // Client-Side Employee File Parse
  const handleUserFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('File contains no sheets.');

        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (rows.length === 0) throw new Error('Spreadsheet has no rows.');

        // Build lookup map for matching
        const deptLookup = new Map<string, Department>();
        departments.forEach(d => {
          deptLookup.set(d.code.trim().toUpperCase(), d);
          deptLookup.set(d.name.trim().toUpperCase(), d);
        });

        const validated: any[] = [];
        const errors: string[] = [];
        const seenEmails = new Set<string>();

        rows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const employee_code = (row['Employee Code*'] || row['Employee Code'] || row['employee_code'] || '').toString().trim();
          const full_name = (row['Full Name*'] || row['Full Name'] || row['full_name'] || '').toString().trim();
          const email = (row['Email*'] || row['Email'] || row['email'] || '').toString().trim().toLowerCase();
          const deptInput = (row['Department Code or Name*'] || row['Department Code'] || row['Department Name'] || row['department'] || '').toString().trim();
          const designation = (row['Designation*'] || row['Designation'] || row['designation'] || '').toString().trim();
          const status = (row['Status (ACTIVE/INACTIVE)'] || row['status'] || 'ACTIVE').toString().trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

          if (!full_name) errors.push(`Row ${rowNum}: Full Name is required.`);
          if (!email || !email.includes('@')) errors.push(`Row ${rowNum}: Valid Email is required.`);
          if (email && seenEmails.has(email)) errors.push(`Row ${rowNum}: Duplicate email "${email}" in file.`);
          if (email) seenEmails.add(email);

          let matchedDept: Department | undefined;
          if (deptInput) {
            matchedDept = deptLookup.get(deptInput.toUpperCase());
            if (!matchedDept) {
              errors.push(`Row ${rowNum}: Department "${deptInput}" did not match any active department.`);
            }
          }

          validated.push({
            employee_code,
            full_name,
            email,
            department_id: matchedDept?.id || null,
            deptInput,
            matchedDeptName: matchedDept?.name || 'Unmatched',
            designation,
            status,
            isValid: !!full_name && !!email && (!deptInput || !!matchedDept),
          });
        });

        setUserParsedRows(validated);
        setUserUploadErrors(errors);
        setUserUploadModalOpen(true);
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Could not parse Excel/CSV file.' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Confirm Employee Bulk Upload
  const handleConfirmUserUpload = async () => {
    setUserUploading(true);
    try {
      const validRows = userParsedRows.filter(r => r.isValid);
      const res = await bulkUploadUsers(validRows, token);
      setFeedback({
        type: 'success',
        message: `Successfully processed ${res.totalProcessed} staff profile(s) (${res.inserted} added, ${res.updated} updated).`,
      });
      setUserUploadModalOpen(false);
      setUserParsedRows([]);
      setUserUploadErrors([]);
      loadData(true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Bulk upload failed.' });
    } finally {
      setUserUploading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <span>Governance & Administration</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-semibold">Master Organization Directory</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-1">
            <Building2 className="w-6 h-6 text-foreground shrink-0" />
            Department & Employee Master Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure canonical departments, corporate hierarchy, and personnel rosters with instant Excel/CSV bulk uploader.
          </p>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Flash Alert Banner */}
      {feedback && (
        <div
          className={`px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Departments</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{stats.totalDepts}</div>
          <div className="text-[10px] text-emerald-500 font-medium mt-0.5">{stats.activeDepts} Active</div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Total Personnel</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{stats.totalStaff}</div>
          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{stats.activeStaff} Active</div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Assigned to Dept</div>
          <div className="text-xl font-bold text-foreground mt-0.5">{stats.assignedStaff}</div>
          <div className="text-[10px] text-emerald-500 font-medium mt-0.5">
            {stats.totalStaff > 0 ? Math.round((stats.assignedStaff / stats.totalStaff) * 100) : 0}% Mapped
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Unassigned Staff</div>
          <div className="text-xl font-bold text-amber-500 mt-0.5">{stats.unassignedStaff}</div>
          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">Needs assignment</div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Responsibility Ready</div>
          <div className="text-xl font-bold text-foreground mt-0.5">
            {departments.filter(d => (d.employee_count || 0) > 0).length} / {departments.length}
          </div>
          <div className="text-[10px] text-emerald-500 font-medium mt-0.5">Depts with Owners</div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Data Format</div>
          <div className="text-xl font-bold text-foreground mt-0.5 flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>.XLSX</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium mt-0.5">CSV / Excel Supported</div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'departments'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments Directory ({departments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'employees'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Personnel & Staff ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('structure')}
          className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'structure'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Structure & Headcount Distribution</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DEPARTMENTS DIRECTORY & BULK UPLOADER                              */}
      {/* ========================================================================= */}
      {activeTab === 'departments' && (
        <div className="space-y-3">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search departments by code, name, scope..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <select
                value={deptStatusFilter}
                onChange={(e) => setDeptStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none shrink-0"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Template Download */}
              <button
                onClick={handleDownloadDeptTemplate}
                className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                title="Download standard Excel department upload template"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template (.xlsx)</span>
              </button>

              {/* Upload Trigger */}
              <input
                ref={deptFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleDeptFileSelect}
                className="hidden"
              />
              <button
                onClick={() => deptFileInputRef.current?.click()}
                className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                title="Bulk upload departments from Excel or CSV"
              >
                <Upload className="w-3.5 h-3.5 text-blue-500" />
                <span>Upload Departments</span>
              </button>

              {/* Add Department Single */}
              <button
                onClick={() => handleOpenDeptModal()}
                className="px-3 py-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Department</span>
              </button>
            </div>
          </div>

          {/* Department List Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold w-24">Code</th>
                    <th className="py-2.5 px-4 font-semibold">Department Name</th>
                    <th className="py-2.5 px-4 font-semibold hidden md:table-cell">Operational Scope</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-28">Headcount</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-24">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <span>Loading department directory...</span>
                      </td>
                    </tr>
                  ) : filteredDepartments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No departments found. Use &ldquo;Add Department&rdquo; or &ldquo;Upload Departments&rdquo; above.
                      </td>
                    </tr>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                          {dept.code}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span>{dept.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground truncate max-w-xs hidden md:table-cell">
                          {dept.description || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setUserDeptFilter(dept.id);
                              setActiveTab('employees');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                            title="Filter staff in this department"
                          >
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span>{dept.employee_count || 0}</span>
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              dept.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {dept.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDeptModal(dept)}
                              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit department"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDept(dept)}
                              className="p-1.5 hover:bg-rose-500/10 rounded text-muted-foreground hover:text-rose-600 transition-colors"
                              title="Delete department"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EMPLOYEES & STAFF DIRECTORY & BULK UPLOADER                       */}
      {/* ========================================================================= */}
      {activeTab === 'employees' && (
        <div className="space-y-3">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-3 rounded-lg border border-border">
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search staff by name, email, code, designation..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none shrink-0 max-w-[160px] truncate"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none shrink-0"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Template Download */}
              <button
                onClick={handleDownloadUserTemplate}
                className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                title="Download standard Excel staff upload template"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template (.xlsx)</span>
              </button>

              {/* Upload Trigger */}
              <input
                ref={userFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleUserFileSelect}
                className="hidden"
              />
              <button
                onClick={() => userFileInputRef.current?.click()}
                className="px-3 py-1.5 border border-border bg-background hover:bg-muted text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                title="Bulk upload staff roster from Excel or CSV"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-500" />
                <span>Upload Staff</span>
              </button>

              {/* Add Single Staff */}
              <button
                onClick={() => handleOpenUserModal()}
                className="px-3 py-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Person</span>
              </button>
            </div>
          </div>

          {/* Employee List Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold w-24">Emp Code</th>
                    <th className="py-2.5 px-4 font-semibold">Staff Name & Contact</th>
                    <th className="py-2.5 px-4 font-semibold">Department</th>
                    <th className="py-2.5 px-4 font-semibold">Designation / Role</th>
                    <th className="py-2.5 px-4 font-semibold text-center w-24">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <span>Loading employee directory...</span>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No employees found matching filter criteria. Use &ldquo;Upload Staff&rdquo; above to import.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                          {user.employee_code || '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-foreground/10 text-foreground flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {user.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{user.full_name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          {user.departments ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted text-foreground text-xs font-medium">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              <span>{user.departments.name}</span>
                            </span>
                          ) : (
                            <span className="text-amber-500 text-xs italic">(Unassigned)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-foreground font-medium">
                          {user.designation || 'Staff Member'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                              user.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenUserModal(user)}
                              className="p-1.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit employee"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 hover:bg-rose-500/10 rounded text-muted-foreground hover:text-rose-600 transition-colors"
                              title="Deactivate employee"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STRUCTURE & HEADCOUNT DISTRIBUTION                                 */}
      {/* ========================================================================= */}
      {activeTab === 'structure' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {departments.map((dept) => {
              const count = dept.employee_count || 0;
              const percent = stats.totalStaff > 0 ? Math.round((count / stats.totalStaff) * 100) : 0;
              return (
                <div key={dept.id} className="p-4 rounded-lg border border-border bg-card space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        {dept.code}
                      </span>
                      <h3 className="font-bold text-sm text-foreground mt-1 truncate">{dept.name}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-mono font-black text-foreground">{count}</span>
                      <span className="block text-[10px] text-muted-foreground">{percent}% staff</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {dept.description || 'Core organizational operational unit.'}
                  </p>

                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                      {count > 0 ? '✓ Responsibility Ready' : '⚠ Pending Assignment'}
                    </span>
                    <button
                      onClick={() => {
                        setUserDeptFilter(dept.id);
                        setActiveTab('employees');
                      }}
                      className="text-xs text-foreground font-semibold hover:underline flex items-center gap-0.5"
                    >
                      <span>View</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT DEPARTMENT                                              */}
      {/* ========================================================================= */}
      {deptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl max-w-md w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-foreground" />
                <span>{editingDept ? 'Edit Department' : 'Create New Department'}</span>
              </h2>
              <button
                onClick={() => setDeptModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Department Code * <span className="text-muted-foreground font-normal">(e.g. RA-01, FORM-01)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RA-01"
                  value={deptFormData.code}
                  onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono font-bold focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Department Name * <span className="text-muted-foreground font-normal">(Canonical)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regulatory Affairs"
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Description / Operational Scope
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe functional responsibilities, core regulatory/manufacturing remit..."
                  value={deptFormData.description}
                  onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                <select
                  value={deptFormData.status}
                  onChange={(e) => setDeptFormData({ ...deptFormData, status: e.target.value as any })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 rounded-lg transition-colors shadow-sm"
                >
                  {editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT EMPLOYEE                                                */}
      {/* ========================================================================= */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl max-w-md w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-foreground" />
                <span>{editingUser ? 'Edit Staff Profile' : 'Add Staff Member'}</span>
              </h2>
              <button
                onClick={() => setUserModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Employee Code</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-101"
                    value={userFormData.employee_code}
                    onChange={(e) => setUserFormData({ ...userFormData, employee_code: e.target.value.toUpperCase() })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono focus:ring-1 focus:ring-foreground focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
                  <select
                    value={userFormData.status}
                    onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value as any })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Jenkins"
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sjenkins@pharma.com"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value.toLowerCase() })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Responsible Department *
                </label>
                <select
                  required
                  value={userFormData.department_id}
                  onChange={(e) => setUserFormData({ ...userFormData, department_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Designation / Role Title</label>
                <input
                  type="text"
                  placeholder="e.g. VP Regulatory Affairs"
                  value={userFormData.designation}
                  onChange={(e) => setUserFormData({ ...userFormData, designation: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-foreground focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 rounded-lg transition-colors shadow-sm"
                >
                  {editingUser ? 'Save Changes' : 'Add Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVIEW & CONFIRM DEPARTMENT BULK UPLOAD                            */}
      {/* ========================================================================= */}
      {deptUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <span>Confirm Department Bulk Upload</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review verified rows before importing into canonical departments directory.
                </p>
              </div>
              <button
                onClick={() => setDeptUploadModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Validation Errors banner */}
            {deptUploadErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 space-y-1 max-h-24 overflow-y-auto">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Validation Notices ({deptUploadErrors.length}):</span>
                </div>
                {deptUploadErrors.map((err, idx) => (
                  <div key={idx} className="font-mono text-[11px]">• {err}</div>
                ))}
              </div>
            )}

            {/* Preview Table */}
            <div className="border border-border rounded-lg max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground font-mono text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Department Name</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deptParsedRows.map((r, i) => (
                    <tr key={i} className={!r.isValid ? 'bg-rose-500/10' : ''}>
                      <td className="py-2 px-3 font-mono font-bold text-foreground">{r.code || '—'}</td>
                      <td className="py-2 px-3 font-medium text-foreground">{r.name || '—'}</td>
                      <td className="py-2 px-3 text-muted-foreground truncate max-w-xs">{r.description || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-foreground">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total rows parsed: <strong className="text-foreground">{deptParsedRows.length}</strong> ({deptParsedRows.filter(r => r.isValid).length} valid)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeptUploadModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeptUpload}
                  disabled={deptUploading || deptParsedRows.filter(r => r.isValid).length === 0}
                  className="px-4 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {deptUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Confirm & Import Departments</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVIEW & CONFIRM EMPLOYEE BULK UPLOAD                              */}
      {/* ========================================================================= */}
      {userUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-xl max-w-3xl w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-500" />
                  <span>Confirm Personnel / Staff Bulk Upload</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatic department matching has verified team allocations for the roster below.
                </p>
              </div>
              <button
                onClick={() => setUserUploadModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Validation Notices */}
            {userUploadErrors.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 space-y-1 max-h-24 overflow-y-auto">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Validation Notices ({userUploadErrors.length}):</span>
                </div>
                {userUploadErrors.map((err, idx) => (
                  <div key={idx} className="font-mono text-[11px]">• {err}</div>
                ))}
              </div>
            )}

            {/* Preview Table */}
            <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground font-mono text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Emp Code</th>
                    <th className="py-2 px-3">Full Name</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Matched Department</th>
                    <th className="py-2 px-3">Designation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {userParsedRows.map((r, i) => (
                    <tr key={i} className={!r.isValid ? 'bg-rose-500/10' : ''}>
                      <td className="py-2 px-3 font-mono font-bold text-foreground">{r.employee_code || '—'}</td>
                      <td className="py-2 px-3 font-semibold text-foreground">{r.full_name}</td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">{r.email}</td>
                      <td className="py-2 px-3">
                        {r.department_id ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold">
                            ✓ {r.matchedDeptName}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold">
                            Unmapped
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{r.designation || 'Staff'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Total staff parsed: <strong className="text-foreground">{userParsedRows.length}</strong> ({userParsedRows.filter(r => r.isValid).length} ready)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUserUploadModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-muted text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUserUpload}
                  disabled={userUploading || userParsedRows.filter(r => r.isValid).length === 0}
                  className="px-4 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 rounded-lg flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {userUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Confirm & Import Staff</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
