import { Request, Response } from 'express';
import { createSupabaseClientForUser } from '../db/supabase';

export const getOrganizations = async (req: Request, res: Response) => {
  try {
    const supabase = createSupabaseClientForUser(req.token!);
    
    // RLS will ensure the user only sees organizations they have access to
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: error.message });
    }

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};

export const createOrganization = async (req: Request, res: Response) => {
  try {
    const supabase = createSupabaseClientForUser(req.token!);
    const { name, legal_name, code, timezone, default_currency } = req.body;

    const { data, error } = await supabase
      .from('organizations')
      .insert([
        {
          name,
          legal_name,
          code,
          timezone,
          default_currency,
          created_by: req.user?.id
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: error.message });
    }

    res.status(201).json({ data });
  } catch (err: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
};
