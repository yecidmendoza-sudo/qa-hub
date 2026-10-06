import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Download, X, Eye, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { downloadTemplate } from '../../lib/services/matrixService';
import { supabase } from '../../lib/supabase/client';
import { autoDetectHierarchy, parseHierarchicalCsv, type HierarchicalParseOptions } from '../../lib/parsers/hierarchicalCsvParser';

interface Props {
  cycle: any;
  casesCount: number;
  onImportDone: () => void;
}

type ImportMode = 'flat' | 'hierarchical';

export default function CsvImporter({ cycle, casesCount, onImportDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState('');
  
  // Options state
  const [importMode, setImportMode] = useState<ImportMode>('flat');
  const [hierarchyDepth, setHierarchyDepth] = useState<number>(0);
  
  // Progress state
  const [importing, setImporting] = useState(false);

  const resetState = () => {
    setCsvContent('');
    setFileName('');
    setImportMode('flat');
    setHierarchyDepth(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      
      // Auto-detect hierarchy
      const { isHierarchical, hierarchyDepth } = autoDetectHierarchy(text);
      if (isHierarchical) {
        setImportMode('hierarchical');
        // Usar al menos 1 de profundidad si es jerárquico. Si autoDetect retorna algo mayor a 0 lo usa.
        setHierarchyDepth(hierarchyDepth > 0 ? hierarchyDepth : 1);
      } else {
        setImportMode('flat');
        setHierarchyDepth(0);
      }
      
      setIsOpen(true);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) return;
    setImporting(true);

    try {
      let newCases: any[] = [];
      let count = casesCount;
      const customCols = cycle.custom_columns || [];

      if (importMode === 'hierarchical') {
        const parsed = Papa.parse(csvContent, { skipEmptyLines: true });
        const rows = parsed.data as string[][];
        if (rows.length < 2) throw new Error("CSV vacío o sin suficientes filas");
        
        const headerRow = rows[0];
        
        const options: HierarchicalParseOptions = {
          hierarchyDepth,
          hierarchyColNames: headerRow.slice(0, hierarchyDepth),
          dataColNames: headerRow.slice(hierarchyDepth)
        };
        
        const hierarchicalRows = parseHierarchicalCsv(csvContent, options);
        
        for (const hRow of hierarchicalRows) {
          count++;
          
          const customData: Record<string, string> = {
            hierarchy_path: hRow.path,
            hierarchy_depth: String(hRow.depth),
          };
          
          // Map data columns to custom_columns
          customCols.forEach((col: any) => {
             const keyMatches = Object.keys(hRow.data).filter(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === col.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
             if (keyMatches.length > 0 && hRow.data[keyMatches[0]]) {
               customData[col.id] = hRow.data[keyMatches[0]];
             }
          });

          // Title/Module mappings
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
      } else {
        // Flat Import (Original logic)
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as any[];
            for (const row of rows) {
              const keys = Object.keys(row);
              const findKey = (s: string) => {
                const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
                return keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
              };

              const ticketKey = findKey('TicketID') || findKey('Ticket ID') || findKey('Ticket');
              const titleKey = findKey('TaskName') || findKey('Task Name') || findKey('Title');
              const moduleKey = findKey('Modulo') || findKey('Module');
              const expectedKey = findKey('ExpectedResult') || findKey('Expected Result') || findKey('Resultado Esperado');

              const customData: Record<string, string> = {};
              customCols.forEach((col: any) => {
                const k = findKey(col.name);
                if (k && row[k]) customData[col.id] = row[k];
              });

              if (ticketKey || titleKey) {
                count++;
                newCases.push({
                  cycle_id: cycle.id,
                  ticket_id: row[ticketKey || ''] || `TC-${count}`,
                  module: row[moduleKey || ''] || '',
                  title: row[titleKey || ''] || '',
                  expected_result: row[expectedKey || ''] || '',
                  custom_data: customData,
                });
              }
            }
          }
        });
      }

      if (newCases.length > 0) {
        // Actualizar el cycle si es jerárquico para guardar config
        if (importMode === 'hierarchical') {
           const currentCustomValues = cycle.custom_values || {};
           await supabase.from('test_cycles').update({
              custom_values: {
                ...currentCustomValues,
                display_mode: 'hierarchical',
                hierarchy_depth: hierarchyDepth
              }
           }).eq('id', cycle.id);
        }

        const { error } = await supabase.from('test_cases').insert(newCases);
        if (error) throw error;
        
        onImportDone();
        setIsOpen(false);
        resetState();
      } else {
        alert("No se encontraron casos válidos para importar.");
      }

    } catch (err: any) {
      console.error(err);
      alert(`Error al importar: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Helper to render preview table
  const renderPreview = () => {
    if (!csvContent) return null;
    const parsed = Papa.parse(csvContent, { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length < 2) return <p className="text-gray-500 text-sm">El archivo no tiene suficientes datos.</p>;

    const headerRow = rows[0];
    const previewRows = rows.slice(1, 6); // Max 5 rows

    return (
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-gray-50">
            <tr>
              {headerRow.map((col, idx) => (
                <th key={idx} className={`px-2 py-1 border-b border-r border-gray-200 whitespace-nowrap ${importMode === 'hierarchical' && idx < hierarchyDepth ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600'}`}>
                  {col || `Col ${idx+1}`}
                  {importMode === 'hierarchical' && idx < hierarchyDepth && <span className="ml-1 text-[10px] bg-indigo-100 px-1 rounded">Nivel {idx+1}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-gray-100">
                {headerRow.map((_, cIdx) => (
                  <td key={cIdx} className={`px-2 py-1 border-r border-gray-100 truncate max-w-[150px] ${importMode === 'hierarchical' && cIdx < hierarchyDepth ? 'bg-indigo-50/30' : ''}`}>
                    {row[cIdx]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => downloadTemplate(cycle)}
          className="flex items-center px-4 py-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-semibold transition-colors border border-gray-200"
          title="Descargar plantilla base"
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar Plantilla
        </button>
        <input
          type="file"
          accept=".csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors border border-green-200"
        >
          <Upload className="w-4 h-4 mr-2" />
          Importar CSV
        </button>
      </div>

      {/* Import Preview Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-bold text-gray-900">Configurar Importación CSV</h3>
              </div>
              <button onClick={() => { setIsOpen(false); resetState(); }} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* File Info */}
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <span className="font-semibold text-blue-900">Archivo:</span> {fileName}
              </div>

              {/* Import Mode Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Modo de Importación</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${importMode === 'flat' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <input type="radio" name="importMode" value="flat" checked={importMode === 'flat'} onChange={() => setImportMode('flat')} className="text-blue-600 focus:ring-blue-500" />
                      <span className="font-bold text-gray-900">Plano (Estándar)</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-6">Cada fila es independiente. Ideal para plantillas simples exportadas de JIRA/Zephyr.</span>
                  </label>
                  
                  <label className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${importMode === 'hierarchical' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <input type="radio" name="importMode" value="hierarchical" checked={importMode === 'hierarchical'} onChange={() => setImportMode('hierarchical')} className="text-indigo-600 focus:ring-indigo-500" />
                      <span className="font-bold text-gray-900">Jerárquico (Tipo Google Sheets)</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-6">Celdas vacías heredan el valor superior. Ideal para matrices complejas (ej. Omnio).</span>
                  </label>
                </div>
              </div>

              {/* Hierarchy Options */}
              {importMode === 'hierarchical' && (
                <div className="space-y-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <h4 className="text-sm font-bold text-indigo-900">Configuración Jerárquica</h4>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Número de columnas de jerarquía
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      max="15" 
                      value={hierarchyDepth} 
                      onChange={e => setHierarchyDepth(parseInt(e.target.value) || 1)}
                      className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Las primeras {hierarchyDepth} columnas se usarán para construir el árbol. El resto serán columnas de datos.</p>
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-gray-500" />
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Vista Previa (Primeras 5 filas)</h4>
                </div>
                {renderPreview()}
              </div>

            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => { setIsOpen(false); resetState(); }} 
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                disabled={importing}
              >
                Cancelar
              </button>
              <button 
                onClick={handleImport} 
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                disabled={importing}
              >
                {importing ? (
                  <>
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                     Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Importación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
