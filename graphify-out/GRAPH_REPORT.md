# Graph Report - .  (2026-11-26)

## Corpus Check
- 91 files · ~59,669 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 457 nodes · 601 edges · 38 communities (28 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_App Shell & Pages|App Shell & Pages]]
- [[_COMMUNITY_Agent Cycle API Docs|Agent Cycle API Docs]]
- [[_COMMUNITY_Status Options & Styling|Status Options & Styling]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_API Playground & Docs Nav|API Playground & Docs Nav]]
- [[_COMMUNITY_Matrix Column Management|Matrix Column Management]]
- [[_COMMUNITY_Cycle Lifecycle & Matrix Page|Cycle Lifecycle & Matrix Page]]
- [[_COMMUNITY_CSV Import & Data Fixes|CSV Import & Data Fixes]]
- [[_COMMUNITY_TypeScript App Config|TypeScript App Config]]
- [[_COMMUNITY_Agent Update Matrix Status|Agent Update Matrix Status]]
- [[_COMMUNITY_TypeScript Node Config|TypeScript Node Config]]
- [[_COMMUNITY_Audit & Cycle Services|Audit & Cycle Services]]
- [[_COMMUNITY_Agent Save Matrix|Agent Save Matrix]]
- [[_COMMUNITY_Branding & Assets|Branding & Assets]]
- [[_COMMUNITY_Agent List Matrices|Agent List Matrices]]
- [[_COMMUNITY_Agent Report Results|Agent Report Results]]
- [[_COMMUNITY_Agent Create Cycle|Agent Create Cycle]]
- [[_COMMUNITY_Admin User Invitation|Admin User Invitation]]
- [[_COMMUNITY_OxLint Configuration|OxLint Configuration]]
- [[_COMMUNITY_Agent Check Identity|Agent Check Identity]]
- [[_COMMUNITY_Cycle Public View|Cycle Public View]]
- [[_COMMUNITY_Matrix Public View|Matrix Public View]]
- [[_COMMUNITY_RBAC Roles & Permissions|RBAC Roles & Permissions]]
- [[_COMMUNITY_Case Checker Utility|Case Checker Utility]]
- [[_COMMUNITY_Max Depth Checker|Max Depth Checker]]
- [[_COMMUNITY_Shelfter Finder|Shelfter Finder]]
- [[_COMMUNITY_Omnio Fixer|Omnio Fixer]]
- [[_COMMUNITY_Cycle Getter|Cycle Getter]]
- [[_COMMUNITY_Harness Decisions|Harness Decisions]]
- [[_COMMUNITY_Add Column Modal|Add Column Modal]]
- [[_COMMUNITY_TypeScript Root Config|TypeScript Root Config]]
- [[_COMMUNITY_Cycle Verifier|Cycle Verifier]]
- [[_COMMUNITY_Tool Template|Tool Template]]
- [[_COMMUNITY_Template Readme|Template Readme]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 24 edges
2. `compilerOptions` - 18 edges
3. `supabase` - 16 edges
4. `compilerOptions` - 15 edges
5. `logAudit()` - 11 edges
6. `agent-create-cycle Database Tables` - 10 edges
7. `agent-create-cycle Edge Function` - 9 edges
8. `parseHierarchicalCsv()` - 7 edges
9. `Social and Navigation Icon Sprite Sheet` - 7 edges
10. `QA Hub Tech Stack` - 6 edges

## Surprising Connections (you probably didn't know these)
- `CsvImporter.tsx (CSV/MD Import)` --semantically_similar_to--> `agent-create-cycle Edge Function`  [INFERRED] [semantically similar]
  README.md → supabase/functions/agent-create-cycle/README.md
- `Stack Canon (Node, React)` --semantically_similar_to--> `React 18 + TypeScript + Vite Frontend`  [INFERRED] [semantically similar]
  02-DOCS/wiki/sdd/constitution.md → README.md
- `main()` --calls--> `parseHierarchicalCsv()`  [EXTRACTED]
  fix_cycles.ts → src/lib/parsers/hierarchicalCsvParser.ts
- `main()` --calls--> `parseHierarchicalCsv()`  [EXTRACTED]
  upload_shelfter.ts → src/lib/parsers/hierarchicalCsvParser.ts
- `main()` --calls--> `parseHierarchicalCsv()`  [EXTRACTED]
  upload_test.ts → src/lib/parsers/hierarchicalCsvParser.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **QA Cycle Lifecycle (create → execute → report)** — agent_create_cycle_readme, agent_report_results_readme, readme_db_table_test_cycles, readme_db_table_test_cases, readme_db_table_test_executions [EXTRACTED 0.95]
- **RBAC Permission System (roles + RLS + auth)** — roles_permisos_role_admin, roles_permisos_role_qa_lead, roles_permisos_role_qa_tester, roles_permisos_rls_enforcement, readme_supabase_auth [EXTRACTED 0.85]
- **Data-Driven Matrix Rendering Pipeline** — readme_data_driven_mode, readme_reserved_ids, readme_matrix_tsx, readme_myspacematrix_tsx, agent_create_cycle_auto_inject_title [INFERRED 0.85]

## Communities (38 total, 10 thin omitted)

### Community 0 - "App Shell & Pages"
Cohesion: 0.07
Nodes (30): Layout(), Stage, Cycles(), Dashboard(), MatrixFolder, QAMember, Docs(), Login() (+22 more)

### Community 1 - "Agent Cycle API Docs"
Cohesion: 0.06
Nodes (45): Auto-inject _title Column, Auto-derivation of col_id from Header, agent-create-cycle Edge Function, Auto sort_order Assignment, agent-create-cycle Database Tables, Cycle Status Derivation Logic, Idempotent Result Reporting, agent-report-results Edge Function (+37 more)

### Community 2 - "Status Options & Styling"
Cohesion: 0.07
Nodes (19): DEFAULT_STATUS_OPTIONS, getCycleStatusOptions(), STATUS_CLS, STATUS_EMOJI, STATUS_ROW_CLS, statusCls(), statusLabel(), statusRowCls() (+11 more)

### Community 3 - "Package Dependencies"
Cohesion: 0.06
Nodes (30): dependencies, dotenv, lucide-react, papaparse, react, react-dom, react-router-dom, @supabase/supabase-js (+22 more)

### Community 4 - "API Playground & Docs Nav"
Cohesion: 0.07
Nodes (17): Endpoint, ENDPOINTS, Section, SECTIONS, CYCLE_STATUS_CLS, CYCLE_TYPE_CLS, STATUS_BADGE_CLS, CONFIG_SKILLS (+9 more)

### Community 5 - "Matrix Column Management"
Cohesion: 0.11
Nodes (19): getMatrixDataStatusOptions(), ColEditRow(), ColType, ExistingCol, optionLabels(), Props, STATUS_OPTIONS, cleanStatusValue() (+11 more)

### Community 6 - "Cycle Lifecycle & Matrix Page"
Cohesion: 0.15
Nodes (20): CYCLE_LIFECYCLE, CYCLE_LIFECYCLE_KEYS, CycleLifecycleStatus, cycleStatusCls(), cycleStatusIcon(), cycleStatusLabel(), Matrix(), STATUS_CLS (+12 more)

### Community 7 - "CSV Import & Data Fixes"
Cohesion: 0.12
Nodes (15): main(), supabase, ColConfig, ColType, ImportMode, Props, autoDetectHierarchy(), HierarchicalParseOptions (+7 more)

### Community 8 - "TypeScript App Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 9 - "Agent Update Matrix Status"
Cohesion: 0.13
Nodes (14): CORS_HEADERS, jsonError(), jsonResponse(), MatrixCol, MatrixRow, MatrixSection, parseMarkdownToSection(), RawMatrixData (+6 more)

### Community 10 - "TypeScript Node Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 11 - "Audit & Cycle Services"
Cohesion: 0.24
Nodes (11): Props, CYCLE_STATUS_STYLES, logAudit(), createCycle(), createVersion(), deleteCycle(), deleteCycleCascade(), deleteVersion() (+3 more)

### Community 12 - "Agent Save Matrix"
Cohesion: 0.14
Nodes (12): CORS_HEADERS, jsonError(), jsonResponse(), MatrixCol, MatrixRow, MatrixSection, MatrixType, SaveMatrixPayload (+4 more)

### Community 13 - "Branding & Assets"
Cohesion: 0.14
Nodes (14): Hero Image - 3D Isometric Platform Layers, React Framework Logo, Vite Build Tool Logo, QA Hub Brand Identity, React Framework, Vite Build Tool, Favicon - Shield with Checkmark, Social and Navigation Icon Sprite Sheet (+6 more)

### Community 14 - "Agent List Matrices"
Cohesion: 0.20
Nodes (4): CORS_HEADERS, CycleSummary, ListMatricesPayload, MySpaceEntry

### Community 15 - "Agent Report Results"
Cohesion: 0.22
Nodes (8): CaseRef, CORS_HEADERS, ExecutionStatus, jsonError(), jsonResponse(), ReportResultsPayload, ResultInput, VALID_STATUSES

### Community 16 - "Agent Create Cycle"
Cohesion: 0.33
Nodes (6): CORS_HEADERS, CreateCyclePayload, ExtraColumn, jsonError(), jsonResponse(), TestCaseInput

### Community 17 - "Admin User Invitation"
Cohesion: 0.40
Nodes (4): CORS_HEADERS, InviteUserPayload, jsonError(), jsonResponse()

### Community 18 - "OxLint Configuration"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 19 - "Agent Check Identity"
Cohesion: 0.67
Nodes (3): CORS_HEADERS, jsonError(), jsonResponse()

### Community 20 - "Cycle Public View"
Cohesion: 0.67
Nodes (3): CORS_HEADERS, jsonError(), jsonResponse()

### Community 21 - "Matrix Public View"
Cohesion: 0.67
Nodes (3): CORS_HEADERS, jsonError(), jsonResponse()

### Community 22 - "RBAC Roles & Permissions"
Cohesion: 0.50
Nodes (4): QA Hub Roles and Permissions Matrix, ADMIN Role, QA_LEAD Role, QA_TESTER Role

### Community 28 - "Harness Decisions"
Cohesion: 0.67
Nodes (3): Harness Decisions, Harness Installation Plan, SDD Methodology Selected

## Knowledge Gaps
- **194 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `test_connection.sh script` (+189 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `App Shell & Pages` to `Audit & Cycle Services`, `Cycle Lifecycle & Matrix Page`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `supabase` connect `App Shell & Pages` to `Audit & Cycle Services`, `Matrix Column Management`, `Cycle Lifecycle & Matrix Page`, `CSV Import & Data Fixes`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.06734006734006734 - nodes in this community are weakly interconnected._
- **Should `Agent Cycle API Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.05858585858585859 - nodes in this community are weakly interconnected._
- **Should `Status Options & Styling` be split into smaller, more focused modules?**
  _Cohesion score 0.06906906906906907 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._