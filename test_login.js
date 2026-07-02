import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function signUpUser() {
  const { data, error } = await supabase.auth.signUp({
    email: 'admin.dil@gmail.com',
    password: 'Admin123.',
  });

  if (error) {
    console.error('SIGNUP ERROR:', error.message);
  } else {
    console.log('SIGNUP SUCCESS! User ID:', data.user?.id);
  }
}

signUpUser();
