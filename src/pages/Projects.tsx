import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { FolderKanban, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/supabase/auth';

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const navigate = useNavigate();
  const { setSelectedProject } = useAuth();

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').order('name');
    if (data) setProjects(data);
    setLoading(false);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsSaving(true);
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name: newProjectName.trim() }])
      .select()
      .single();

    if (!error && data) {
      setProjects([...projects, data].sort((a, b) => a.name.localeCompare(b.name)));
      setIsModalOpen(false);
      setNewProjectName('');
      // Update global context so the user can immediately use it
      // For a real app, you might also need to add it to 'user_projects' if RBAC is active
    }
    setIsSaving(false);
  }

  function handleProjectClick(project: any) {
    setSelectedProject(project);
    navigate('/cycles');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Proyectos</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Añadir Proyecto
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-500">Cargando proyectos...</div>
        ) : (
          projects.map(project => (
            <div 
              key={project.id} 
              onClick={() => handleProjectClick(project)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
            >
              <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center mr-4">
                <FolderKanban className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{project.name}</h3>
                <p className="text-xs text-gray-500 mt-1">Clic para ir a sus Ciclos</p>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Proyecto</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Proyecto
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej. Xenvio WMS"
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newProjectName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
