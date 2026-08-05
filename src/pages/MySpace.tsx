import { useState, useEffect } from 'react';
import { useAuth } from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { FolderOpen, Search, FlaskConical, ChevronDown, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 10;

type MatrixVersion = {
  id: string;
  version_num: number;
  stage: string;
  matrix_type: string;
  public_uuid: string;
  created_at: string;
  notes?: string | null;
};

type Folder = {
  id: string;
  ticket_id: string;
  project_name: string;
  created_at: string;
  personal_matrix_versions: MatrixVersion[];
};

function stageBadge(stage: string) {
  if (stage === 'PRE-DEV') return 'bg-amber-100 text-amber-700 border border-amber-200';
  return 'bg-green-100 text-green-700 border border-green-200';
}

function typeBadge(type: string) {
  if (type === 'UI') return 'bg-violet-100 text-violet-700 border border-violet-200';
  if (type === 'API') return 'bg-blue-100 text-blue-700 border border-blue-200';
  return 'bg-teal-100 text-teal-700 border border-teal-200';
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-CO', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function MySpace() {
  const { user, profile } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.email) return;
    async function loadFolders() {
      setLoading(true);
      const { data } = await supabase
        .from('personal_matrix_folders')
        .select('*, personal_matrix_versions(id, version_num, stage, matrix_type, public_uuid, created_at, notes)')
        .eq('qa_email', user!.email)
        .order('created_at', { ascending: false });

      const sorted = (data as Folder[] || []).map(folder => ({
        ...folder,
        personal_matrix_versions: [...(folder.personal_matrix_versions || [])].sort(
          (a, b) => b.version_num - a.version_num
        )
      }));

      setFolders(sorted);
      setLoading(false);
    }
    loadFolders();
  }, [user?.email]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [search]);

  const filtered = folders.filter(f =>
    f.ticket_id.toLowerCase().includes(search.toLowerCase()) ||
    f.project_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleTicket = (ticketId: string) => {
    setExpandedTickets(prev => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-blue-600" />
            Mi Espacio
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{profile?.email ?? user?.email}</p>
        </div>
        {filtered.length > 0 && (
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full font-medium">
            {filtered.length} {filtered.length === 1 ? 'ticket' : 'tickets'} · {folders.reduce((a, f) => a + (f.personal_matrix_versions?.length ?? 0), 0)} matrices
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por ticket o proyecto…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Cargando matrices…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <FlaskConical className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500 font-medium">
            {search
              ? 'No se encontraron matrices con ese criterio.'
              : 'No tienes matrices guardadas aún. Usa ticket-analyst para generar tu primera matriz.'}
          </p>
        </div>
      ) : (
        <>
          {/* Accordion list */}
          <div className="space-y-2">
            {paginated.map(folder => {
              const versions = folder.personal_matrix_versions ?? [];
              const isExpanded = expandedTickets.has(folder.ticket_id);
              const latest = versions[0]; // ya ordenado desc por version_num

              return (
                <div
                  key={folder.id}
                  className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                    isExpanded ? 'border-blue-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Ticket header (clickable) */}
                  <button
                    onClick={() => toggleTicket(folder.ticket_id)}
                    className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
                      isExpanded ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-base">{folder.ticket_id}</span>
                        <span className="text-gray-400 text-sm">—</span>
                        <span className="text-gray-600 text-sm">{folder.project_name}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                          {versions.length} {versions.length === 1 ? 'versión' : 'versiones'}
                        </span>
                      </div>
                      {/* Latest version preview (solo cuando collapsed) */}
                      {!isExpanded && latest && (
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageBadge(latest.stage)}`}>
                            {latest.stage}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge(latest.matrix_type)}`}>
                            {latest.matrix_type}
                          </span>
                          <span className="text-xs text-gray-400">
                            Última: {formatDate(latest.created_at)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={`flex-shrink-0 ml-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>

                  {/* Expanded: list of all versions */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {versions.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-gray-400 italic">Sin versiones guardadas.</p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {versions.map(v => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between px-5 py-3 bg-white hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-wrap min-w-0">
                                <span className="text-xs font-bold text-gray-500 flex-shrink-0">v{v.version_num}</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${stageBadge(v.stage)}`}>
                                  {v.stage}
                                </span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${typeBadge(v.matrix_type)}`}>
                                  {v.matrix_type}
                                </span>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {formatDateTime(v.created_at)}
                                </span>
                                {v.notes && (
                                  <span className="text-xs text-gray-500 italic truncate max-w-xs">{v.notes}</span>
                                )}
                              </div>
                              <a
                                href={`${window.location.origin}/#/m/${v.public_uuid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex-shrink-0 ml-4 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Ver <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-500">
                Página {page} de {totalPages} · {filtered.length} tickets
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = totalPages <= 5 ? i + 1 :
                    page <= 3 ? i + 1 :
                    page >= totalPages - 2 ? totalPages - 4 + i :
                    page - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
