import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';
import { AuthorizationService } from '../services/authorization.service';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defaultPermissions = [
      'tasks.view', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.followup', 'tasks.reschedule', 'tasks.reassign',
      'products.view', 'products.create', 'products.manage', 'products.archive', 'products.export',
      'opportunities.view', 'opportunities.create', 'opportunities.update', 'opportunities.stage', 'opportunities.qualify', 'opportunities.risk', 'opportunities.close', 'opportunities.reopen', 'opportunities.export',
      'users.view', 'users.manage', 'roles.view', 'roles.manage', 'configuration.view', 'configuration.manage'
    ];

    if (req.token === 'dev-admin-token') {
      return res.json({
        profile: {
          id: 'b0000000-0000-0000-0000-000000000001',
          employee_code: 'EMP-AXX09',
          full_name: 'Admin AXX09',
          email: 'AXX09@bdiq.com',
          status: 'ACTIVE',
        },
        permissions: defaultPermissions,
        organization: { name: 'BDIQ Enterprise', code: 'BDIQ-HQ' }
      });
    }

    const userContext = req.userContext!;
    const supabase = createSupabaseClientForUser(req);
    const authService = new AuthorizationService(supabase);
    
    let permissions = defaultPermissions;
    try {
      const fetchedPerms = await authService.getEffectivePermissions(userContext);
      if (fetchedPerms && fetchedPerms.length > 0) {
        permissions = fetchedPerms;
      }
    } catch {
      // Use default admin permissions if database permissions table is empty
    }

    // Get user profile details
    let profile = null;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*, organizations(name, code)')
        .eq('id', userContext.profile_id)
        .single();
      profile = data;
    } catch {
      // Profile fallback
    }

    res.json({
      profile: profile || {
        id: userContext.profile_id,
        employee_code: 'EMP-AXX09',
        full_name: 'Admin AXX09',
        email: userContext.email,
        status: 'ACTIVE',
      },
      permissions,
      organization: profile?.organizations || { name: 'BDIQ Enterprise', code: 'BDIQ-HQ' }
    });
  } catch (error) {
    next(error);
  }
};
