import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);
async function main() {
  const { data } = await supabase.from('test_cycles').select('id, custom_values, custom_columns').eq('id', '5a35f6e8-2269-45dd-8f94-83487cc6ffa5').single();
  console.log('custom_values:', JSON.stringify(data?.custom_values, null, 2));
  console.log('custom_columns count:', data?.custom_columns?.length);
  console.log('custom_columns:', JSON.stringify(data?.custom_columns?.map((c: any) => c.id), null, 2));
}
main();
