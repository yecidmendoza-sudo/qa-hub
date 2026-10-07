import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);
async function main() {
  const { data } = await supabase.from('test_cases').select('custom_data').eq('cycle_id', '5a35f6e8-2269-45dd-8f94-83487cc6ffa5');
  const depths = (data || []).map(c => {
    const p: string = c.custom_data?.hierarchy_path || '';
    return p ? p.split(' > ').length : 0;
  });
  const maxDepth = Math.max(...depths);
  console.log('Max parts in path:', maxDepth);
  // Sample some paths
  const sample = (data || []).filter(c => (c.custom_data?.hierarchy_path || '').split(' > ').length === maxDepth).slice(0,3).map(c => c.custom_data?.hierarchy_path);
  console.log('Deepest paths:', sample);
}
main();
