import { useEffect, useState } from 'react';
import { useAuth } from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { Shield, Mail, User, ListPlus, Trash2, Plus, KeyRound, Eye, EyeOff, Users, ArrowLeft, Copy, Check } from 'lucide-react';

function UserManagement() {
  const { userProjects } = useAuth();
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('QA_TESTER');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [createMsg, setCreateMsg] = useState<{ type: 'ok' | 'error'; text: string; password?: string } | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedCreate, setCopiedCreate] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'error'; text: string; password?: string; userId?: string } | null>(null);
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null);
  const [copiedReset, setCopiedReset] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data } = await supabase
      .from('user_projects')
      .select('user_id, project_id, profiles(email, role), projects(name)');
    
    if (data) {
      const qas = data.filter((row: any) => row.profiles?.role !== 'ADMIN');
      
      const grouped = qas.reduce((acc: any, row: any) => {
        const pName = row.projects?.name || 'Desconocido';
        if (!acc[pName]) acc[pName] = [];
        const existingUser = acc[pName].find((u: any) => u.email === row.profiles?.email);
        if (!existingUser) {
          acc[pName].push({
            id: row.user_id,
            email: row.profiles?.email
          });
        }
        return acc;
      }, {});
      setUsers(grouped);
    }
    setUsersLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (['QA_TESTER', 'QA_LEAD'].includes(role) && selectedProjects.length === 0) {
      setCreateMsg({ type: 'error', text: 'Selecciona al menos un proyecto para este rol' });
      return;
    }

    setCreateLoading(true);
    setCreateMsg(null);
    try {
      const res = await fetch(
        'https://leexvmoadhzwthzcbhph.supabase.co/functions/v1/admin-invite-user',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_AGENT_API_KEY },
          body: JSON.stringify({
            action: 'create',
            email: email.trim(),
            role,
            project_ids: ['QA_TESTER', 'QA_LEAD'].includes(role) ? selectedProjects : undefined
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setCreateMsg({ type: 'ok', text: '✅ Usuario creado', password: data.generated_password });
        setEmail('');
        setSelectedProjects([]);
        setRole('QA_TESTER');
        fetchUsers();
      } else {
        setCreateMsg({ type: 'error', text: data.error || 'Error al crear usuario' });
      }
    } catch {
      setCreateMsg({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetPassword = async (userEmail: string, userId: string) => {
    setResetLoadingId(userId);
    setResetMsg(null);
    try {
      const res = await fetch(
        'https://leexvmoadhzwthzcbhph.supabase.co/functions/v1/admin-invite-user',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_AGENT_API_KEY },
          body: JSON.stringify({
            action: 'reset',
            email: userEmail
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setResetMsg({ type: 'ok', text: '✅ Password reseteado', password: data.new_password, userId });
      } else {
        setResetMsg({ type: 'error', text: data.error || 'Error al resetear password', userId });
      }
    } catch {
      setResetMsg({ type: 'error', text: 'Error de conexión.', userId });
    } finally {
      setResetLoadingId(null);
    }
  };

  const copyToClipboard = (text: string, type: 'create' | 'reset') => {
    navigator.clipboard.writeText(text);
    if (type === 'create') {
      setCopiedCreate(true);
      setTimeout(() => setCopiedCreate(false), 2000);
    } else {
      setCopiedReset(true);
      setTimeout(() => setCopiedReset(false), 2000);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  return (
    <div className="space-y-8">
      {/* Crear usuario */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
          <Plus className="w-5 h-5 mr-2 text-blue-600" />
          <h2 className="text-sm font-bold text-gray-800">Crear Usuario</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleCreateUser} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="QA_TESTER">QA Tester</option>
                <option value="QA_LEAD">QA Lead (Scrum Master)</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {['QA_TESTER', 'QA_LEAD'].includes(role) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Proyectos (selecciona al menos uno)</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {userProjects.map(p => (
                    <label key={p.id} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="mr-2 rounded text-blue-600 focus:ring-blue-500"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={createLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createLoading ? 'Creando...' : 'Crear Usuario'}
            </button>

            {createMsg && (
              <div className={`p-4 rounded-lg mt-4 ${createMsg.type === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-bold ${createMsg.type === 'ok' ? 'text-green-800' : 'text-red-800'}`}>
                  {createMsg.text}
                </p>
                {createMsg.password && (
                  <div className="mt-2">
                    <p className="text-sm text-green-700 mb-1">🔑 Password temporal (compártelo con el usuario):</p>
                    <div className="flex items-center bg-white border border-green-300 rounded overflow-hidden">
                      <span className="px-3 py-1.5 font-mono text-sm text-gray-800 flex-1">{createMsg.password}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(createMsg.password!, 'create')}
                        className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 transition-colors flex items-center border-l border-green-300"
                      >
                        {copiedCreate ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                        {copiedCreate ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center">
          <Users className="w-5 h-5 mr-2 text-gray-700" />
          <h2 className="text-sm font-bold text-gray-800">QAs por Proyecto</h2>
        </div>
        <div className="p-6">
          {usersLoading ? (
            <p className="text-sm text-gray-500">Cargando usuarios...</p>
          ) : Object.keys(users).length === 0 ? (
            <p className="text-sm text-gray-500">No hay QAs asignados a proyectos.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(users).map(([projectName, qas]: [string, any]) => (
                <div key={projectName} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-sm">{projectName}</h3>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-medium">{qas.length} usuarios</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {qas.map((qa: any) => (
                      <div key={qa.id} className="p-4 bg-white hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <span className="text-sm font-medium text-gray-800">{qa.email}</span>
                        
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => handleResetPassword(qa.email, qa.id)}
                            disabled={resetLoadingId === qa.id}
                            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 rounded font-medium disabled:opacity-50 flex items-center"
                          >
                            <KeyRound className="w-3 h-3 mr-1" />
                            {resetLoadingId === qa.id ? 'Resetting...' : 'Reset Password'}
                          </button>
                          
                          {resetMsg && resetMsg.userId === qa.id && (
                            <div className={`mt-2 text-xs p-2 rounded ${resetMsg.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'} w-full sm:w-auto`}>
                              <span className="font-bold">{resetMsg.text}</span>
                              {resetMsg.password && (
                                <div className="mt-1 flex items-center bg-white border border-green-300 rounded overflow-hidden">
                                  <span className="px-2 py-1 font-mono">{resetMsg.password}</span>
                                  <button
                                    onClick={() => copyToClipboard(resetMsg.password!, 'reset')}
                                    className="px-2 py-1 bg-green-100 hover:bg-green-200 border-l border-green-300 flex items-center"
                                  >
                                    {copiedReset ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'Mínimo 6 caracteres.' });
      return;
    }
    setPwdLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdMsg({ type: 'error', text: error.message });
    } else {
      setPwdMsg({ type: 'ok', text: '✅ Password actualizado correctamente.' });
      setNewPassword('');
      setConfirmPassword('');
    }
    setPwdLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 space-y-6">
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

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center mb-3">
            <KeyRound className="w-5 h-5 text-gray-400 mr-2" />
            <p className="text-sm font-semibold text-gray-700">Cambiar Contraseña</p>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none pr-10"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirmar contraseña"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {pwdMsg && (
              <p className={`text-sm font-medium ${pwdMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg.text}</p>
            )}
            <button type="submit" disabled={pwdLoading} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {pwdLoading ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function CustomFieldsSection() {
  const { selectedProject, userProjects } = useAuth();
  
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fieldMsg, setFieldMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  
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
    setFieldMsg(null);
    if (!targetProjectId || !newFieldName.trim()) {
      setFieldMsg({ type: 'error', text: 'Selecciona un proyecto y escribe un nombre de campo.' });
      return;
    }

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

    if (error) {
      setFieldMsg({ type: 'error', text: `Error al añadir campo: ${error.message || 'Permiso denegado.'}` });
      return;
    }
    if (data) {
      setFields([...fields, data]);
      setNewFieldName('');
      setNewFieldOptions('');
      setFieldMsg({ type: 'ok', text: '✅ Campo añadido correctamente.' });
    }
  };

  const handleDeleteField = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el campo '${name}'?`)) {
      const { error } = await supabase.from('cycle_field_configs').delete().eq('id', id);
      if (error) {
        setFieldMsg({ type: 'error', text: `Error al eliminar campo: ${error.message || 'Permiso denegado.'}` });
        return;
      }
      setFields(fields.filter(f => f.id !== id));
      setFieldMsg({ type: 'ok', text: `✅ Campo '${name}' eliminado.` });
    }
  };

  const groupedFields = fields.reduce((acc, field) => {
    const pName = field.project?.name || 'Proyecto Desconocido';
    if (!acc[pName]) acc[pName] = [];
    acc[pName].push(field);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
          
          {fieldMsg && (
            <p className={`text-sm font-medium ${fieldMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{fieldMsg.text}</p>
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
                {(projectFields as any[]).map((field: any) => (
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
  );
}

export default function Settings() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'ADMIN';
  
  const [section, setSection] = useState<'profile' | 'fields' | 'users' | null>(null);

  useEffect(() => {
    setSection(null);
  }, []);

  const renderContent = () => {
    switch (section) {
      case 'profile':
        return <ProfileSection />;
      case 'fields':
        return <CustomFieldsSection />;
      case 'users':
        return isAdmin ? <UserManagement /> : <div />;
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div 
              onClick={() => setSection('profile')}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col"
            >
              <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Mi Perfil</h3>
              <p className="text-sm text-gray-500 flex-1">Ver información de perfil y cambiar tu contraseña de acceso.</p>
              <div className="mt-4 text-blue-600 font-semibold text-sm flex items-center">
                Abrir <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
              </div>
            </div>

            <div 
              onClick={() => setSection('fields')}
              className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:green-300 transition-all cursor-pointer group flex flex-col"
            >
              <div className="bg-green-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-100 transition-colors">
                <ListPlus className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Campos Personalizados</h3>
              <p className="text-sm text-gray-500 flex-1">Configura campos obligatorios para los ciclos por cada proyecto.</p>
              <div className="mt-4 text-green-600 font-semibold text-sm flex items-center">
                Abrir <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
              </div>
            </div>

            {isAdmin && (
              <div 
                onClick={() => setSection('users')}
                className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group flex flex-col"
              >
                <div className="bg-purple-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Gestión de Usuarios</h3>
                <p className="text-sm text-gray-500 flex-1">Crea usuarios QA/Admin y resetea contraseñas de acceso.</p>
                <div className="mt-4 text-purple-600 font-semibold text-sm flex items-center">
                  Abrir <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  const getTitle = () => {
    switch (section) {
      case 'profile': return 'Mi Perfil';
      case 'fields': return 'Campos Personalizados';
      case 'users': return 'Gestión de Usuarios';
      default: return 'Configuración del Sistema';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center mb-6">
        {section !== null && (
          <button 
            onClick={() => setSection(null)}
            className="mr-4 p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm font-semibold">Volver</span>
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{getTitle()}</h1>
      </div>

      {renderContent()}
    </div>
  );
}
