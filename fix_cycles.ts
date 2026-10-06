import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import Papa from 'papaparse';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!);

import { parseHierarchicalCsv } from './src/lib/parsers/hierarchicalCsvParser.ts';

async function main() {
  const omnioCycleId = '4c883c26-6318-4b84-9b0b-032bdb0129de';
  
  // 1. Revert OMNIO cycle 
  console.log('Reverting OMNIO cycle...');
  // Find cases created in the last 15 minutes (my script)
  const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: casesToDelete, error: delFindErr } = await supabase.from('test_cases').select('id').eq('cycle_id', omnioCycleId).gte('created_at', fifteenMinsAgo);
  if (delFindErr) throw delFindErr;
  
  if (casesToDelete && casesToDelete.length > 0) {
     console.log(`Deleting ${casesToDelete.length} cases from OMNIO...`);
     const ids = casesToDelete.map(c => c.id);
     await supabase.from('test_cases').delete().in('id', ids);
  }
  
  // revert display_mode on OMNIO
  const { data: omnioCycle } = await supabase.from('test_cycles').select('custom_values').eq('id', omnioCycleId).single();
  if (omnioCycle) {
      const cv = omnioCycle.custom_values || {};
      delete cv.display_mode;
      delete cv.hierarchy_depth;
      await supabase.from('test_cycles').update({ custom_values: cv }).eq('id', omnioCycleId);
  }
  console.log('OMNIO cycle reverted.');

  // 2. Find Shelfter Smoke cycle
  const { data: projects } = await supabase.from('projects').select('*').ilike('name', '%shelfter%');
  if (!projects || projects.length === 0) {
      console.log('No Shelfter project found');
      return;
  }
  const shelfterId = projects[0].id;
  
  const { data: shelfterCycles } = await supabase.from('test_cycles')
    .select('id, type, version, custom_columns, test_versions(name)')
    .eq('project_id', shelfterId)
    .ilike('type', '%smoke%')
    .order('created_at', { ascending: false })
    .limit(1);
    
  let targetCycleId;
  let customCols = [];
  if (!shelfterCycles || shelfterCycles.length === 0) {
      console.log('No smoke cycle found in Shelfter. Attempting to just grab any cycle in Shelfter...');
      const { data: anyC } = await supabase.from('test_cycles').select('id, custom_columns').eq('project_id', shelfterId).limit(1);
      if (anyC && anyC.length > 0) {
          targetCycleId = anyC[0].id;
          customCols = anyC[0].custom_columns || [];
      } else {
          console.log('No cycle found at all in Shelfter. Cannot upload.');
          return;
      }
  } else {
      targetCycleId = shelfterCycles[0].id;
      customCols = shelfterCycles[0].custom_columns || [];
  }
  
  console.log('Uploading to Shelfter cycle:', targetCycleId);
  
  // 3. Parse and upload OMNIO CSV to Shelfter cycle
  const csvPath = '/Users/shipedge/Projects/OMNIO SMOKE  - Regresion-test(v2.2.0).csv';
  const csvText = fs.readFileSync(csvPath, 'utf8');
  
  const hierarchyDepth = 10;
  const parsed = Papa.parse(csvText, { skipEmptyLines: true });
  const rows = parsed.data as string[][];
  const headerRow = rows[0];
  
  const options = {
    hierarchyDepth,
    hierarchyColNames: headerRow.slice(0, hierarchyDepth),
    dataColNames: headerRow.slice(hierarchyDepth)
  };
  
  const hierarchicalRows = parseHierarchicalCsv(csvText, options);
  
  let newCases = [];
  let count = 0;
  
  for (const hRow of hierarchicalRows) {
    count++;
    
    const customData: Record<string, string> = {
      hierarchy_path: hRow.path,
      hierarchy_depth: String(hRow.depth),
    };
    
    // We map whatever custom cols Shelfter cycle has
    customCols.forEach((col: any) => {
       const keyMatches = Object.keys(hRow.data).filter(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === col.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
       if (keyMatches.length > 0 && hRow.data[keyMatches[0]]) {
         customData[col.id] = hRow.data[keyMatches[0]];
       }
    });

    const titleKey = Object.keys(hRow.data).find(k => /title|taskname|task name/i.test(k));
    const moduleKey = Object.keys(hRow.data).find(k => /module|modulo/i.test(k));
    const expectedKey = Object.keys(hRow.data).find(k => /expected|resultado/i.test(k));
    const ticketKey = Object.keys(hRow.data).find(k => /ticket/i.test(k));

    newCases.push({
      cycle_id: targetCycleId,
      ticket_id: ticketKey ? hRow.data[ticketKey] : `TC-${count}`,
      module: moduleKey ? hRow.data[moduleKey] : (hRow.hierarchy[0] || ''),
      title: titleKey ? hRow.data[titleKey] : hRow.label,
      expected_result: expectedKey ? hRow.data[expectedKey] : '',
      custom_data: customData,
    });
  }
  
  // Set Shelfter cycle custom_values
  const { data: shelfterCycleData } = await supabase.from('test_cycles').select('custom_values').eq('id', targetCycleId).single();
  const currentCustomValues = shelfterCycleData?.custom_values || {};
  await supabase.from('test_cycles').update({
    custom_values: {
      ...currentCustomValues,
      display_mode: 'hierarchical',
      hierarchy_depth: hierarchyDepth
    }
  }).eq('id', targetCycleId);
  
  const { error: insErr } = await supabase.from('test_cases').insert(newCases);
  if (insErr) throw insErr;
  
  console.log('Successfully uploaded to Shelfter cycle:', targetCycleId);
}

main().catch(console.error);
