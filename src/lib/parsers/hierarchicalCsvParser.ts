import Papa from 'papaparse';

export interface HierarchicalParseOptions {
  hierarchyDepth: number;         // cuántas columnas son la jerarquía (ej: 10)
  hierarchyColNames: string[];    // nombres de esas columnas
  dataColNames: string[];         // columnas de datos reales
}

export interface HierarchicalRow {
  id: string;
  // Jerarquía reconstruida (con herencia)
  hierarchy: string[];            // ["Marketing", "MagicLink", "Login", ...]
  // Profundidad real del nodo
  depth: number;
  // Path completo para agrupación
  path: string;                   // "Marketing > MagicLink > Login"
  // Datos planos
  data: Record<string, string>;
  // Para display: label del nodo en su nivel
  label: string;
}

export function parseHierarchicalCsv(
  csvText: string,
  options: HierarchicalParseOptions
): HierarchicalRow[] {
  const parsed = Papa.parse(csvText, { skipEmptyLines: true });
  const rows = parsed.data as string[][];
  
  if (rows.length < 2) return [];

  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  
  // Estado de herencia: último valor no-vacío por columna jerárquica
  const lastValues: string[] = new Array(options.hierarchyDepth).fill('');
  const result: HierarchicalRow[] = [];
  
  for (let ri = 0; ri < dataRows.length; ri++) {
    const row = dataRows[ri];
    
    // Actualizar herencia
    for (let ci = 0; ci < options.hierarchyDepth; ci++) {
      const val = row[ci]?.trim();
      if (val) {
        lastValues[ci] = val;
        // Limpiar niveles más profundos cuando cambia un nivel padre
        for (let deeper = ci + 1; deeper < options.hierarchyDepth; deeper++) {
          lastValues[deeper] = '';
        }
      }
    }
    
    // Encontrar profundidad real (última celda no vacía)
    let depth = 0;
    for (let ci = 0; ci < options.hierarchyDepth; ci++) {
      if (row[ci]?.trim()) depth = ci;
    }
    
    // Construir path
    const hierarchy = lastValues.slice(0, depth + 1).filter(Boolean);
    const path = hierarchy.join(' > ');
    
    // Extraer datos
    const data: Record<string, string> = {};
    for (let ci = options.hierarchyDepth; ci < headerRow.length; ci++) {
      const colName = headerRow[ci] || `col_${ci}`;
      data[colName] = row[ci]?.trim() || '';
    }
    
    if (path || Object.values(data).some(v => v)) {
      result.push({
        id: `row_${ri}`,
        hierarchy,
        depth,
        path,
        label: lastValues[depth] || '',
        data,
      });
    }
  }
  
  return result;
}

export function autoDetectHierarchy(csvText: string): {
  isHierarchical: boolean;
  hierarchyDepth: number;
} {
  const parsed = Papa.parse(csvText, { skipEmptyLines: true });
  const rows = parsed.data as string[][];
  
  if (rows.length < 2) return { isHierarchical: false, hierarchyDepth: 0 };
  
  const header = rows[0];
  const dataRow = rows[1];
  
  // Cuenta cuántas celdas de la fila 1 están vacías al inicio
  let depth = 0;
  for (let i = 0; i < header.length; i++) {
    if (!dataRow[i]?.trim()) depth++;
    else break;
  }
  
  // Si un % significativo de las filas tiene la col 0 vacía, probablemente es jerárquico
  const emptyFirstColCount = rows.slice(1).filter(r => !r[0]?.trim()).length;
  const isHierarchical = emptyFirstColCount / (rows.length - 1) > 0.4;
  
  return { isHierarchical, hierarchyDepth: depth > 0 ? depth : (isHierarchical ? 1 : 0) };
}
