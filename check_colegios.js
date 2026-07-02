const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

fetch(url + '/rest/v1/colegios?select=*&limit=1', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
})
.then(r => r.json())
.then(d => {
  console.log('Colegios Table Data:');
  console.log(d);
})
.catch(e => console.error(e));
