export interface Department {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  employee_count?: number;
  active_employee_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  organization_id: string;
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

const API_BASE = 'http://localhost:4000/api';

const getHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token || 'dev-admin-token'}`,
});

function extractErrorMessage(err: any, fallback: string): string {
  if (err?.error?.message) return err.error.message;
  if (err?.message) return err.message;
  if (typeof err?.error === 'string') return err.error;
  return fallback;
}

// ============================================================================
// DEPARTMENT ENDPOINTS
// ============================================================================

export async function fetchDepartments(token?: string, filters?: { status?: string; search?: string }): Promise<Department[]> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);

  const res = await fetch(`${API_BASE}/departments?${params.toString()}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch departments');
  return res.json();
}

export async function fetchDepartmentById(id: string, token?: string): Promise<Department & { members: UserProfile[] }> {
  const res = await fetch(`${API_BASE}/departments/${id}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch department');
  return res.json();
}

export async function fetchDepartmentMembers(departmentId: string, token?: string): Promise<UserProfile[]> {
  const res = await fetch(`${API_BASE}/departments/${departmentId}/members`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch department members');
  return res.json();
}

export async function createDepartment(payload: { code: string; name: string; description?: string; status?: string }, token?: string): Promise<Department> {
  const res = await fetch(`${API_BASE}/departments`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to create department'));
  }
  return res.json();
}

export async function updateDepartment(id: string, payload: Partial<Department>, token?: string): Promise<Department> {
  const res = await fetch(`${API_BASE}/departments/${id}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to update department'));
  }
  return res.json();
}

export async function deleteDepartment(id: string, token?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/departments/${id}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to delete department'));
  }
  return res.json();
}

export async function bulkDeleteDepartments(ids: string[], token?: string): Promise<{
  success: boolean;
  count: number;
  deletedIds: string[];
  errors?: string[];
}> {
  const res = await fetch(`${API_BASE}/departments/bulk-delete`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to bulk delete departments'));
  }
  return res.json();
}

export async function downloadDepartmentTemplate(token?: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/departments/template`, {
    headers: { Authorization: `Bearer ${token || 'dev-admin-token'}` },
  });
  if (!res.ok) throw new Error('Failed to download department template');
  return res.blob();
}

export async function bulkUploadDepartments(payload: any[] | File, token?: string): Promise<{
  success: boolean;
  totalProcessed: number;
  inserted: number;
  updated: number;
  errors: string[];
  departments: Department[];
}> {
  if (payload instanceof File) {
    const formData = new FormData();
    formData.append('file', payload);
    const res = await fetch(`${API_BASE}/departments/bulk-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token || 'dev-admin-token'}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Bulk upload failed');
    }
    return res.json();
  }

  const res = await fetch(`${API_BASE}/departments/bulk-upload`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Bulk upload failed');
  }
  return res.json();
}

// ============================================================================
// EMPLOYEE / USER PROFILE ENDPOINTS
// ============================================================================

export async function fetchUsers(token?: string, filters?: { department_id?: string; search?: string }): Promise<UserProfile[]> {
  const params = new URLSearchParams();
  if (filters?.department_id && filters.department_id !== 'ALL') params.append('department_id', filters.department_id);
  if (filters?.search) params.append('search', filters.search);

  const res = await fetch(`${API_BASE}/users?${params.toString()}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(payload: {
  full_name: string;
  email: string;
  employee_code?: string;
  department_id?: string | null;
  designation?: string;
  status?: string;
}, token?: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to create employee'));
  }
  return res.json();
}

export async function updateUser(id: string, payload: Partial<UserProfile>, token?: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, 'Failed to update employee'));
  }
  return res.json();
}

export async function deleteUser(id: string, token?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to deactivate employee');
}

export async function bulkDeleteUsers(ids: string[], token?: string): Promise<{ success: boolean; count: number; deletedIds: string[] }> {
  const res = await fetch(`${API_BASE}/users/bulk-delete`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to bulk delete employees');
  }
  return res.json();
}

export async function downloadUserTemplate(token?: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/users/template`, {
    headers: { Authorization: `Bearer ${token || 'dev-admin-token'}` },
  });
  if (!res.ok) throw new Error('Failed to download employee template');
  return res.blob();
}

export async function bulkUploadUsers(payload: any[] | File, token?: string): Promise<{
  success: boolean;
  totalProcessed: number;
  inserted: number;
  updated: number;
  errors: string[];
  users: UserProfile[];
}> {
  if (payload instanceof File) {
    const formData = new FormData();
    formData.append('file', payload);
    const res = await fetch(`${API_BASE}/users/bulk-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token || 'dev-admin-token'}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Bulk upload failed');
    }
    return res.json();
  }

  const res = await fetch(`${API_BASE}/users/bulk-upload`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Bulk upload failed');
  }
  return res.json();
}
