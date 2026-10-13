import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!; 
// Using Anon key for sign up, or Service Role if available.
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const email = 'AXX09@bdiq.com';
  const password = 'AXX09'; // Passwords might need to be at least 6 chars in Supabase by default. Let's use AXX09! if it fails, but we'll try AXX09 first.
  
  console.log(`Attempting to create user: ${email} / ${password}`);

  // 1. Sign up the user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error('Error creating auth user:', authError.message);
    if (authError.message.includes('Password should be at least')) {
        console.log('Password too short for Supabase default settings. Please use at least 6 characters (e.g. AXX09!).');
    }
    return;
  }

  const userId = authData.user?.id;
  if (!userId) {
    console.error('No user ID returned from auth signup.');
    return;
  }

  console.log('Auth user created with ID:', userId);

  // 2. Create an Organization
  const orgCode = 'ORG-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: 'BDIQ Default Organization',
      code: orgCode,
    })
    .select()
    .single();

  if (orgError) {
    console.error('Error creating organization:', orgError);
    return;
  }

  console.log('Organization created with ID:', orgData.id);

  // 3. Create User Profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      auth_user_id: userId,
      organization_id: orgData.id,
      full_name: 'Admin User',
      email: email,
      status: 'ACTIVE',
    });

  if (profileError) {
    console.error('Error creating user profile:', profileError);
    return;
  }

  console.log('User profile created successfully!');
  console.log('--------------------------------------------------');
  console.log(`Login Email: ${email}`);
  console.log(`Login Password: ${password}`);
  console.log('--------------------------------------------------');
}

seed().catch(console.error);
