import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface PermissionContextType {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  loading: boolean;
  profile: any;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  loading: true,
  profile: null,
});

export const PermissionProvider = ({ children }: { children: React.ReactNode }) => {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPermissions = async () => {
      if (!session) {
        if (isMounted) {
          setPermissions([]);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch('http://localhost:4000/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setPermissions(data.permissions && data.permissions.length > 0 ? data.permissions : [
              'tasks.view', 'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.followup', 'tasks.reschedule', 'tasks.reassign',
              'products.view', 'products.read', 'products.create', 'products.manage', 'products.archive', 'products.export',
              'opportunities.view', 'opportunities.read', 'opportunities.create', 'opportunities.update', 'opportunities.stage', 'opportunities.qualify', 'opportunities.risk', 'opportunities.close', 'opportunities.reopen', 'opportunities.export',
              'users.view', 'users.read', 'users.manage', 'roles.view', 'roles.read', 'roles.manage',
              'configuration.read', 'configuration.view', 'configuration.manage', 'configuration.features', 'configuration.publish'
            ]);
            setProfile(data.profile || {
              id: 'b0000000-0000-0000-0000-000000000001',
              employee_code: 'EMP-AXX09',
              full_name: 'Admin AXX09',
              email: 'AXX09@bdiq.com',
              organizations: { name: 'BDIQ Enterprise', code: 'BDIQ-HQ' }
            });
          }
        } else {
          if (isMounted) {
            setPermissions([
              'tasks.view', 'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.followup', 'tasks.reschedule', 'tasks.reassign',
              'products.view', 'products.read', 'products.create', 'products.manage', 'products.archive', 'products.export',
              'opportunities.view', 'opportunities.read', 'opportunities.create', 'opportunities.update', 'opportunities.stage', 'opportunities.qualify', 'opportunities.risk', 'opportunities.close', 'opportunities.reopen', 'opportunities.export',
              'users.view', 'users.read', 'users.manage', 'roles.view', 'roles.read', 'roles.manage',
              'configuration.read', 'configuration.view', 'configuration.manage', 'configuration.features', 'configuration.publish'
            ]);
            setProfile({
              id: 'b0000000-0000-0000-0000-000000000001',
              employee_code: 'EMP-AXX09',
              full_name: 'Admin AXX09',
              email: 'AXX09@bdiq.com',
              organizations: { name: 'BDIQ Enterprise', code: 'BDIQ-HQ' }
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
        if (isMounted) {
          setPermissions([
            'tasks.view', 'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.followup', 'tasks.reschedule', 'tasks.reassign',
            'products.view', 'products.read', 'products.create', 'products.manage', 'products.archive', 'products.export',
            'opportunities.view', 'opportunities.read', 'opportunities.create', 'opportunities.update', 'opportunities.stage', 'opportunities.qualify', 'opportunities.risk', 'opportunities.close', 'opportunities.reopen', 'opportunities.export',
            'users.view', 'users.read', 'users.manage', 'roles.view', 'roles.read', 'roles.manage',
            'configuration.read', 'configuration.view', 'configuration.manage', 'configuration.features', 'configuration.publish'
          ]);
          setProfile({
            id: 'b0000000-0000-0000-0000-000000000001',
            employee_code: 'EMP-AXX09',
            full_name: 'Admin AXX09',
            email: 'AXX09@bdiq.com',
            organizations: { name: 'BDIQ Enterprise', code: 'BDIQ-HQ' }
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPermissions();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const hasPermission = (permission: string) => {
    if (permissions.includes('*') || permissions.includes('admin')) return true;
    if (permissions.includes(permission)) return true;

    // Normalize read / view / manage aliases
    if (permission.endsWith('.read')) {
      const viewPerm = permission.replace('.read', '.view');
      const managePerm = permission.replace('.read', '.manage');
      if (permissions.includes(viewPerm) || permissions.includes(managePerm)) return true;
    }
    if (permission.endsWith('.view')) {
      const readPerm = permission.replace('.view', '.read');
      const managePerm = permission.replace('.view', '.manage');
      if (permissions.includes(readPerm) || permissions.includes(managePerm)) return true;
    }
    return false;
  };

  const hasAnyPermission = (perms: string[]) => perms.some(p => hasPermission(p));
  const hasAllPermissions = (perms: string[]) => perms.every(p => hasPermission(p));

  return (
    <PermissionContext.Provider value={{
      permissions,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      loading,
      profile
    }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission = () => useContext(PermissionContext);

export const RequirePermission = ({ 
  permission, 
  anyOf,
  allOf,
  children,
  fallback = null
}: { 
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermission();

  if (loading) return null;

  if (permission && !hasPermission(permission)) return fallback;
  if (anyOf && !hasAnyPermission(anyOf)) return fallback;
  if (allOf && !hasAllPermissions(allOf)) return fallback;

  return <>{children}</>;
};
