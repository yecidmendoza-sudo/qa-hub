import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data: projects } = await supabase.from('projects').select('*');
  console.log('Projects:', projects);
  
  const { data: cycles } = await supabase.from('test_cycles').select('id, type, version, status, test_versions(name, projects(name))');
  console.log('All cycles:', JSON.stringify(cycles, null, 2));
}
main();
