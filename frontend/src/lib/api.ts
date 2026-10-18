/**
 * Shared backend API helpers.
 * Resolves the BDIQ backend base URL from VITE_API_URL (defaults to localhost:4000)
 * and always returns a URL ending in `/api`.
 */
export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
};

/** Builds standard JSON + bearer auth headers for backend calls. */
export const authHeaders = (accessToken?: string | null): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token =
    accessToken ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('token') ||
        (localStorage.getItem('bdiq_dev_session') === 'true' ? 'dev-admin-token' : null)
      : null) ||
    'dev-admin-token';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};
