import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { Activity, CheckCircle2, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';

export default function Dashboard() {
  const { selectedProject } = useAuth();
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
      setRecentCycles(cycles); // Guardamos TODOS los ciclos, sin slice

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

  // Agrupar ciclos por versión para la vista global
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
            Object.entries(groupedByVersion).map(([versionName, versionCycles]) => (
              <div key={versionName} className="border border-gray-200 rounded-lg p-5">
                <h3 className="text-md font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">
                  Versión: {versionName}
                </h3>
                <div className="space-y-4">
                  {versionCycles.map(cycle => {
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
