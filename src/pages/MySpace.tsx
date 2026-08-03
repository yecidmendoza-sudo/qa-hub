import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { FolderOpen, Search, ChevronRight, FlaskConical } from 'lucide-react';

type MatrixVersion = {
  id: string;
  version_num: number;
  stage: string;
  matrix_type: string;
  public_uuid: string;
  created_at: string;
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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MySpace() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user?.email) return;

    async function loadFolders() {
      setLoading(true);
      const { data } = await supabase
        .from('personal_matrix_folders')
        .select(
          '*, personal_matrix_versions(id, version_num, stage, matrix_type, public_uuid, created_at)'
        )
        .eq('qa_email', user!.email)
        .order('created_at', { ascending: false });

      setFolders((data as Folder[]) || []);
      setLoading(false);
    }

    loadFolders();
  }, [user?.email]);

  const filtered = folders.filter(f =>
    f.ticket_id.toLowerCase().includes(search.toLowerCase())
  );

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
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por ticket ID…"
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
              ? 'No se encontraron matrices con ese ticket ID.'
              : 'No tienes matrices guardadas aún. Usa ticket-analyst para generar tu primera matriz.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filtered.map(folder => {
              const versions = folder.personal_matrix_versions ?? [];
              const latest = versions[0];
              const lastUpdated = versions.reduce((latest, v) =>
                new Date(v.created_at) > new Date(latest.created_at) ? v : latest,
                versions[0]
              );

              return (
                <button
                  key={folder.id}
                  onClick={() => navigate(`/my-space/${folder.ticket_id}`)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-base">{folder.ticket_id}</span>
                      <span className="text-gray-400 text-sm">—</span>
                      <span className="text-gray-600 text-sm">{folder.project_name}</span>
                      {versions.length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                          {versions.length} {versions.length === 1 ? 'versión' : 'versiones'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {latest && (
                        <>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stageBadge(latest.stage)}`}>
                            {latest.stage}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeBadge(latest.matrix_type)}`}>
                            {latest.matrix_type}
                          </span>
                        </>
                      )}
                      {lastUpdated && (
                        <span className="text-xs text-gray-400">
                          Actualizado: {formatDate(lastUpdated.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 flex-shrink-0 ml-4 transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
