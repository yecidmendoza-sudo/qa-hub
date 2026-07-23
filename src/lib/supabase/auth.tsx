import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';

type Project = {
  id: string;
  name: string;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: any | null;
  signOut: () => void;
  loading: boolean;
  userProjects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project) => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  signOut: () => {},
  loading: true,
  userProjects: [],
  selectedProject: null,
  setSelectedProject: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndProjects(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndProjects(session.user.id);
      } else {
        setProfile(null);
        setUserProjects([]);
        setSelectedProject(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfileAndProjects(userId: string) {
    // 1. Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    setProfile(profileData);

    // 2. Fetch Allowed Projects
    // If Admin, fetch all. If QA, fetch only assigned.
    let projectsData: Project[] = [];
    if (profileData?.role === 'ADMIN') {
      const { data } = await supabase.from('projects').select('id, name').order('name');
      projectsData = data || [];
    } else {
      const { data } = await supabase
        .from('user_projects')
        .select('project:projects(id, name)')
        .eq('user_id', userId);
      
      projectsData = (data || []).map((p: any) => p.project).sort((a, b) => a.name.localeCompare(b.name));
    }

    setUserProjects(projectsData);
    if (projectsData.length > 0) {
      const savedProjectId = localStorage.getItem('selectedProjectId');
      const found = projectsData.find(p => p.id === savedProjectId);
      if (found) {
        setSelectedProject(found);
      } else {
        setSelectedProject(projectsData[0]);
        localStorage.setItem('selectedProjectId', projectsData[0].id);
      }
    }
    
    setLoading(false);
  }

  const handleSetSelectedProject = (project: Project) => {
    setSelectedProject(project);
    localStorage.setItem('selectedProjectId', project.id);
  };

  const signOut = async () => {
    localStorage.removeItem('selectedProjectId');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, signOut, loading, userProjects, selectedProject, setSelectedProject: handleSetSelectedProject }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
