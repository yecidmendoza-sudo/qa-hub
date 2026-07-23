import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, Beaker, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/supabase/auth';

export default function Layout() {
  const location = useLocation();
  const { profile, signOut, userProjects, selectedProject, setSelectedProject } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Proyectos', path: '/projects', icon: FolderKanban },
    { name: 'Ciclos de Pruebas', path: '/cycles', icon: Beaker },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 justify-between">
          <div>
            <span className="text-xl font-bold text-blue-600">QA Hub</span>
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">v2.0</span>
          </div>
        </div>
        
        {/* Project Selector */}
        <div className="p-4 border-b border-gray-100">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Proyecto Activo
          </label>
          <div className="relative">
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-gray-50 border appearance-none font-medium text-gray-700"
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const project = userProjects.find(p => p.id === e.target.value);
                if (project) setSelectedProject(project);
              }}
              disabled={userProjects.length === 0}
            >
              {userProjects.length === 0 && <option value="">Sin acceso a proyectos</option>}
              {userProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-4 px-4 py-2 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.email}</p>
            <p className="text-xs text-gray-500">{profile?.role}</p>
          </div>
          
          <Link to="/settings" className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            <Settings className="mr-3 h-5 w-5 text-gray-400" />
            Configuración
          </Link>
          <button 
            onClick={signOut}
            className="flex items-center w-full mt-1 px-4 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 text-red-500" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
