import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { type ReactElement } from 'react';
import { AuthProvider, useAuth } from './lib/supabase/auth';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cycles from './pages/Cycles';
import Matrix from './pages/Matrix';
import Login from './pages/Login';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import MatrixPublicView from './pages/MatrixPublicView';
import MySpace from './pages/MySpace';
import MySpaceDetail from './pages/MySpaceDetail';

import AcceptInvite from './pages/AcceptInvite';

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const { session, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Public routes — no login required */}
      <Route path="/m/:uuid" element={<MatrixPublicView />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="cycles" element={<Cycles />} />
        <Route path="cycles/:id" element={<Matrix />} />
        <Route path="settings" element={<Settings />} />
        <Route path="my-space" element={<MySpace />} />
        <Route path="my-space/:ticketId" element={<MySpaceDetail />} />
        {/* 404 catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
