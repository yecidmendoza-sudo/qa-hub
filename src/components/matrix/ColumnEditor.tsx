/**
 * ColumnEditor — Inline panel to rename a column, change its type, and edit dropdown options.
 * Opens anchored to the column header when the user clicks the ✏️ icon.
 * Calls onSave({ name, type, options }) and the parent persists to DB.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';

interface Props {
  col: { id: string; name: string; type?: string; options?: any[] };
  anchorEl: HTMLElement;
  existingValues?: string[];   // unique values already in the column data
  onSave: (patch: { name: string; type: string; options: string[] }) => void;
  onClose: () => void;
}

export default function ColumnEditor({ col, anchorEl, existingValues = [], onSave, onClose }: Props) {
  const [name,    setName]    = useState(col.name);
  const [type,    setType]    = useState(col.type || 'text');
  const [options, setOptions] = useState<string[]>(() => {
    if (!col.options) return [];
    return col.options.map((o: any) => typeof o === 'string' ? o : o.value || o.label || String(o));
  });
  const [newOpt, setNewOpt] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Position below the anchor header
  const rect = anchorEl.getBoundingClientRect();
  const top  = rect.bottom + window.scrollY + 4;
  const left = Math.min(rect.left + window.scrollX, window.innerWidth - 320 - 16);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          !anchorEl.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle, true);
    return () => document.removeEventListener('mousedown', handle, true);
  }, [anchorEl, onClose]);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    // Auto-populate options from column data when switching to dropdown with no options
    if (newType === 'dropdown' && options.length === 0 && existingValues.length > 0) {
      setOptions(existingValues.slice(0, 20)); // max 20 auto-populated
    }
  };

  const addOption = () => {
    const v = newOpt.trim();
    if (!v || options.includes(v)) return;
    setOptions(prev => [...prev, v]);
    setNewOpt('');
  };

  const removeOption = (idx: number) => setOptions(prev => prev.filter((_, i) => i !== idx));

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), type, options });
    onClose();
  };

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'absolute', top, left, width: 300, zIndex: 9999 }}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-sm font-bold text-gray-800">Editar columna</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Nombre de la columna"
            autoFocus
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tipo</label>
          <div className="relative">
            <select
              value={type} onChange={e => handleTypeChange(e.target.value)}
              className="w-full appearance-none px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white pr-8"
            >
              <option value="text">Texto libre</option>
              <option value="dropdown">Dropdown (lista de opciones)</option>
              <option value="number">Número</option>
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Dropdown options */}
        {type === 'dropdown' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Opciones del dropdown
            </label>

            {/* Existing options */}
            <div className="space-y-1 mb-2 max-h-48 overflow-y-auto">
              {options.length === 0 && (
                <p className="text-xs text-gray-400 italic">Sin opciones — agrégalas abajo</p>
              )}
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <div className="flex-1 px-2.5 py-1.5 text-sm bg-violet-50 text-violet-800 border border-violet-100 rounded-lg">
                    {opt}
                  </div>
                  <button
                    onClick={() => removeOption(idx)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new option */}
            <div className="flex gap-2">
              <input
                type="text" value={newOpt}
                onChange={e => setNewOpt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOption()}
                placeholder="Nueva opción..."
                className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                onClick={addOption}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
              >
                <Plus className="w-3 h-3" />Añadir
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
        <button onClick={onClose}
          className="flex-1 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave}
          disabled={!name.trim()}
          className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-40">
          Guardar
        </button>
      </div>
    </div>,
    document.body
  );
}
