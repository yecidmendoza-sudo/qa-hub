import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { Activity, CheckCircle2, XCircle, TrendingUp, Users, Search, ChevronDown, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';

// ── Types ─────────────────────────────────────────────────────────────────────

type MatrixFolder = {
  id: string;
  ticket_id: string;
  project_name: string;
  versions: {
    id: string;
    version_num: number;
    stage: string;
    matrix_type: string;
    public_uuid: string;
  }[];
};

type QAMember = {
  email: string;
  role: string;
  folders: MatrixFolder[];
};

// ── QA Team Section ───────────────────────────────────────────────────────────

function QATeamSection({ role: viewerRole, userProjects }: { role: string; userProjects: { id: string; name: string }[] }) {
  const [members, setMembers]           = useState<QAMember[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterEmail, setFilterEmail]   = useState('');
  const [expandedEmail, setExpandedEmail] = useState<Set<string>>(new Set());

  const isAdmin = viewerRole === 'ADMIN';

  useEffect(() => {
    async function load() {
      setLoading(true);

      // 1. Get list of QA emails to show
      let qaEmails: { email: string; role: string }[] = [];

      if (isAdmin) {
        const { data } = await supabase
          .from('profiles')
          .select('email, role')
          .in('role', ['QA_TESTER', 'QA_LEAD']);
        qaEmails = (data || []) as { email: string; role: string }[];
      } else {
        // QA_LEAD: QA_TESTERs de sus proyectos
        const projectIds = userProjects.map(p => p.id);
        if (projectIds.length === 0) { setLoading(false); return; }
        const { data: assignments } = await supabase
          .from('user_projects')
          .select('profiles(email, role)')
          .in('project_id', projectIds);
        const seen = new Set<string>();
        for (const a of (assignments || []) as any[]) {
          const e = a.profiles?.email;
          const r = a.profiles?.role;
          if (e && r === 'QA_TESTER' && !seen.has(e)) {
            seen.add(e);
            qaEmails.push({ email: e, role: r });
          }
        }
      }

      if (qaEmails.length === 0) { setLoading(false); return; }

      // 2. Load their folders + versions
      const emails = qaEmails.map(q => q.email);
      const { data: rawFolders } = await supabase
        .from('personal_matrix_folders')
        .select('qa_email, id, ticket_id, project_name, personal_matrix_versions(id, version_num, stage, matrix_type, public_uuid)')
        .in('qa_email', emails)
        .order('created_at', { ascending: false });

      // 3. Build member list grouped by email
      const foldersByEmail: Record<string, MatrixFolder[]> = {};
      for (const f of (rawFolders || []) as any[]) {
        if (!foldersByEmail[f.qa_email]) foldersByEmail[f.qa_email] = [];
        foldersByEmail[f.qa_email].push({
          id: f.id,
          ticket_id: f.ticket_id,
          project_name: f.project_name,
          versions: [...(f.personal_matrix_versions || [])].sort(
            (a: any, b: any) => b.version_num - a.version_num
          ),
        });
      }

      setMembers(
        qaEmails.map(q => ({
          email: q.email,
          role: q.role,
          folders: foldersByEmail[q.email] || [],
        }))
      );
      setLoading(false);
    }
    load();
  }, [isAdmin, userProjects]);

  // Unique project names across all members for filter
  const allProjectNames = Array.from(
    new Set(members.flatMap(m => m.folders.map(f => f.project_name)))
  );
  const projectOptions = ['ALL', ...allProjectNames];

  // Filter members whose folders match the project filter
  const filtered = members.filter(m => {
    const matchEmail = !filterEmail || m.email.toLowerCase().includes(filterEmail.toLowerCase());
    const matchProject = filterProject === 'ALL' || m.folders.some(f => f.project_name === filterProject);
    return matchEmail && matchProject;
  });

  const toggleEmail = (email: string) => {
    setExpandedEmail(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" />
          Equipo QA — Matrices
        </h2>
        <span className="text-xs text-gray-400">{members.length} miembros</span>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Proyecto:</label>
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {projectOptions.map(p => (
              <option key={p} value={p}>{p === 'ALL' ? 'Todos' : p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por email..."
            value={filterEmail}
            onChange={e => setFilterEmail(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none w-48"
          />
        </div>
        {(filterProject !== 'ALL' || filterEmail) && (
          <button
            onClick={() => { setFilterProject('ALL'); setFilterEmail(''); }}
            className="text-xs text-blue-600 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="p-6 space-y-3">
        {loading ? (
          <div className="flex items-center gap-3 text-gray-400 py-4 justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Cargando equipo QA…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400">
            {members.length === 0
              ? 'No hay QAs asignados aún. Créalos en Configuración → Gestión de Usuarios.'
              : 'No hay resultados con los filtros actuales.'}
          </p>
        ) : (
          filtered.map(member => {
            const isOpen = expandedEmail.has(member.email);
            const visibleFolders = filterProject === 'ALL'
              ? member.folders
              : member.folders.filter(f => f.project_name === filterProject);
            const totalVersions = visibleFolders.reduce((s, f) => s + f.versions.length, 0);

            return (
              <div key={member.email} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Member header */}
                <button
                  onClick={() => toggleEmail(member.email)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600">
                        {member.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{member.email}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      member.role === 'QA_LEAD'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                      {member.role === 'QA_LEAD' ? 'Lead' : 'Tester'}
                    </span>
                    <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                      {visibleFolders.length} ticket{visibleFolders.length !== 1 ? 's' : ''} · {totalVersions} {totalVersions === 1 ? 'matriz' : 'matrices'}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded: folders + UUID links */}
                {isOpen && (
                  <div className="divide-y divide-gray-100">
                    {visibleFolders.length === 0 ? (
                      <p className="px-5 py-3 text-sm text-gray-400 italic">Sin matrices publicadas.</p>
                    ) : (
                      visibleFolders.map(folder => (
                        <div key={folder.id} className="px-5 py-3 bg-white">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-gray-700">{folder.ticket_id}</span>
                            <span className="text-xs text-gray-400">— {folder.project_name}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {folder.versions.map(v => (
                              <a
                                key={v.id}
                                href={`${window.location.origin}/#/m/${v.public_uuid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-700"
                              >
                                <span className={`inline-block w-2 h-2 rounded-full ${
                                  v.stage === 'PRE-DEV' ? 'bg-amber-400' : 'bg-green-400'
                                }`} />
                                v{v.version_num} · {v.stage} · {v.matrix_type}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────

export default function Dashboard() {
  const { selectedProject, profile, userProjects } = useAuth();
  const canSeeTeam = ['ADMIN', 'QA_LEAD'].includes(profile?.role ?? '');

  const [stats, setStats] = useState({
    projects: 0,
    passed: 0,
    failed: 0,
    blocked: 0
  });
  
  const [recentCycles, setRecentCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!selectedProject) return;
      setLoading(true);
      
      const { data: cyclesData } = await supabase
        .from('test_cycles')
        .select(`
          id, version, type, status, custom_values,
          project:projects(name)
        `)
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: false });

      const cycles = cyclesData || [];
      setRecentCycles(cycles);

      let passCount = 0, failCount = 0, inProgressCount = 0;
      cycles.forEach(cycle => {
        if (cycle.status === 'PASSED') passCount++;
        if (cycle.status === 'FAILED') failCount++;
        if (cycle.status === 'IN_PROGRESS') inProgressCount++;
      });

      setStats({
        projects: 1, 
        passed: passCount,
        failed: failCount,
        blocked: inProgressCount
      });

      setLoading(false);
    }
    
    loadDashboard();
  }, [selectedProject]);

  const groupedByVersion = recentCycles.reduce((acc, cycle) => {
    const vName = cycle.version || 'Desconocida';
    if (!acc[vName]) acc[vName] = [];
    acc[vName].push(cycle);
    return acc;
  }, {} as Record<string, any[]>);

  if (!selectedProject) {
    return <div className="p-8 text-center text-gray-500">Selecciona un proyecto en el menú lateral para ver las métricas.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard: {selectedProject.name}</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Ciclos Exitosos (PASSED)</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.passed}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Ciclos Fallidos (FAILED)</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.failed}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Ciclos en Progreso</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats.blocked}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Cycles history */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Histórico Global de Ciclos por Versión
          </h2>
        </div>
        
        <div className="p-6 space-y-8">
          {loading ? (
             <div className="text-gray-400">Cargando métricas...</div>
          ) : recentCycles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-400">
              <p>Este proyecto aún no tiene ciclos de pruebas.</p>
            </div>
          ) : (
            Object.entries(groupedByVersion).map(([versionName, versionCycles]) => {
              const cycles = versionCycles as any[];
              return (
              <div key={versionName} className="border border-gray-200 rounded-lg p-5">
                <h3 className="text-md font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">
                  Versión: {versionName}
                </h3>
                <div className="space-y-4">
                  {cycles.map(cycle => {
                    let percentage = 0;
                    if (cycle.status === 'PASSED' || cycle.status === 'FAILED') percentage = 100;
                    else if (cycle.status === 'IN_PROGRESS') percentage = 50;

                    const customInfo = cycle.custom_values 
                      ? Object.entries(cycle.custom_values).map(([k,v]) => `${k}: ${v}`).join(' | ') 
                      : '';

                    return (
                      <div key={cycle.id} className="group pl-2 border-l-2 border-gray-200">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-gray-700">
                            <Link to={`/cycles/${cycle.id}`} className="hover:text-blue-600 transition-colors">
                              {cycle.type} {customInfo ? `— [ ${customInfo} ]` : ''}
                            </Link>
                          </span>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            cycle.status === 'PASSED' ? 'bg-green-100 text-green-700' : 
                            cycle.status === 'FAILED' ? 'bg-red-100 text-red-700' : 
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {cycle.status}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-1000 ${
                              cycle.status === 'PASSED' ? 'bg-green-500' : 
                              cycle.status === 'FAILED' ? 'bg-red-500' : 
                              'bg-blue-600'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* QA Team Section — para ADMIN y QA_LEAD */}
      {canSeeTeam && (
        <QATeamSection
          role={profile?.role ?? ''}
          userProjects={userProjects}
        />
      )}
    </div>
  );
}
