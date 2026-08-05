import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { ArrowLeft, Copy, Eye, Check, FlaskConical } from 'lucide-react';

// URL base dinámica — funciona en cualquier entorno (dev, staging, prod)
const PUBLIC_BASE = `${window.location.origin}/#/m`;

type MatrixVersion = {
  id: string;
  version_num: number;
  stage: string;
  matrix_type: string;
  public_uuid: string;
  created_at: string;
  notes?: string;
};

type Folder = {
  id: string;
  ticket_id: string;
  project_name: string;
  personal_matrix_versions: MatrixVersion[];
};

function stageBadge(stage: string) {
  if (stage === 'PRE-DEV') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

function typeBadge(type: string) {
  if (type === 'UI') return 'bg-violet-100 text-violet-700 border-violet-200';
  if (type === 'API') return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-teal-100 text-teal-700 border-teal-200';
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function CopyLinkButton({ uuid }: { uuid: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${PUBLIC_BASE}/${uuid}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copiar enlace público"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
        copied
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copiado' : 'Copiar 🔗'}
    </button>
  );
}

function ViewLinkButton({ uuid }: { uuid: string }) {
  const url = `${PUBLIC_BASE}/${uuid}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Ver matriz pública"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-all"
    >
      <Eye className="w-3.5 h-3.5" />
      Ver 👁
    </a>
  );
}

export default function MySpaceDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email || !ticketId) return;

    async function loadFolder() {
      setLoading(true);
      const { data } = await supabase
        .from('personal_matrix_folders')
        .select('*, personal_matrix_versions(*)')
        .eq('qa_email', user!.email)
        .eq('ticket_id', ticketId)
        .single();

      setFolder(data as Folder | null);
      setLoading(false);
    }

    loadFolder();
  }, [user?.email, ticketId]);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back button */}
      <button
        onClick={() => navigate('/my-space')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Mi Espacio
      </button>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Cargando versiones…
        </div>
      ) : !folder ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <FlaskConical className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500">No se encontró la carpeta para este ticket.</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {folder.ticket_id}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">{folder.project_name}</p>
          </div>

          {/* Versions table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {folder.personal_matrix_versions?.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                No hay versiones para este ticket.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      Versión
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      Notas
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-500 text-xs uppercase tracking-wider">
                      Link público
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...(folder.personal_matrix_versions ?? [])]
                    .sort((a, b) => b.version_num - a.version_num)
                    .map(version => (
                      <tr key={version.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-bold text-gray-800">
                          v{version.version_num}
                        </td>
                        <td className="px-5 py-4 text-gray-600">
                          {formatDate(version.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${stageBadge(version.stage)}`}
                          >
                            {version.stage}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeBadge(version.matrix_type)}`}
                          >
                            {version.matrix_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-500 italic max-w-xs truncate">
                          {version.notes ?? '—'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <CopyLinkButton uuid={version.public_uuid} />
                            <ViewLinkButton uuid={version.public_uuid} />
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
