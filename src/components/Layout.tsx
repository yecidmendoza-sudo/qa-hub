import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, Beaker, LogOut, ChevronDown, Menu, X, FolderOpen, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useAuth } from '../lib/supabase/auth';

export default function Layout() {
  const location = useLocation();
  const { signOut, userProjects, selectedProject, setSelectedProject, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Collapsed state persisted in localStorage
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('qa-hub-sidebar-collapsed') === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('qa-hub-sidebar-collapsed', String(collapsed)); }
    catch {}
  }, [collapsed]);

  const isAdminOrLead = profile?.role === 'ADMIN' || profile?.role === 'QA_LEAD';

  const navItems = [
    { name: 'Dashboard',        path: '/',         icon: LayoutDashboard, show: true },
    { name: 'Proyectos',        path: '/projects', icon: FolderKanban,    show: isAdminOrLead },
    { name: 'Ciclos de Pruebas',path: '/cycles',   icon: Beaker,          show: true },
    { name: 'Mi Espacio',       path: '/my-space', icon: FolderOpen,      show: true },
  ];

  // ── Sidebar content (shared between desktop & mobile) ─────────────────────
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo + collapse toggle */}
      <div className={`h-16 flex items-center border-b border-gray-200 justify-between flex-shrink-0 ${collapsed && !isMobile ? 'px-3' : 'px-5'}`}>
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-xl font-bold text-blue-600 whitespace-nowrap">QA Hub</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full whitespace-nowrap">v2.0</span>
          </div>
        )}

        {/* Desktop collapse toggle */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors ${collapsed ? 'mx-auto' : 'ml-auto'}`}
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        )}

        {/* Mobile close */}
        {isMobile && (
          <button
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Project Selector — hidden when collapsed (desktop) */}
      {(!collapsed || isMobile) && (
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
            Proyecto Activo
          </label>
          <div className="relative">
            <select
              className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-gray-50 border appearance-none font-medium text-gray-700"
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
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.show).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              title={collapsed && !isMobile ? item.name : undefined}
              className={`flex items-center rounded-lg transition-colors ${
                collapsed && !isMobile
                  ? 'justify-center px-2 py-3'
                  : 'px-4 py-3 gap-3'
              } text-sm font-medium ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
              {(!collapsed || isMobile) && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={`border-t border-gray-200 flex-shrink-0 ${collapsed && !isMobile ? 'p-2' : 'p-4'}`}>
        {(!collapsed || isMobile) && (
          <div className="mb-3 px-4 py-2 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900 truncate">{profile?.email}</p>
            <p className="text-xs text-gray-500">{profile?.role}</p>
          </div>
        )}

        <Link
          to="/settings"
          onClick={() => setMobileOpen(false)}
          title={collapsed && !isMobile ? 'Configuración' : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors ${
            collapsed && !isMobile ? 'justify-center px-2 py-2.5' : 'px-4 py-2 gap-3 w-full'
          }`}
        >
          <Settings className="h-5 w-5 text-gray-400 flex-shrink-0" />
          {(!collapsed || isMobile) && 'Configuración'}
        </Link>

        <button
          onClick={signOut}
          title={collapsed && !isMobile ? 'Cerrar Sesión' : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mt-1 ${
            collapsed && !isMobile ? 'justify-center px-2 py-2.5 w-full' : 'px-4 py-2 gap-3 w-full'
          }`}
        >
          <LogOut className="h-5 w-5 text-red-500 flex-shrink-0" />
          {(!collapsed || isMobile) && 'Cerrar Sesión'}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">

      {/* ── SIDEBAR DESKTOP — collapsible ── */}
      <aside
        className={`hidden lg:flex bg-white border-r border-gray-200 flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── OVERLAY MOBILE ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── SIDEBAR MOBILE (drawer) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent isMobile />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar mobile */}
        <header className="lg:hidden h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
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
