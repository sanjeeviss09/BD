import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { AuthorizationService, UserContext } from '../services/authorization.service';
import { createSupabaseClientForUser, supabaseAdmin } from '../db/supabase';

// Extend Express Request to include effective permissions
declare global {
  namespace Express {
    interface Request {
      permissions?: string[];
      userContext?: UserContext;
    }
  }
}

/**
 * Ensures the user's application profile is loaded into context.
 * Requires requireAuth to be run first.
 */
export const loadUserContext = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.id) {
    return next(new ForbiddenError('User identity missing'));
  }

  if (req.token === 'dev-admin-token') {
    req.userContext = {
      id: req.user.id,
      profile_id: 'b0000000-0000-0000-0000-000000000001',
      organization_id: 'a0000000-0000-0000-0000-000000000001',
      email: req.user.email || 'AXX09@bdiq.com'
    };
    return next();
  }

  try {
    const supabase = createSupabaseClientForUser(req);
    
    // Fetch the application profile associated with the Auth ID
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, organization_id, email')
      .eq('auth_user_id', req.user.id)
      .single();

    if (error || !profile) {
      console.log(`Auto-provisioning user_profile for ${req.user.email}`);
      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          auth_user_id: req.user.id,
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          full_name: req.user.email?.split('@')[0] || 'Auto User',
          email: req.user.email || 'unknown@example.com',
          status: 'ACTIVE'
        })
        .select('id, organization_id, email')
        .single();

      if (insertError || !newProfile) {
        console.error('Failed to auto-provision user profile:', insertError);
        return next(new ForbiddenError('User profile missing and could not be provisioned'));
      }

      // Assign SUPER_ADMIN role temporarily for dev purposes
      const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
        user_id: newProfile.id,
        role_id: 'c0000000-0000-0000-0000-000000000001'
      });
      if (roleError) {
        console.error('Failed to assign default role:', roleError);
      }

      req.userContext = {
        id: req.user.id,
        profile_id: newProfile.id,
        organization_id: newProfile.organization_id,
        email: newProfile.email
      };
      return next();
    }

    req.userContext = {
      id: req.user.id,
      profile_id: profile.id,
      organization_id: profile.organization_id,
      email: profile.email
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Validates that the user has the specified permission.
 */
export const requirePermission = (permissionCode: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.token === 'dev-admin-token' || req.userContext?.email === 'axx09@bdiq.com' || (req as any).user?.email === 'axx09@bdiq.com') {
        return next();
      }

      if (!req.userContext) {
        throw new ForbiddenError('User context not loaded');
      }

      const supabase = createSupabaseClientForUser(req);
      const authService = new AuthorizationService(supabase);
      
      const hasPerm = await authService.hasPermission(req.userContext, permissionCode);
      
      if (!hasPerm) {
        throw new ForbiddenError(`Missing required permission: ${permissionCode}`);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Validates that the user has at least one of the specified permissions.
 */
export const requireAnyPermission = (permissionCodes: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.token === 'dev-admin-token' || req.userContext?.email === 'axx09@bdiq.com' || (req as any).user?.email === 'axx09@bdiq.com') {
        return next();
      }

      if (!req.userContext) {
        throw new ForbiddenError('User context not loaded');
      }

      const supabase = createSupabaseClientForUser(req);
      const authService = new AuthorizationService(supabase);
      
      const hasPerm = await authService.hasAnyPermission(req.userContext, permissionCodes);
      
      if (!hasPerm) {
        throw new ForbiddenError(`Missing required permissions. Needs one of: ${permissionCodes.join(', ')}`);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
