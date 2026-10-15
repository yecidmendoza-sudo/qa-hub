import { useState, useRef } from 'react';
import { X, Plus, Pencil, Trash2, Check, ChevronUp, GripVertical } from 'lucide-react';

type ColType = 'text' | 'dropdown';

interface ExistingCol {
  id: string;
  name: string;
  type: string;
  options?: Array<{ label: string; value: string } | string>;
}

interface Props {
  existingCols?: ExistingCol[];
  onAdd: (name: string, type: string, options: string[]) => void;
  onUpdate?: (colId: string, patch: { name: string; type: string; options: string[] }) => void;
  onDelete?: (colId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
  onClose: () => void;
}

function optionLabels(col: ExistingCol): string[] {
  if (!col.options) return [];
  return col.options.map(o => (typeof o === 'string' ? o : o.label));
}

function ColEditRow({
  col,
  onSave,
  onDelete,
  dragHandleProps,
}: {
  col: ExistingCol;
  onSave: (id: string, patch: { name: string; type: string; options: string[] }) => void;
  onDelete: (id: string) => void;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(col.name);
  const [type, setType]       = useState<ColType>((col.type as ColType) || 'text');
  const [opts, setOpts]       = useState(optionLabels(col).join(', '));

  const save = () => {
    if (!name.trim()) return;
    onSave(col.id, {
      name: name.trim(),
      type,
      options: type === 'dropdown' ? opts.split(',').map(s => s.trim()).filter(Boolean) : [],
    });
    setEditing(false);
  };

  const del = () => {
    if (!window.confirm(`¿Eliminar la columna "${col.name}"?\nLos datos de todas las filas en esta columna se perderán.`)) return;
    onDelete(col.id);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white select-none">
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          title="Arrastrar para reordenar"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{col.name}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-mono flex-shrink-0">{col.type}</span>
        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors flex-shrink-0"
          title="Editar columna"
        >
          {editing ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={del}
          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0"
          title="Eliminar columna"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {editing && (
        <div className="px-3 py-3 border-t border-gray-200 bg-white space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ColType)}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            >
              <option value="text">Texto Libre</option>
              <option value="dropdown">Menú Desplegable</option>
            </select>
          </div>
          {type === 'dropdown' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Opciones <span className="text-gray-400">(separadas por coma)</span>
              </label>
              <input
                type="text"
                value={opts}
                onChange={e => setOpts(e.target.value)}
                placeholder="Ej: Chrome, Firefox, Safari"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(col.name);
                setType((col.type as ColType) || 'text');
                setOpts(optionLabels(col).join(', '));
              }}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              <Check className="w-3.5 h-3.5" /> Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManageColumnsModal({
  existingCols = [],
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onClose,
}: Props) {
  const [cols, setCols] = useState<ExistingCol[]>(existingCols);
  const [name,    setName]    = useState('');
  const [type,    setType]    = useState<ColType>('text');
  const [options, setOptions] = useState('');
  const [showAdd, setShowAdd] = useState(existingCols.length === 0);

  // ── Drag & Drop state ────────────────────────────────────────────────────
  const dragIdx   = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
    setDragging(true);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };

  const handleDrop = () => {
    if (dragIdx.current === null || dragOverIdx.current === null) return;
    if (dragIdx.current === dragOverIdx.current) { setDragging(false); return; }
    const reordered = [...cols];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(dragOverIdx.current, 0, moved);
    setCols(reordered);
    onReorder?.(reordered.map(c => c.id));
    dragIdx.current = null;
    dragOverIdx.current = null;
    setDragging(false);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    dragOverIdx.current = null;
    setDragging(false);
  };

  // ── CRUD proxies (update local + call parent) ───────────────────────────
  const handleUpdate = (id: string, patch: { name: string; type: string; options: string[] }) => {
    setCols(prev => prev.map(c => c.id === id ? { ...c, name: patch.name, type: patch.type } : c));
    onUpdate?.(id, patch);
  };

  const handleDelete = (id: string) => {
    setCols(prev => prev.filter(c => c.id !== id));
    onDelete?.(id);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsed = type === 'dropdown' ? options.split(',').map(s => s.trim()).filter(Boolean) : [];
    onAdd(name.trim(), type, parsed);
    setName(''); setType('text'); setOptions(''); setShowAdd(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Custom Columns</h3>
            {cols.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">Arrastra ⠿ para reordenar</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">

          {/* Existing columns with D&D */}
          {cols.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Columnas existentes · {cols.length}
              </p>
              <div className="space-y-2">
                {cols.map((col, idx) => (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={`transition-opacity ${dragging && dragIdx.current === idx ? 'opacity-40' : 'opacity-100'}`}
                  >
                    <ColEditRow
                      col={col}
                      onSave={handleUpdate}
                      onDelete={handleDelete}
                      dragHandleProps={{
                        draggable: false, // handled by parent div
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new column */}
          <div>
            {cols.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAdd(v => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 mb-2 transition-colors"
              >
                {showAdd ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAdd ? 'Cancelar nueva columna' : 'Añadir columna nueva'}
              </button>
            )}
            {showAdd && (
              <form onSubmit={handleAdd} className="border border-dashed border-indigo-300 rounded-xl p-4 bg-indigo-50/40 space-y-3">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Nueva columna</p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Navegador, Responsable..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de campo</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as ColType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="text">Texto Libre</option>
                    <option value="dropdown">Menú Desplegable</option>
                  </select>
                </div>
                {type === 'dropdown' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Opciones <span className="text-gray-400">(separadas por coma)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={options}
                      onChange={e => setOptions(e.target.value)}
                      placeholder="Chrome, Firefox, Safari"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg">
                    Cancelar
                  </button>
                  <button type="submit" className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" /> Añadir columna
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
