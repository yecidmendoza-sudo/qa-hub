import { useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Download } from 'lucide-react';
import { downloadTemplate } from '../../lib/services/matrixService';
import { supabase } from '../../lib/supabase/client';

interface Props {
  cycle: any;
  casesCount: number;
  onImportDone: () => void;
}

export default function CsvImporter({ cycle, casesCount, onImportDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        if (!rows || rows.length === 0) return;

        const newCases = [];
        let count = casesCount;
        const customCols = cycle.custom_columns || [];

        for (const row of rows) {
          const keys = Object.keys(row);
          const findKey = (s: string) => {
            const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
            return keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
          };

          const ticketKey = findKey('TicketID') || findKey('Ticket ID');
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

        if (newCases.length > 0) {
          await supabase.from('test_cases').insert(newCases);
          onImportDone();
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: () => alert('Error al leer el archivo CSV.'),
    });
  };

  return (
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
        onChange={handleFileUpload}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-semibold transition-colors border border-green-200"
      >
        <Upload className="w-4 h-4 mr-2" />
        Importar CSV
      </button>
    </div>
  );
}
