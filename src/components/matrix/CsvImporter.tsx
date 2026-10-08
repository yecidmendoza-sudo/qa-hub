import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { Upload, Download, X, FileSpreadsheet, CheckCircle2, ChevronRight, Sparkles, Table2 } from 'lucide-react';
import { downloadTemplate } from '../../lib/services/matrixService';
import { supabase } from '../../lib/supabase/client';
import { autoDetectHierarchy } from '../../lib/parsers/hierarchicalCsvParser';

interface Props {
  cycle: any;
  casesCount: number;
  onImportDone: () => void;
}

type ImportMode = 'flat' | 'hierarchical';
type ColType = 'text' | 'dropdown';

/** Represents a column as configured by the user in the preview step */
interface ColConfig {
  csvIdx:       number;
  originalName: string;
  name:         string;
  type:         ColType;
  uniqueVals:   string[];
  isHierarchy:  boolean;
  isUnnamed:    boolean;
}

const DROPDOWN_RATIO   = 0.15;
const DROPDOWN_MAX_UNI = 15;

function detectDropdown(vals: string[]): { isDropdown: boolean; uniqueVals: string[] } {
  const nonEmpty = vals.filter(Boolean);
  const unique   = [...new Set(nonEmpty)];
  const ratio    = nonEmpty.length > 0 ? unique.length / nonEmpty.length : 1;
  return { isDropdown: unique.length <= DROPDOWN_MAX_UNI && ratio < DROPDOWN_RATIO, uniqueVals: unique.sort() };
}

export default function CsvImporter({ cycle, casesCount, onImportDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState('');
  const [fileName,   setFileName]   = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('flat');
  const [hierEnd,    setHierEnd]    = useState(0);
  const [colConfigs, setColConfigs] = useState<ColConfig[]>([]);
  const [allRows,    setAllRows]    = useState<string[][]>([]);
  const [isOpen,     setIsOpen]     = useState(false);
  const [importing,  setImporting]  = useState(false);

  const reset = () => {
    setCsvContent(''); setFileName(''); setColConfigs([]); setAllRows([]);
    setImportMode('flat'); setHierEnd(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onerror = () => alert('Error al leer el archivo. Intenta de nuevo.');
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        if (!text) { alert('Archivo vacío'); return; }
        setCsvContent(text);
        const parsed   = Papa.parse(text, { skipEmptyLines: false });
        const rows     = parsed.data as string[][];
        if (rows.length < 2) { alert('CSV vacío o sin datos'); return; }
        const headerRow = rows[0].map(h => h.trim());
        const dataRows  = rows.slice(1);
        setAllRows(rows);

        const { isHierarchical, hierarchyDepth } = autoDetectHierarchy(text);
        let detectedHierEnd = 0;
        if (isHierarchical) {
          let lastEmptyIdx = -1;
          for (let i = 0; i < headerRow.length; i++) if (headerRow[i] === '') lastEmptyIdx = i;
          detectedHierEnd = lastEmptyIdx >= 0 ? lastEmptyIdx + 1 : Math.max(hierarchyDepth, 0);
          setImportMode('hierarchical');
        } else {
          setImportMode('flat');
        }
        setHierEnd(detectedHierEnd);

        let subLevelCount = 0;
        const configs: ColConfig[] = headerRow.map((h, idx) => {
          const colVals  = dataRows.map(r => (r[idx] || '').trim());
          const { isDropdown, uniqueVals } = detectDropdown(colVals);
          const isHier   = isHierarchical && idx < detectedHierEnd;
          const isUnnamed = h === '';
          let name = h;
          if (isUnnamed && isHier) { subLevelCount++; name = `Sub-nivel ${subLevelCount}`; }
          return { csvIdx: idx, originalName: h, name, type: isDropdown ? 'dropdown' : 'text', uniqueVals, isHierarchy: isHier, isUnnamed };
        });
        setColConfigs(configs);
        setIsOpen(true);
      } catch (err: any) {
        console.error('[CsvImporter] Error al procesar CSV:', err);
        alert(`Error al procesar el CSV: ${err?.message || err}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const updateCol = useCallback((idx: number, patch: Partial<ColConfig>) => {
    setColConfigs(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }, []);

  const handleImport = async () => {
    if (!csvContent || colConfigs.length === 0) return;
    setImporting(true);
    try {
      const parsed    = Papa.parse(csvContent, { skipEmptyLines: false });
      const rawRows   = parsed.data as string[][];
      const headerRow = rawRows[0].map(h => h.trim());
      const dataRows  = rawRows.slice(1);
      const isHier    = importMode === 'hierarchical';

      const hierCols = colConfigs.filter(c => c.isHierarchy).sort((a, b) => a.csvIdx - b.csvIdx);
      const dataCols = colConfigs.filter(c => !c.isHierarchy && c.name.trim() !== '');

      // Build/reuse custom_columns
      let customCols: any[] = cycle.custom_columns || [];
      if (customCols.length === 0 && isHier) {
        const newCols: any[] = [];
        for (const cc of [...hierCols, ...dataCols]) {
          if (!cc.name.trim()) continue;
          newCols.push({
            id: crypto.randomUUID(), name: cc.name.trim(), type: cc.type,
            options: cc.type === 'dropdown' ? cc.uniqueVals.map(v => ({ label: v, value: v })) : [],
          });
        }
        const { error: colErr } = await supabase.from('test_cycles').update({ custom_columns: newCols }).eq('id', cycle.id);
        if (colErr) throw new Error(`Error creando columnas: ${colErr.message}`);
        customCols = newCols;
      }

      const findColId = (name: string) =>
        customCols.find((c: any) => c.name.trim().toLowerCase() === name.trim().toLowerCase())?.id as string | undefined;

      // Fill-forward
      const lastVals: string[] = new Array(headerRow.length).fill('');
      type FilledRow = { original: string[]; filled: string[] };
      const filledRows: FilledRow[] = dataRows.map(row => {
        const padded = [...row];
        while (padded.length < headerRow.length) padded.push('');
        const filled = padded.map((cell, ci) => {
          const v = cell.trim();
          if (isHier && ci < hierEnd && v === '') return lastVals[ci];
          if (v !== '') lastVals[ci] = v;
          return v;
        });
        filled.forEach((v, ci) => { if (v) lastVals[ci] = v; });
        return { original: padded.map(c => c.trim()), filled };
      });

      // Build cases
      const caseIds: string[] = [];
      const newCases: any[]   = [];
      let count = casesCount;

      for (let rowIdx = 0; rowIdx < filledRows.length; rowIdx++) {
        const fRow = filledRows[rowIdx];
        count++;
        const customData: Record<string, string> = {};
        customData['sort_order'] = String(casesCount + rowIdx + 1);

        const hierPathParts: string[] = [];
        for (const hc of hierCols) {
          const val = fRow.filled[hc.csvIdx];
          const colId = findColId(hc.name);
          if (val) { hierPathParts.push(val); if (colId) customData[colId] = val; }
        }
        if (hierPathParts.length > 0) customData['hierarchy_path'] = hierPathParts.join(' > ');

        // Task name = deepest unnamed sub-level
        const unnamedHierCols = hierCols.filter(c => c.isUnnamed);
        let taskName = '';
        for (let i = unnamedHierCols.length - 1; i >= 0; i--) {
          const v = fRow.filled[unnamedHierCols[i].csvIdx];
          if (v) { taskName = v; break; }
        }
        if (!taskName && hierPathParts.length > 0) taskName = hierPathParts[hierPathParts.length - 1];
        if (taskName && unnamedHierCols.length > 0) {
          const lastUnnamed = unnamedHierCols[unnamedHierCols.length - 1];
          const colId = findColId(lastUnnamed.name);
          if (colId) customData[colId] = taskName;
        }

        for (const dc of dataCols) {
          const colId = findColId(dc.name);
          const val   = fRow.filled[dc.csvIdx];
          if (colId && val) customData[colId] = val;
        }

        if (!isHier) {
          customCols.forEach((col: any) => {
            const ci = headerRow.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === col.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
            if (ci >= 0 && fRow.filled[ci]) customData[col.id] = fRow.filled[ci];
          });
        }

        const notesId  = findColId('NOTES') || findColId('NOTAS') || findColId('OBSERVACIONES');
        if (notesId && customData[notesId]) customData['_observation'] = customData[notesId];

        const ticketColId = findColId('TICKET') || findColId('TICKET ID');
        const ticketVal   = ticketColId ? customData[ticketColId] : '';

        const titleHdrIdx = headerRow.findIndex(h => /^(task\s*name|title|nombre)$/i.test(h));
        const titleVal    = titleHdrIdx >= 0 ? fRow.filled[titleHdrIdx] : taskName || `Caso ${count}`;

        const caseId = crypto.randomUUID();
        caseIds.push(caseId);
        newCases.push({ id: caseId, cycle_id: cycle.id, ticket_id: ticketVal || `TC-${count}`, title: titleVal, custom_data: customData });
      }

      if (newCases.length === 0) { alert('No se encontraron casos válidos.'); return; }

      // Auto-merges
      const autoMerges: Array<{ colId: string; startCaseId: string; rowCount: number }> = [];
      if (isHier) {
        const namedHierCols  = hierCols.filter(c => !c.isUnnamed);
        const mergeableCols  = namedHierCols.length > 1 ? namedHierCols.slice(0, -1) : namedHierCols;
        for (const nc of mergeableCols) {
          const colId = findColId(nc.name); if (!colId) continue;
          let groupStart = 0, groupVal = filledRows[0].filled[nc.csvIdx];
          for (let ri = 1; ri <= filledRows.length; ri++) {
            const curVal = ri < filledRows.length ? filledRows[ri].filled[nc.csvIdx] : null;
            if (curVal !== groupVal || ri === filledRows.length) {
              const span = ri - groupStart;
              if (span > 1 && groupVal) autoMerges.push({ colId, startCaseId: caseIds[groupStart], rowCount: span });
              groupStart = ri; groupVal = curVal || '';
            }
          }
        }
      }

      const BATCH = 200;
      for (let i = 0; i < newCases.length; i += BATCH) {
        const { error } = await supabase.from('test_cases').insert(newCases.slice(i, i + BATCH));
        if (error) throw error;
      }

      const existingMerges: any[] = cycle.custom_values?.merges || [];
      await supabase.from('test_cycles').update({
        custom_values: { ...(cycle.custom_values || {}), merges: [...existingMerges, ...autoMerges] }
      }).eq('id', cycle.id);

      onImportDone();
      setIsOpen(false);
      reset();
    } catch (err: any) {
      console.error('[CsvImporter]', err);
      alert(`Error al importar: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const previewRows = allRows.slice(1, 6);
  const autoDropdownCount = colConfigs.filter(c => c.type === 'dropdown').length;

  return (
    <>
      <div className="flex items-center space-x-2">
        <button onClick={() => downloadTemplate(cycle)}
          className="flex items-center px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-semibold transition-colors border border-gray-200">
          <Download className="w-4 h-4 mr-2" />Descargar Plantilla
        </button>
        {/* Native label → input[file] pattern: input must be in the DOM but visually hidden */}
        <input
          type="file"
          accept=".csv"
          id="csv-importer-input"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
            opacity: 0,
          }}
          tabIndex={-1}
        />
        <label
          htmlFor="csv-importer-input"
          className="cursor-pointer flex items-center px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors border border-green-200"
        >
          <Upload className="w-4 h-4 mr-2" />Importar CSV
        </label>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="text-base font-bold text-gray-900">Importar CSV</h3>
                  <p className="text-xs text-gray-500">{fileName}</p>
                </div>
                <div className="flex items-center gap-1 ml-4 text-xs text-gray-400">
                  <span className="line-through">1. Archivo</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-indigo-600 font-semibold">2. Configurar columnas</span>
                </div>
              </div>
              <button onClick={() => { setIsOpen(false); reset(); }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">

              {/* Auto-detect summary */}
              {colConfigs.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-sm">
                  <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <div className="text-indigo-800">
                    <p className="font-semibold mb-0.5">Análisis automático completado</p>
                    <p>
                      <strong>{colConfigs.length}</strong> columnas · <strong>{importMode === 'hierarchical' ? hierEnd : 0}</strong> de jerarquía · <strong>{autoDropdownCount}</strong> sugeridas como dropdown
                      {importMode === 'hierarchical' && <span className="ml-2 bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-semibold">Jerárquico</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* Preview table */}
              {previewRows.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Table2 className="w-4 h-4 text-gray-400" />
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vista previa — primeras {previewRows.length} filas</h4>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full text-xs text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          {colConfigs.map((cc, idx) => (
                            <th key={idx} className={`px-2 py-1.5 border-b border-r border-gray-200 whitespace-nowrap font-semibold
                              ${cc.isHierarchy ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600'}
                              ${cc.isUnnamed ? 'italic' : ''}`}>
                              {cc.name || <span className="text-gray-300">–</span>}
                              {cc.type === 'dropdown' && <span className="ml-1 text-[9px] bg-violet-100 text-violet-600 px-1 rounded">▾</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-gray-50 hover:bg-gray-50/50">
                            {colConfigs.map((cc, cIdx) => (
                              <td key={cIdx} className={`px-2 py-1 border-r border-gray-100 truncate max-w-[140px] ${cc.isHierarchy ? 'bg-indigo-50/20' : ''}`}>
                                {row[cc.csvIdx] || <span className="text-gray-200">·</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Column configurator */}
              {colConfigs.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Configurar columnas</h4>
                  <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase w-8">#</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Nombre de columna</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase w-40">Tipo</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Valores detectados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {colConfigs.map((cc, idx) => (
                          <tr key={idx} className={`border-b border-gray-100 ${cc.isHierarchy ? 'bg-indigo-50/30' : ''}`}>
                            <td className="px-4 py-2 text-xs text-gray-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                {cc.isHierarchy && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex-shrink-0">
                                    {cc.isUnnamed ? 'sub-nivel' : 'jerarquía'}
                                  </span>
                                )}
                                <input type="text" value={cc.name}
                                  onChange={e => updateCol(idx, { name: e.target.value })}
                                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white" />
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                {cc.type === 'dropdown' && <Sparkles className="w-3 h-3 text-violet-400 flex-shrink-0" aria-label="Auto-detectado" />}
                                <select value={cc.type} onChange={e => updateCol(idx, { type: e.target.value as ColType })}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white w-full">
                                  <option value="text">Texto</option>
                                  <option value="dropdown">Dropdown</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              {cc.type === 'dropdown' ? (
                                <div className="space-y-1.5">
                                  {/* Editable option chips */}
                                  <div className="flex flex-wrap gap-1 min-h-[20px]">
                                    {cc.uniqueVals.length === 0 && (
                                      <span className="text-[10px] text-gray-400 italic">Sin opciones</span>
                                    )}
                                    {cc.uniqueVals.map((v, vi) => (
                                      <span key={vi} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full font-medium">
                                        {v.length > 16 ? v.slice(0, 16) + '…' : v}
                                        <button
                                          type="button"
                                          onClick={() => updateCol(idx, { uniqueVals: cc.uniqueVals.filter((_, i) => i !== vi) })}
                                          className="text-violet-400 hover:text-red-500 transition-colors leading-none"
                                          title="Quitar opción"
                                        >×</button>
                                      </span>
                                    ))}
                                  </div>
                                  {/* Add new option inline */}
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      placeholder="+ Nueva opción"
                                      className="flex-1 px-2 py-0.5 text-[11px] border border-violet-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          const val = (e.target as HTMLInputElement).value.trim();
                                          if (val && !cc.uniqueVals.includes(val)) {
                                            updateCol(idx, { uniqueVals: [...cc.uniqueVals, val] });
                                          }
                                          (e.target as HTMLInputElement).value = '';
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                cc.uniqueVals.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {cc.uniqueVals.slice(0, 5).map(v => (
                                      <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                                        {v.length > 20 ? v.slice(0, 20) + '…' : v}
                                      </span>
                                    ))}
                                    {cc.uniqueVals.length > 5 && <span className="text-[10px] text-gray-400">+{cc.uniqueVals.length - 5} más</span>}
                                  </div>
                                ) : <span className="text-xs text-gray-300">–</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    ✨ Auto-detectado como dropdown si tiene ≤{DROPDOWN_MAX_UNI} valores únicos y {'<'}{Math.round(DROPDOWN_RATIO * 100)}% de variedad. Puedes cambiarlo manualmente.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
              <div className="text-xs text-gray-400">
                {allRows.length > 1 && <span>{allRows.length - 1} filas · {colConfigs.length} columnas</span>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setIsOpen(false); reset(); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                  disabled={importing}>
                  Cancelar
                </button>
                <button onClick={handleImport}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                  disabled={importing || colConfigs.length === 0}>
                  {importing ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Importando...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" />Importar {allRows.length > 1 ? `${allRows.length - 1} casos` : ''}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
