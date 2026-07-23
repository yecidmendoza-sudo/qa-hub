import { X, Activity, Search } from 'lucide-react';

interface Props {
  logs: any[];
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onClose: () => void;
}

export default function AuditDrawer({ logs, searchQuery, onSearchChange, onClose }: Props) {
  const filtered = logs.filter(log => {
    const term = searchQuery.toLowerCase();
    return (
      (log.user_email?.toLowerCase().includes(term)) ||
      (log.action?.toLowerCase().includes(term)) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center">
            <Activity className="w-5 h-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-bold text-gray-900">Historial de Auditoría</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-200 rounded-full p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-6 py-3 border-b border-gray-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por email, acción o detalles..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-10">
              {searchQuery ? 'No hay registros que coincidan.' : 'No hay registros de actividad.'}
            </div>
          ) : (
            filtered.map(log => (
              <div key={log.id} className="relative pl-6 border-l-2 border-gray-200 pb-2">
                <span className={`absolute -left-1.5 top-0.5 w-3 h-3 rounded-full ring-4 ring-white ${
                  log.action === 'NEW' ? 'bg-green-500' :
                  log.action === 'DELETED' ? 'bg-red-500' :
                  log.action?.startsWith('Cambió') ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
                <div className="mb-0.5 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                    {log.action} {log.entity_type && `· ${log.entity_type}`}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono ml-2">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-blue-600 font-medium">{log.user_email}</p>
                {log.details && Object.keys(log.details).length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
