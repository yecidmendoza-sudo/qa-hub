import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const omnioCycleId = '4c883c26-6318-4b84-9b0b-032bdb0129de';
  
  // 1. Get recent cases we just injected. My script didn't set execution values other than the trigger.
  // Actually, wait, the script inserted rows roughly 20-30 minutes ago.
  const timeThreshold = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: recentCases, error: getErr } = await supabase
    .from('test_cases')
    .select('id')
    .eq('cycle_id', omnioCycleId)
    .gt('created_at', timeThreshold);
    
  if (getErr) throw getErr;
  
  if (recentCases && recentCases.length > 0) {
    const ids = recentCases.map(c => c.id);
    console.log(`Found ${ids.length} cases in OMNIO to delete...`);
    
    // delete in batches
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const { error: delErr } = await supabase.from('test_cases').delete().in('id', batch);
      if (delErr) console.error('Error deleting batch', delErr);
    }
    console.log('OMNIO test cases reverted.');
  } else {
    console.log('No recent test cases found in OMNIO cycle.');
  }
  
  // Restore OMNIO custom_values to non-hierarchical
  const { data: cycle } = await supabase.from('test_cycles').select('custom_values').eq('id', omnioCycleId).single();
  if (cycle) {
    const cv = cycle.custom_values || {};
    delete cv.display_mode;
    delete cv.hierarchy_depth;
    await supabase.from('test_cycles').update({ custom_values: cv }).eq('id', omnioCycleId);
    console.log('OMNIO custom_values restored.');
  }

  // 2. Find Shelfter Smoke cycle
  const { data: shelfterCycle } = await supabase
    .from('test_cycles')
    .select('id, test_versions(name, projects(name))')
    .eq('type', 'SMOKE')
    .order('created_at', { ascending: false });
    
  if (shelfterCycle) {
    const shelfterCycles = shelfterCycle.filter(c => c.test_versions?.projects?.name?.toLowerCase().includes('shelfter'));
    if (shelfterCycles.length > 0) {
       console.log('Found Shelfter Smoke cycle:', shelfterCycles[0]);
    } else {
       console.log('No Shelfter Smoke cycle found.');
    }
  }
}
main();
