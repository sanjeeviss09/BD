import { SupabaseClient } from '@supabase/supabase-js';

export interface UserContext {
  id: string; // Auth User ID
  profile_id: string;
  organization_id: string;
  email: string;
}

export class AuthorizationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Resolves the effective permissions for a given user context.
   * Caches or fetches from the DB.
   */
  async getEffectivePermissions(user: UserContext): Promise<string[]> {
    // 1. Fetch user roles
    const { data: userRoles, error: rolesError } = await this.supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.profile_id);

    if (rolesError || !userRoles || userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map(ur => ur.role_id);

    // 2. Fetch permissions for those roles
    const { data: rolePermissions, error: permissionsError } = await this.supabase
      .from('role_permissions')
      .select('permissions(code)')
      .in('role_id', roleIds);

    if (permissionsError || !rolePermissions) {
      return [];
    }

    // 3. Deduplicate permission codes
    const permissionSet = new Set<string>();
    rolePermissions.forEach((rp: any) => {
      if (rp.permissions && rp.permissions.code) {
        permissionSet.add(rp.permissions.code);
      }
    });

    return Array.from(permissionSet);
  }

  async hasPermission(user: UserContext, permissionCode: string): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(user);
    return permissions.includes(permissionCode);
  }

  async hasAnyPermission(user: UserContext, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(user);
    return permissionCodes.some(code => permissions.includes(code));
  }

  async hasAllPermissions(user: UserContext, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(user);
    return permissionCodes.every(code => permissions.includes(code));
  }
}
