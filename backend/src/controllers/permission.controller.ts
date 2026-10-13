import { Request, Response, NextFunction } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';

export const getPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseClientForUser(req);

    // Permissions are global
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('category')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
};
