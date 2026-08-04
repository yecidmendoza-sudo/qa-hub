import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { ShieldAlert, Users, MailPlus, ChevronDown, ChevronRight, Check } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Project = { id: string; name: string };
type ProfileRow = { email: string; role: string };
type VersionStat = { id: string; stage: string; created_at: string };
type FolderStat = { qa_email: string; project_id: string; personal_matrix_versions: VersionStat[] };

type QAStat = {
  email: string;
  folderCount: number;
  versionCount: number;
  lastActivity: string | null;
};

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'ok' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium border transition-all ${
        type === 'ok'
          ? 'bg-green-50 text-green-800 border-green-200'
          : 'bg-red-50 text-red-800 border-red-200'
      }`}
    >
      {type === 'ok' ? <Check className="w-4 h-4 text-green-600" /> : <ShieldAlert className="w-4 h-4 text-red-600" />}
      {message}
    </div>
  );
}

// ── Section A: QA Team Overview ───────────────────────────────────────────────

function QATeamSection() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [qaStats, setQaStats] = useState<Record<string, QAStat[]>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // 1. Get all projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      const projects: Project[] = projectsData || [];
      setProjects(projects);

      // 2. For each project get assignments + folder stats
      const statsMap: Record<string, QAStat[]> = {};

      for (const project of projects) {
        // Get assigned QA users
        const { data: assignments } = await supabase
          .from('user_projects')
          .select('user_id, project_id, profiles(email, role)')
          .eq('project_id', project.id);

        const assignmentsData = (assignments ?? []) as Array<{
          user_id: string;
          project_id: string;
          profiles: ProfileRow | ProfileRow[] | null;
        }>;

        function getProfile(a: typeof assignmentsData[number]): ProfileRow | null {
          if (!a.profiles) return null;
          return Array.isArray(a.profiles) ? (a.profiles[0] ?? null) : a.profiles;
        }

        const qaUsers = assignmentsData
          .map(a => ({ ...a, profile: getProfile(a) }))
          .filter(a => a.profile?.role === 'QA_TESTER');

        // Get folder stats for this project
        const { data: folders } = await supabase
          .from('personal_matrix_folders')
          .select('qa_email, project_id, personal_matrix_versions(id, stage, created_at)')
          .eq('project_id', project.id);

        const foldersData: FolderStat[] = (folders as FolderStat[]) || [];

        // Build per-QA stats
        const perQa: QAStat[] = qaUsers.map(qa => {
          const email = qa.profile?.email ?? '—';
          const qaFolders = foldersData.filter(f => f.qa_email === email);
          const allVersions = qaFolders.flatMap(f => f.personal_matrix_versions ?? []);
          const lastActivity = allVersions.length
            ? allVersions.reduce((latest, v) =>
                new Date(v.created_at) > new Date(latest) ? v.created_at : latest,
                allVersions[0].created_at
              )
            : null;

          return {
            email,
            folderCount: qaFolders.length,
            versionCount: allVersions.length,
            lastActivity,
          };
        });

        statsMap[project.id] = perQa;
      }

      setQaStats(statsMap);

      // Expand first project by default
      if (projects.length > 0) {
        setOpen({ [projects[0].id]: true });
      }

      setLoading(false);
    }

    loadData();
  }, []);

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return 'Sin actividad';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} hr${hours > 1 ? 's' : ''}`;
    return `hace ${Math.floor(hours / 24)} día(s)`;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Cargando equipo…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map(project => {
        const stats = qaStats[project.id] ?? [];
        const isOpen = !!open[project.id];
        return (
          <div key={project.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(o => ({ ...o, [project.id]: !o[project.id] }))}
              className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="font-bold text-gray-800">{project.name}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                  {stats.length} QA{stats.length !== 1 ? 's' : ''}
                </span>
              </div>
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {isOpen && (
              <div className="border-t border-gray-100">
                {stats.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400 italic">
                    No hay QAs asignados a este proyecto.
                  </p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-white border-b border-gray-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Matrices
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Última actividad
                        </th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {stats.map(qa => (
                        <tr key={qa.email} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-gray-800">{qa.email}</td>
                          <td className="px-5 py-3 text-gray-600">
                            {qa.folderCount} {qa.folderCount === 1 ? 'folder' : 'folders'},{' '}
                            {qa.versionCount} {qa.versionCount === 1 ? 'versión' : 'versiones'}
                          </td>
                          <td className="px-5 py-3 text-gray-500">{timeAgo(qa.lastActivity)}</td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => navigate(`/my-space`)}
                              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                            >
                              Ver matrices
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section B: Invite QA ──────────────────────────────────────────────────────

function InviteQASection() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [email, setEmail] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'error' } | null>(null);

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setProjects(data || []));
  }, []);

  function showToast(message: string, type: 'ok' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  function toggleProject(id: string) {
    setSelectedProjectIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || selectedProjectIds.length === 0) {
      showToast('Por favor ingresa un email y selecciona al menos un proyecto.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        'https://leexvmoadhzwthzcbhph.supabase.co/functions/v1/admin-invite-user',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_AGENT_API_KEY ?? '',
          },
          body: JSON.stringify({ email: email.trim(), project_ids: selectedProjectIds }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
        showToast(`Error: ${err.error ?? err.message ?? 'Error al enviar invitación'}`, 'error');
      } else {
        showToast(`✅ Invitación enviada a ${email.trim()}`, 'ok');
        setEmail('');
        setSelectedProjectIds([]);
      }
    } catch (err: any) {
      showToast(`Error de red: ${err.message ?? 'Inténtalo de nuevo'}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <MailPlus className="w-5 h-5 text-blue-600" />
        <h2 className="text-base font-bold text-gray-800">Invitar nuevo QA</h2>
      </div>

      <form onSubmit={handleInvite} className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Email del QA</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="qa@shipedge.com"
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">Proyectos</label>
          <div className="flex flex-wrap gap-3">
            {projects.map(p => {
              const checked = selectedProjectIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-all select-none ${
                    checked
                      ? 'bg-blue-50 border-blue-400 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProject(p.id)}
                    className="sr-only"
                  />
                  {checked ? (
                    <Check className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <span className="w-3.5 h-3.5 border border-gray-300 rounded-sm inline-block" />
                  )}
                  {p.name}
                </label>
              );
            })}
            {projects.length === 0 && (
              <span className="text-sm text-gray-400">Cargando proyectos…</span>
            )}
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {loading ? 'Enviando…' : 'Enviar Invitación'}
          </button>
        </div>
      </form>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminBoard() {
  const { profile } = useAuth();

  // 403 for non-admins
  if (profile && profile.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-400" />
        <h1 className="text-2xl font-bold text-gray-900">403 — Acceso Denegado</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          No tienes permisos para ver esta página. Contacta al administrador del sistema.
        </p>
      </div>
    );
  }

  // While profile is loading, show spinner
  if (!profile) {
    return (
      <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Verificando permisos…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Board</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de equipo y accesos del sistema</p>
      </div>

      {/* Section B: Invite — shown first for quick action */}
      <InviteQASection />

      {/* Section A: QA Team Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-800">Vista por Proyecto — Actividad QA</h2>
        </div>
        <div className="p-6">
          <QATeamSection />
        </div>
      </div>
    </div>
  );
}
