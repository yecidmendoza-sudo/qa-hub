import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false }
});

import { parseHierarchicalCsv } from './src/lib/parsers/hierarchicalCsvParser.ts';

async function main() {
  const csvPath = '/Users/shipedge/Projects/OMNIO SMOKE  - Regresion-test(v2.2.0).csv';
  console.log('Reading CSV...');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  
  // 1. Get SHELFTER project
  const { data: project } = await supabase.from('projects').select('id').eq('name', 'SHELFTER').single();
  if (!project) throw new Error('Shelfter project not found');
  
  // 2. Find or create version v1
  let versionId;
  const { data: versionData } = await supabase.from('test_versions').select('id').eq('project_id', project.id).eq('name', 'v1').single();
  if (versionData) {
    versionId = versionData.id;
  } else {
    const { data: newV } = await supabase.from('test_versions').insert({ project_id: project.id, name: 'v1' }).select('id').single();
    versionId = newV!.id;
  }
  
  // 3. Create SMOKE cycle
  const hierarchyDepth = 10;
  const { data: cycle, error: cycleErr } = await supabase.from('test_cycles').insert({
    version_id: versionId,
    project_id: project.id,
    version: 'v1',
    type: 'SMOKE',
    status: 'IN_PROGRESS',
    custom_values: {
      display_mode: 'hierarchical',
      hierarchy_depth: hierarchyDepth
    },
    custom_columns: [
      { id: '_title', name: 'Task Name', type: 'text', options: [] },
      { id: 'side', name: 'SIDE', type: 'text', options: [] },
      { id: '_module', name: 'MODULE', type: 'text', options: [] },
      { id: 'feature', name: 'FEATURE', type: 'text', options: [] },
      { id: 'assignees', name: 'ASSIGNEES', type: 'dropdown', options: ['Rossen'] },
      { id: 'dark_mode', name: 'DARK MODE', type: 'text', options: [] },
      { id: 'light_mode', name: 'LIGHT MODE', type: 'text', options: [] },
      { id: '_observation', name: 'NOTES', type: 'text', options: [] },
      { id: 'ticket', name: 'TICKET', type: 'text', options: [] },
      { id: 'severity', name: 'SEVERITY', type: 'text', options: [] }
    ]
  }).select('*').single();
  
  if (cycleErr) throw cycleErr;
  console.log('Created cycle:', cycle.id);
  
  const customCols = cycle.custom_columns;
  
  // 4. Parse Hierarchical
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
      ticket_id: ticketKey && hRow.data[ticketKey] ? hRow.data[ticketKey] : `TC-${count}`,
      module: moduleKey ? hRow.data[moduleKey] : (hRow.hierarchy[0] || ''),
      title: titleKey ? hRow.data[titleKey] : hRow.label,
      expected_result: expectedKey ? hRow.data[expectedKey] : '',
      custom_data: customData,
    });
  }
  
  console.log('Inserting cases...');
  const { error: insErr } = await supabase.from('test_cases').insert(newCases);
  if (insErr) throw insErr;
  
  console.log(`\n\n✅ DONE! Url to test:`);
  console.log(`https://qa-hub-qvnt-jade.vercel.app/#/cycles/${cycle.id}`);
}

main().catch(console.error);
