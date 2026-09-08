import { useState, useRef, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface TextCellPopoverProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  previewLength?: number;
  readOnly?: boolean;
}

export default function TextCellPopover({
  value,
  onSave,
  placeholder = 'Sin texto...',
  previewLength = 55,
  readOnly = false,
}: TextCellPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when value changes externally
  useEffect(() => { setDraft(value); }, [value]);

  // Calculate fixed position from trigger rect so overflow-hidden never clips it
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 340;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = rect.left;
    if (left + popoverWidth > viewportWidth - 12) {
      left = Math.max(8, rect.right - popoverWidth);
    }

    let top = rect.bottom + 4;
    // Flip above if not enough space below (360px = header + textarea max-h + footer)
    if (top + 360 > viewportHeight - 12) {
      top = Math.max(8, rect.top - 364);
    }

    setPopoverStyle({ position: 'fixed', top, left, width: popoverWidth, zIndex: 9999 });
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setDraft(value); // discard unsaved changes
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, value]);

  // Close on scroll — but ONLY when the scroll happens outside the popover.
  // Without this check, scrolling inside the textarea itself closed the popover.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: Event) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        // Scroll happened inside the popover (e.g. inside the textarea) — ignore
        return;
      }
      setIsOpen(false);
    };
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [isOpen]);

  // Auto-focus textarea when popover opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave(draft);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setIsOpen(false); setDraft(value); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
  };

  const preview = value
    ? value.length > previewLength
      ? value.slice(0, previewLength) + '…'
      : value
    : '';

  return (
    <div className="relative">
      {/* Trigger cell */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(prev => !prev)}
        className={`
          w-full text-left text-xs leading-relaxed px-1 py-0.5 rounded
          transition-colors group
          ${value
            ? 'text-gray-700 hover:text-gray-900 hover:bg-indigo-50'
            : 'text-gray-400 italic hover:bg-gray-50'
          }
          ${isOpen ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''}
        `}
        title={value || placeholder}
      >
        {preview || <span className="text-gray-400 italic">{placeholder}</span>}
      </button>

      {/* Popover — rendered via fixed positioning to escape any overflow:hidden ancestor */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="bg-white border border-indigo-200 rounded-xl shadow-xl p-3 flex flex-col gap-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
              {readOnly ? 'Detalle' : 'Editar'}
            </span>
            <button
              onClick={() => { setIsOpen(false); setDraft(value); }}
              className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Textarea — max-h keeps the popover in viewport; resize-y lets user expand within that limit */}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            placeholder={placeholder}
            rows={5}
            className={`
              w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-2.5
              resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 leading-relaxed
              max-h-64 overflow-y-auto
              ${readOnly ? 'bg-gray-50 cursor-default' : 'bg-white'}
            `}
          />

          {/* Footer */}
          {!readOnly && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">Ctrl+Enter para guardar</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsOpen(false); setDraft(value); }}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  <Save className="w-3 h-3" />
                  Guardar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
