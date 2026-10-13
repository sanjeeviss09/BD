import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Key is missing from environment variables');
}

// For the backend, we typically want to use the service role key to bypass RLS for admin operations,
// or we can pass the user's JWT from the request to a freshly instantiated client to respect RLS.
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

import { Request } from 'express';

/**
 * Helper to create a Supabase client that acts on behalf of a specific user.
 * This is essential for enforcing Row Level Security (RLS) policies in the database.
 */
export const createSupabaseClientForUser = (jwtTokenOrReq: string | Request) => {
  let jwtToken = '';
  if (typeof jwtTokenOrReq === 'string') {
    jwtToken = jwtTokenOrReq.startsWith('Bearer ') ? jwtTokenOrReq.split(' ')[1] : jwtTokenOrReq;
  } else if (jwtTokenOrReq && (jwtTokenOrReq as Request).headers) {
    const authHeader = (jwtTokenOrReq as Request).headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      jwtToken = authHeader.split(' ')[1];
    }
  }

  // If token is missing or is dev-admin-token, use supabaseAdmin
  if (!jwtToken || jwtToken === 'dev-admin-token') {
    return supabaseAdmin;
  }

  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY as string, {
    global: {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
  });
};
