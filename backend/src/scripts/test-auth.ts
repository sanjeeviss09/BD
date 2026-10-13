import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'b:/pretty/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function test() {
  console.log("URL:", process.env.SUPABASE_URL);
  
  // We can't fetch user_profiles without a JWT, unless we login!
  // Do we have the login credentials? The prompt says "admin@bdiq.com" or "test@test.com" with "password123".
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@bdiq.com',
    password: 'password123'
  });
  
  if (error) {
    console.error("Login error:", error.message);
    return;
  }
  
  console.log("Logged in user:", data.user.id);
  
  const { data: profile, error: profError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', data.user.id);
    
  if (profError) {
    console.error("Profile fetch error:", profError);
  } else {
    console.log("Profiles found:", profile);
  }
}

test();
