import { useState, useEffect, useRef, useMemo } from 'react';
import { Filter, X, CheckSquare, Square, Search } from 'lucide-react';

interface ColumnFilterDropdownProps {
  colId: string;
  colName: string;
  /** All unique values available for this column */
  uniqueValues: string[];
  /** Currently selected values (empty Set = no filter = show all) */
  selected: Set<string>;
  onApply: (selected: Set<string>) => void;
  onClear: () => void;
  /** Extra label formatter — e.g. status emoji mapping */
  formatLabel?: (val: string) => string;
}

export default function ColumnFilterDropdown({
  colId,
  colName,
  uniqueValues,
  selected,
  onApply,
  onClear,
  formatLabel,
}: ColumnFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Local draft while popover is open (committed on Apply)
  const [draft, setDraft] = useState<Set<string>>(new Set(selected));
  const containerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const hasActiveFilter = selected.size > 0;

  // Sync draft when parent selection changes or popover opens
  useEffect(() => {
    if (open) setDraft(new Set(selected));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropRef.current &&
        !dropRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Filter unique values by search
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? uniqueValues.filter(v => v.toLowerCase().includes(q))
      : uniqueValues;
  }, [uniqueValues, search]);

  const allChecked = filtered.length > 0 && filtered.every(v => draft.has(v));
  const someChecked = filtered.some(v => draft.has(v));

  const toggleValue = (val: string) => {
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) {
      // Uncheck all filtered
      setDraft(prev => {
        const next = new Set(prev);
        filtered.forEach(v => next.delete(v));
        return next;
      });
    } else {
      // Check all filtered
      setDraft(prev => {
        const next = new Set(prev);
        filtered.forEach(v => next.add(v));
        return next;
      });
    }
  };

  const handleApply = () => {
    onApply(new Set(draft));
    setOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    setDraft(new Set());
    onClear();
    setOpen(false);
    setSearch('');
  };

  // Position dropdown below the button
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const openDropdown = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
    setOpen(true);
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        ref={btnRef}
        id={`col-filter-btn-${colId}`}
        onClick={openDropdown}
        title={`Filtrar por ${colName}`}
        className={`flex items-center justify-center w-5 h-5 rounded transition-all ${
          hasActiveFilter
            ? 'text-blue-600 bg-blue-100 opacity-100'
            : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100'
        }`}
      >
        <Filter className="w-3 h-3" />
        {hasActiveFilter && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
        )}
      </button>

      {open && dropPos && (
        <div
          ref={dropRef}
          style={{ top: dropPos.top, left: dropPos.left }}
          className="fixed z-[9999] w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider truncate">
              Filtrar: {colName}
            </span>
            <button
              onClick={() => { setOpen(false); setSearch(''); }}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search inside dropdown */}
          {uniqueValues.length > 6 && (
            <div className="px-2 pt-2">
              <div className="relative">
                <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar valor..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                />
              </div>
            </div>
          )}

          {/* Select all */}
          {filtered.length > 1 && (
            <button
              onClick={toggleAll}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              {allChecked
                ? <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                : someChecked
                ? <div className="w-3.5 h-3.5 border-2 border-blue-400 rounded-sm bg-blue-100 flex items-center justify-center">
                    <div className="w-1.5 h-0.5 bg-blue-500 rounded" />
                  </div>
                : <Square className="w-3.5 h-3.5 text-gray-300" />
              }
              <span className="font-medium">
                {allChecked ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </span>
            </button>
          )}

          {/* Values list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                Sin resultados para "{search}"
              </div>
            ) : (
              filtered.map(val => (
                <label
                  key={val}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer transition-colors text-xs text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={draft.has(val)}
                    onChange={() => toggleValue(val)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-400 cursor-pointer"
                  />
                  <span className="truncate flex-1">
                    {formatLabel ? formatLabel(val) : val || '(vacío)'}
                  </span>
                </label>
              ))
            )}
          </div>

          {/* Footer: Apply + Clear */}
          <div className="flex gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleApply}
              className="flex-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Aplicar
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
