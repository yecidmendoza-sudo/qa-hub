import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.from('test_cycles').select('*, test_versions(name, projects(name))').eq('id', '4c883c26-6318-4b84-9b0b-032bdb0129de').single();
  console.log(JSON.stringify(data, null, 2));
}
main();
