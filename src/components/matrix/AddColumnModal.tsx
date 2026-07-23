import { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface Props {
  onAdd: (name: string, type: string, options: string[]) => void;
  onClose: () => void;
}

export default function AddColumnModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsedOptions = type === 'dropdown'
      ? options.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    onAdd(name.trim(), type, parsedOptions);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Nueva Columna Personalizada</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la columna</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Navegador, Responsable..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Campo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="text">Texto Libre</option>
              <option value="dropdown">Menú Desplegable</option>
            </select>
          </div>
          {type === 'dropdown' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opciones <span className="text-gray-400 font-normal">(separadas por coma)</span>
              </label>
              <input
                type="text"
                required
                value={options}
                onChange={e => setOptions(e.target.value)}
                placeholder="Chrome, Firefox, Safari"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Cancelar
            </button>
            <button type="submit" className="flex items-center px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Añadir Columna
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
