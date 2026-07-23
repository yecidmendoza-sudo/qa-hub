import { useEffect, useState } from 'react';
import { useAuth } from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { Shield, Mail, User, ListPlus, Trash2, Plus } from 'lucide-react';

export default function Settings() {
  const { profile, selectedProject, userProjects } = useAuth();
  
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [targetProjectId, setTargetProjectId] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('TEXT');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');

  useEffect(() => {
    if (selectedProject && !targetProjectId) {
      setTargetProjectId(selectedProject.id);
    }
    if (userProjects.length > 0) {
      fetchFields();
    }
  }, [selectedProject, userProjects]);

  const fetchFields = async () => {
    setLoading(true);
    const projectIds = userProjects.map(p => p.id);
    if (projectIds.length === 0) {
      setLoading(false);
      return;
    }
    
    const { data } = await supabase
      .from('cycle_field_configs')
      .select('*, project:projects(name)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true });
      
    setFields(data || []);
    setLoading(false);
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectId || !newFieldName.trim()) return;

    const optionsArray = newFieldType === 'DROPDOWN' 
      ? newFieldOptions.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const { data, error } = await supabase
      .from('cycle_field_configs')
      .insert({
        project_id: targetProjectId,
        name: newFieldName.trim(),
        field_type: newFieldType,
        is_required: newFieldRequired,
        options: optionsArray
      })
      .select('*, project:projects(name)')
      .single();

    if (!error && data) {
      setFields([...fields, data]);
      setNewFieldName('');
      setNewFieldOptions('');
    }
  };

  const handleDeleteField = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el campo '${name}'?`)) {
      await supabase.from('cycle_field_configs').delete().eq('id', id);
      setFields(fields.filter(f => f.id !== id));
    }
  };

  const groupedFields = fields.reduce((acc, field) => {
    const pName = field.project?.name || 'Proyecto Desconocido';
    if (!acc[pName]) acc[pName] = [];
    acc[pName].push(field);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
          <ListPlus className="w-5 h-5 mr-2 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-800">Campos Personalizados (Formulario de Nuevo Ciclo)</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-6">
            Define qué preguntas (obligatorias u opcionales) se le harán a los QA al crear un nuevo Ciclo en cada proyecto.
          </p>

          <form onSubmit={handleAddField} className="flex flex-col gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-8">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-gray-700 mb-1">Proyecto Destino</label>
                <select value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm bg-white">
                  {userProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Campo</label>
                <input type="text" required value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Ej: Ticket Jira" className="w-full p-2 border border-gray-300 rounded text-sm" />
              </div>
              <div className="w-full md:w-1/5">
                <label className="block text-xs font-bold text-gray-700 mb-1">Tipo</label>
                <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm bg-white">
                  <option value="TEXT">Texto Corto</option>
                  <option value="DROPDOWN">Menú Desplegable</option>
                </select>
              </div>
              <div className="w-full md:w-auto flex items-center mb-2">
                <label className="flex items-center text-sm text-gray-700 cursor-pointer font-medium">
                  <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)} className="mr-2 rounded text-blue-600 focus:ring-blue-500" />
                  ¿Obligatorio?
                </label>
              </div>
            </div>

            {newFieldType === 'DROPDOWN' && (
              <div className="w-full">
                <label className="block text-xs font-bold text-gray-700 mb-1">Opciones (separadas por coma)</label>
                <input type="text" required value={newFieldOptions} onChange={e => setNewFieldOptions(e.target.value)} placeholder="QA, STG, PROD" className="w-full p-2 border border-gray-300 rounded text-sm" />
              </div>
            )}
            
            <div className="flex justify-end mt-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 flex items-center justify-center">
                <Plus className="w-4 h-4 mr-1" /> Añadir Campo
              </button>
            </div>
          </form>

          <div className="space-y-6">
            {loading ? <p className="text-sm text-gray-500">Cargando campos...</p> : fields.length === 0 ? <p className="text-sm text-gray-500">No hay campos personalizados en ningún proyecto.</p> : null}
            
            {Object.entries(groupedFields).map(([projectName, projectFields]) => (
              <div key={projectName} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                  <h3 className="font-bold text-gray-800 text-sm">Proyecto: {projectName}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {projectFields.map(field => (
                    <div key={field.id} className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
                      <div>
                        <span className="font-bold text-gray-800 text-sm">{field.name}</span>
                        <span className="ml-3 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">{field.field_type}</span>
                        {field.is_required && <span className="ml-2 text-xs text-red-600 font-bold">* Obligatorio</span>}
                        {field.field_type === 'DROPDOWN' && <p className="text-xs text-gray-500 mt-1">Opciones: {(field.options || []).join(', ')}</p>}
                      </div>
                      <button onClick={() => handleDeleteField(field.id, field.name)} className="text-gray-400 hover:text-red-500 p-2" title="Eliminar campo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección Mi Perfil (Restaurada) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700 flex items-center">
            <User className="w-4 h-4 mr-2" />
            Mi Perfil
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center">
            <Mail className="w-5 h-5 text-gray-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-500">Correo Electrónico</p>
              <p className="text-base text-gray-900">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-blue-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-500">Nivel de Acceso (Rol)</p>
              <p className="text-base font-bold text-blue-700">{profile?.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Administración de Usuarios (Restaurada) */}
      {profile?.role === 'ADMIN' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">Administración de Usuarios</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Como administrador, puedes invitar nuevos QAs directamente desde el panel de <b>Supabase {'>'} Authentication</b>.
              Una vez que acepten la invitación, aparecerán en la base de datos y podrás asignarles proyectos específicos en la tabla <code>user_projects</code>.
            </p>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Ir a Supabase Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
