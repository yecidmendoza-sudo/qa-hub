import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
// For node script we might need the service key if RLS blocks us, but we can try anon key with email/password login first, or just bypass if we use service role key.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY || SUPABASE_KEY, {
  auth: { persistSession: false }
});

import { parseHierarchicalCsv } from './src/lib/parsers/hierarchicalCsvParser.ts';

async function main() {
  const cycleId = '4c883c26-6318-4b84-9b0b-032bdb0129de';
  const csvPath = '/Users/shipedge/Projects/OMNIO SMOKE  - Regresion-test(v2.2.0).csv';
  
  console.log('Reading CSV...');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  
  // 1. Get cycle details
  const { data: cycle, error: cycleErr } = await supabase.from('test_cycles').select('*').eq('id', cycleId).single();
  if (cycleErr) throw cycleErr;
  
  const customCols = cycle.custom_columns || [];
  
  // 2. Parse Hierarchical
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
  console.log(`Parsed ${hierarchicalRows.length} hierarchical rows.`);
  
  let newCases = [];
  let count = 0;
  
  for (const hRow of hierarchicalRows) {
    count++;
    
    const customData: Record<string, string> = {
      hierarchy_path: hRow.path,
      hierarchy_depth: String(hRow.depth),
    };
    
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
      cycle_id: cycle.id,
      ticket_id: ticketKey ? hRow.data[ticketKey] : `TC-${count}`,
      module: moduleKey ? hRow.data[moduleKey] : (hRow.hierarchy[0] || ''),
      title: titleKey ? hRow.data[titleKey] : hRow.label,
      expected_result: expectedKey ? hRow.data[expectedKey] : '',
      custom_data: customData,
    });
  }
  
  console.log('Updating cycle custom_values...');
  const currentCustomValues = cycle.custom_values || {};
  await supabase.from('test_cycles').update({
    custom_values: {
      ...currentCustomValues,
      display_mode: 'hierarchical',
      hierarchy_depth: hierarchyDepth
    }
  }).eq('id', cycle.id);
  
  console.log('Inserting cases...');
  const { error: insErr } = await supabase.from('test_cases').insert(newCases);
  if (insErr) throw insErr;
  
  console.log('Done!');
}

main().catch(console.error);
