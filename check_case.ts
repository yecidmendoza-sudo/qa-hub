import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const { data } = await supabase.from('test_cases').select('*').eq('cycle_id', '5a35f6e8-2269-45dd-8f94-83487cc6ffa5').limit(5);
  console.log(JSON.stringify(data, null, 2));
}
main();
