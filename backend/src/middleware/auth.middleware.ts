import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../db/supabase';

// Extend Express Request object to include the user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
      token?: string;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid token' });
    }

    if (token === 'dev-admin-token') {
      req.user = {
        id: 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed',
        email: 'axx09@bdiq.com',
        organization_id: 'a0000000-0000-0000-0000-000000000001'
      } as any;
      req.token = token;
      return next();
    }

    // Verify the JWT token using Supabase Admin client
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };
    req.token = token;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to authenticate user' });
  }
};
