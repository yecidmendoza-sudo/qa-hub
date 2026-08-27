import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { Activity, CheckCircle2, XCircle, TrendingUp, Users, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';

// ── QA Team Section (solo ADMIN) ──────────────────────────────────────────────

type QAMember = {
  user_id: string;
  email: string;
  project_id: string;
  project_name: string;
  matrix_count: number;
  role: string;
};

function QATeamSection() {
  const [members, setMembers] = useState<QAMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterEmail, setFilterEmail] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Get all user-project assignments with profile and project info
      const { data: assignments } = await supabase
        .from('user_projects')
        .select('user_id, project_id, profiles(email, role), projects(name)')
        .order('project_id');

      if (!assignments) { setLoading(false); return; }

      // Include both QA_TESTER and QA_LEAD
      const qaAssignments = assignments.filter(
        (a: any) => ['QA_TESTER', 'QA_LEAD'].includes(a.profiles?.role)
      );

      // Get matrix counts per QA per project
      const memberList: QAMember[] = [];
      for (const a of qaAssignments as any[]) {
        const email = a.profiles?.email || '';
        const role  = a.profiles?.role  || 'QA_TESTER';
        const { count } = await supabase
          .from('personal_matrix_folders')
          .select('*', { count: 'exact', head: true })
          .eq('qa_email', email);

        memberList.push({
          user_id: a.user_id,
          email,
          project_id: a.project_id,
          project_name: a.projects?.name || 'Desconocido',
          matrix_count: count || 0,
          role,
        });
      }

      setMembers(memberList);
      setLoading(false);
    }
    load();
  }, []);

  // Unique projects for filter
  const projectNames = ['ALL', ...Array.from(new Set(members.map(m => m.project_name)))];

  // Filter members
  const filtered = members.filter(m => {
    const matchProject = filterProject === 'ALL' || m.project_name === filterProject;
    const matchEmail = !filterEmail || m.email.toLowerCase().includes(filterEmail.toLowerCase());
    return matchProject && matchEmail;
  });

  // Group by project
  const grouped = filtered.reduce((acc, m) => {
    if (!acc[m.project_name]) acc[m.project_name] = [];
    acc[m.project_name].push(m);
    return acc;
  }, {} as Record<string, QAMember[]>);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" />
          Equipo QA por Proyecto
        </h2>
        <span className="text-xs text-gray-400">{members.length} QAs totales</span>
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
            {projectNames.map(p => (
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

      <div className="p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-400">Cargando equipo QA...</p>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-gray-400">
            {members.length === 0
              ? 'No hay QAs asignados aún. Créalos en Configuración → Gestión de Usuarios.'
              : 'No hay resultados con los filtros actuales.'}
          </p>
        ) : (
          Object.entries(grouped).map(([projectName, projectMembers]) => {
            const isCollapsed = collapsed[projectName];
            return (
              <div key={projectName} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [projectName]: !c[projectName] }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-800 text-sm">{projectName}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                      {projectMembers.length} QA{projectMembers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {isCollapsed
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronUp className="w-4 h-4 text-gray-400" />}
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-gray-100">
                    {projectMembers.map(m => (
                      <div key={m.user_id + m.project_id}
                          className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-600">
                                {m.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm text-gray-700">{m.email}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              m.role === 'QA_LEAD'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-blue-50 text-blue-600 border-blue-200'
                            }`}>
                              {m.role === 'QA_LEAD' ? 'Lead' : 'Tester'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                              {m.matrix_count} {m.matrix_count === 1 ? 'matriz' : 'matrices'}
                            </span>
                          </div>
                        </div>
                    ))}
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
  const { selectedProject, profile } = useAuth();
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
      {canSeeTeam && <QATeamSection />}
    </div>
  );
}
