require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  const email = 'AXX09@bdiq.com';
  const password = 'AXX09';
  
  console.log(`Attempting to create user: ${email} / ${password}`);

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error('Error creating auth user:', authError.message);
    if (authError.message.includes('Password should be at least')) {
        console.log('Password too short. You might need to change it to AXX09! in the prompt or change Supabase settings.');
    }
    return;
  }

  const userId = authData.user?.id;
  if (!userId) {
    console.error('No user ID returned from auth signup.');
    return;
  }

  console.log('Auth user created with ID:', userId);

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

  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      auth_user_id: userId,
      organization_id: orgData.id,
      full_name: 'Admin User AXX09',
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
