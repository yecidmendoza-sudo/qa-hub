import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, Beaker, LogOut, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/supabase/auth';

export default function Layout() {
  const location = useLocation();
  const { profile, signOut, userProjects, selectedProject, setSelectedProject } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Proyectos', path: '/projects', icon: FolderKanban },
    { name: 'Ciclos de Pruebas', path: '/cycles', icon: Beaker },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 justify-between">
        <div>
          <span className="text-xl font-bold text-blue-600">QA Hub</span>
          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">v2.0</span>
        </div>
        {/* Close button - solo mobile */}
        <button
          className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          onClick={closeSidebar}
        >
          <X className="h-5 w-5" />
        </button>
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

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={closeSidebar}
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

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="mb-4 px-4 py-2 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-900 truncate">{profile?.email}</p>
          <p className="text-xs text-gray-500">{profile?.role}</p>
        </div>
        <Link
          to="/settings"
          onClick={closeSidebar}
          className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
        >
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
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">

      {/* ── SIDEBAR DESKTOP (siempre visible en lg+) ── */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col">
        <SidebarContent />
      </aside>

      {/* ── OVERLAY MOBILE (backdrop oscuro) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── SIDEBAR MOBILE (drawer deslizable) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar mobile */}
        <header className="lg:hidden h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-lg font-bold text-blue-600">QA Hub</span>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">v2.0</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
