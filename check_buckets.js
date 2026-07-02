const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

const { createClient } = require('@supabase/supabase-js');
const adminClient = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function run() {
  const { data, error } = await adminClient.storage.listBuckets();
  console.log('Buckets list:', data, error);
}

run();
