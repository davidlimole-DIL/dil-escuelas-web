const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

fetch(url + '/rest/v1/', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
})
.then(r => r.json())
.then(d => {
  console.log('Tables:');
  console.log(Object.keys(d.paths).filter(p => !p.startsWith('/rpc')));
})
.catch(e => console.error(e));
