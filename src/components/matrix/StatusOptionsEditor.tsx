import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, RotateCcw, Settings } from 'lucide-react';
import { DEFAULT_STATUS_OPTIONS, STATUS_EMOJI, statusCls } from '../../lib/constants/statusOptions';

interface Props {
  options: string[];
  onSave: (opts: string[]) => void;
  onClose: () => void;
}

export default function StatusOptionsEditor({ options, onSave, onClose }: Props) {
  const [opts, setOpts] = useState<string[]>(options.length > 0 ? [...options] : [...DEFAULT_STATUS_OPTIONS]);
  const [newOpt, setNewOpt] = useState('');
  const [saving, setSaving] = useState(false);

  const addOpt = () => {
    const v = newOpt.trim().toUpperCase().replace(/\s+/g, '_');
    if (!v || opts.includes(v)) return;
    setOpts(prev => [...prev, v]);
    setNewOpt('');
  };

  const removeOpt = (idx: number) => {
    if (opts.length <= 1) return; // mínimo 1 opción
    setOpts(prev => prev.filter((_, i) => i !== idx));
  };

  const resetToDefaults = () => setOpts([...DEFAULT_STATUS_OPTIONS]);

  const handleSave = async () => {
    if (opts.length === 0) return;
    setSaving(true);
    onSave(opts);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Settings className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Opciones de Estado</h3>
              <p className="text-xs text-gray-500">Personaliza los valores disponibles</p>
            </div>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options list */}
        <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
          {opts.map((opt, idx) => (
            <div key={opt + idx}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 group">
              <span className="text-base">{STATUS_EMOJI[opt] ?? '🔘'}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border flex-1 ${statusCls(opt)}`}>
                {opt}
              </span>
              {opts.length > 1 && (
                <button onClick={() => removeOpt(idx)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-0.5 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add new option */}
        <div className="px-5 pb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newOpt}
              onChange={e => setNewOpt(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              onKeyDown={e => e.key === 'Enter' && addOpt()}
              placeholder="NUEVA_OPCION"
              className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono uppercase"
            />
            <button onClick={addOpt}
              disabled={!newOpt.trim()}
              className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Los valores se guardan en MAYÚSCULAS con guiones bajos
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={resetToDefaults}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
            <RotateCcw className="w-3 h-3" />
            Restaurar defaults
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || opts.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
