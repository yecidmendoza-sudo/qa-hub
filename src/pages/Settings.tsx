import { useEffect, useState } from 'react';
import { useAuth } from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { Shield, Mail, User, ListPlus, Trash2, Plus, KeyRound, Eye, EyeOff, Users, ArrowLeft, Copy, Check, Pencil, MoreVertical, X } from 'lucide-react';

function UserManagement() {
  const { userProjects, profile } = useAuth();
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('QA_TESTER');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [createMsg, setCreateMsg] = useState<{ type: 'ok' | 'error'; text: string; password?: string } | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [copiedCreate, setCopiedCreate] = useState(false);

  const [users, setUsers] = useState<Record<string, any[]>>({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'error'; text: string; password?: string; userId?: string } | null>(null);
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [copiedReset, setCopiedReset] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setUsersLoading(true);

    // 1. Todos los perfiles no-admin
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, email, role, active')
      .neq('role', 'ADMIN')
      .order('created_at', { ascending: false });

    // 2. Asignaciones de proyectos
    const { data: assignments } = await supabase
      .from('user_projects')
      .select('user_id, projects(name)');

    // 3. Mapa user_id → [proyecto1, proyecto2, ...]
    const projectMap: Record<string, string[]> = {};
    (assignments || []).forEach((a: any) => {
      const pName = a.projects?.name;
      if (!pName) return;
      if (!projectMap[a.user_id]) projectMap[a.user_id] = [];
      if (!projectMap[a.user_id].includes(pName)) projectMap[a.user_id].push(pName);
    });

    // 4. Agrupar por proyecto (usuarios sin proyecto → "Sin Proyecto Asignado")
    const grouped: Record<string, any[]> = {};
    (profilesData || []).forEach(p => {
      const projects = projectMap[p.id] || [];
      const targets = projects.length > 0 ? projects : ['Sin Proyecto Asignado'];
      targets.forEach(proj => {
        if (!grouped[proj]) grouped[proj] = [];
        if (!grouped[proj].find((u: any) => u.id === p.id)) {
          grouped[proj].push({ id: p.id, email: p.email, role: p.role, active: p.active ?? true });
        }
      });
    });

    setUsers(grouped);
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
      const { data, error } = await supabase.functions.invoke('admin-invite-user', {
        body: {
          action: 'create',
          email: email.trim(),
          role,
          invited_by: profile?.email,
          project_ids: ['QA_TESTER', 'QA_LEAD'].includes(role) ? selectedProjects : undefined
        },
        headers: { 'x-api-key': import.meta.env.VITE_AGENT_API_KEY },
      });
      if (error || !data?.success) {
        setCreateMsg({ type: 'error', text: data?.error || error?.message || 'Error al crear usuario' });
      } else {
        setCreateMsg({ type: 'ok', text: '✅ Usuario creado', password: data.generated_password });
        setEmail('');
        setSelectedProjects([]);
        setRole('QA_TESTER');
        fetchUsers();
      }
    } catch (err: any) {
      setCreateMsg({ type: 'error', text: err.message || 'Error de conexión.' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetPassword = async (userEmail: string, userId: string) => {
    setResetLoadingId(userId);
    setResetMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-invite-user', {
        body: { action: 'reset', email: userEmail, invited_by: profile?.email },
        headers: { 'x-api-key': import.meta.env.VITE_AGENT_API_KEY },
      });
      if (error || !data?.success) {
        setResetMsg({ type: 'error', text: data?.error || error?.message || 'Error al resetear password', userId });
      } else {
        setResetMsg({ type: 'ok', text: '✅ Password reseteado', password: data.new_password, userId });
      }
    } catch (err: any) {
      setResetMsg({ type: 'error', text: err.message || 'Error de conexión.', userId });
    } finally {
      setResetLoadingId(null);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    setToggleLoadingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ active: !currentActive })
      .eq('id', userId);
    if (!error) fetchUsers();
    setToggleLoadingId(null);
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
                      <div key={qa.id} className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${qa.active ? 'bg-white hover:bg-gray-50' : 'bg-red-50 opacity-75'}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{qa.email}</span>
                          {qa.role && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{qa.role.replace('_', ' ')}</span>
                          )}
                          {!qa.active && (
                            <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">Inactivo</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(qa.id, qa.active)}
                              disabled={toggleLoadingId === qa.id}
                              className={`text-xs px-3 py-1.5 border rounded font-medium disabled:opacity-50 transition-colors flex items-center ${
                                qa.active
                                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              }`}
                            >
                              {toggleLoadingId === qa.id ? '...' : qa.active ? 'Desactivar' : 'Activar'}
                            </button>
                            <button
                              onClick={() => handleResetPassword(qa.email, qa.id)}
                              disabled={resetLoadingId === qa.id || !qa.active}
                              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 rounded font-medium disabled:opacity-50 flex items-center transition-colors"
                            >
                              <KeyRound className="w-3 h-3 mr-1" />
                              {resetLoadingId === qa.id ? 'Resetting...' : 'Reset Password'}
                            </button>
                          </div>
                          {resetMsg && resetMsg.userId === qa.id && (
                            <div className={`text-xs p-2 rounded ${resetMsg.type === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'} w-full sm:w-auto`}>
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
  const [fieldMsg, setFieldMsg] = useState<{ type: 'ok' | 'error'; text: string; projectId?: string } | null>(null);

  // Acordeones: qué proyectos están expandidos
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  // Formulario activo: qué proyecto tiene abierto el form de agregar campo
  const [addingToProject, setAddingToProject] = useState<string | null>(null);

  // Estado del formulario de nuevo campo
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('TEXT');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Estado de edición inline
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('TEXT');
  const [editRequired, setEditRequired] = useState(false);
  const [editOptions, setEditOptions] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  // Menú 3 puntos abierto
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Auto-scroll al formulario de edición cuando se abre
  useEffect(() => {
    if (editingFieldId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`edit-field-form-${editingFieldId}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          // Scroll para que el formulario quede a 80px del tope de la ventana
          window.scrollTo({ top: scrollTop + rect.top - 80, behavior: 'smooth' });
        }
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [editingFieldId]);

  useEffect(() => {
    if (userProjects.length > 0) fetchFields();
    // Expandir el proyecto seleccionado por defecto
    if (selectedProject) setExpandedProjects(new Set([selectedProject.id]));
  }, [userProjects, selectedProject]);

  const fetchFields = async () => {
    setLoading(true);
    const projectIds = userProjects.map(p => p.id);
    const { data } = await supabase
      .from('cycle_field_configs')
      .select('*, project:projects(name)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true });
    setFields(data || []);
    setLoading(false);
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
        if (addingToProject === projectId) setAddingToProject(null);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const openAddForm = (projectId: string) => {
    // Asegura que el proyecto esté expandido
    setExpandedProjects(prev => new Set([...prev, projectId]));
    setAddingToProject(projectId);
    setNewFieldName('');
    setNewFieldType('TEXT');
    setNewFieldRequired(false);
    setNewFieldOptions('');
    setFieldMsg(null);
  };

  const handleAddField = async (e: React.FormEvent, projectId: string) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    setAddLoading(true);
    setFieldMsg(null);

    const optionsArray = newFieldType === 'DROPDOWN'
      ? newFieldOptions.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    const { data, error } = await supabase
      .from('cycle_field_configs')
      .insert({
        project_id: projectId,
        name: newFieldName.trim(),
        field_type: newFieldType,
        is_required: newFieldRequired,
        options: optionsArray
      })
      .select('*, project:projects(name)')
      .single();

    if (error) {
      setFieldMsg({ type: 'error', text: `Error: ${error.message || 'Permiso denegado.'}`, projectId });
    } else if (data) {
      setFields(prev => [...prev, data]);
      setFieldMsg({ type: 'ok', text: '✅ Campo añadido.', projectId });
      setNewFieldName('');
      setNewFieldOptions('');
      setAddingToProject(null);
    }
    setAddLoading(false);
  };

  const handleDeleteField = async (id: string, name: string, projectId: string) => {
    setOpenMenuId(null);
    if (!window.confirm(`¿Eliminar el campo '${name}'?`)) return;
    const { error } = await supabase.from('cycle_field_configs').delete().eq('id', id);
    if (error) {
      setFieldMsg({ type: 'error', text: `Error al eliminar: ${error.message}`, projectId });
    } else {
      setFields(prev => prev.filter(f => f.id !== id));
    }
  };

  const openEditForm = (field: any) => {
    setOpenMenuId(null);
    setEditingFieldId(field.id);
    setEditName(field.name);
    setEditType(field.field_type);
    setEditRequired(field.is_required);
    setEditOptions((field.options || []).join(', '));
  };

  const handleSaveEdit = async (fieldId: string, projectId: string) => {
    if (!editName.trim()) return;
    setEditLoading(true);
    const optionsArray = editType === 'DROPDOWN'
      ? editOptions.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];
    const { data, error } = await supabase
      .from('cycle_field_configs')
      .update({ name: editName.trim(), field_type: editType, is_required: editRequired, options: optionsArray })
      .eq('id', fieldId)
      .select('*, project:projects(name)')
      .single();
    if (!error && data) {
      setFields(prev => prev.map(f => f.id === fieldId ? data : f));
      setEditingFieldId(null);
    } else {
      setFieldMsg({ type: 'error', text: `Error al guardar: ${error?.message}`, projectId });
    }
    setEditLoading(false);
  };

  const fieldsByProject = userProjects.reduce((acc, project) => {
    acc[project.id] = fields.filter(f => f.project_id === project.id);
    return acc;
  }, {} as Record<string, any[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-sm text-gray-500">Cargando campos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4">
        Define qué preguntas aparecerán al crear un nuevo Ciclo. Expande un proyecto para ver o agregar campos.
      </p>

      {userProjects.length === 0 && (
        <p className="text-sm text-gray-400 italic">No tienes proyectos asignados.</p>
      )}

      {userProjects.map(project => {
        const projectFields = fieldsByProject[project.id] || [];
        const isExpanded = expandedProjects.has(project.id);
        const isAddingHere = addingToProject === project.id;
        const hasMsg = fieldMsg?.projectId === project.id;

        return (
          <div
            key={project.id}
            className={`border rounded-xl transition-all duration-200 ${
              isExpanded ? 'border-blue-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'
            } ${
              // Quitar overflow-hidden cuando un dropdown está abierto en este proyecto
              // para que el menú no sea clipado por el borde de la tarjeta
              openMenuId && projectFields.some((f: any) => f.id === openMenuId)
                ? '' : 'overflow-hidden'
            }`}
          >
            {/* Header del proyecto */}
            <div
              className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors ${
                isExpanded ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => toggleProject(project.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  isExpanded ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <ListPlus className={`w-4 h-4 ${ isExpanded ? 'text-blue-600' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${ isExpanded ? 'text-blue-800' : 'text-gray-800'}`}>
                    {project.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {projectFields.length === 0
                      ? 'Sin campos personalizados'
                      : `${projectFields.length} campo${projectFields.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isExpanded && (
                  <button
                    onClick={e => { e.stopPropagation(); openAddForm(project.id); }}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1"
                    title="Agregar campo"
                  >
                    <Plus className="w-3 h-3" />
                    Agregar
                  </button>
                )}
                <div className={`transition-transform duration-200 ${ isExpanded ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Contenido expandido */}
            {isExpanded && (
              <div className="border-t border-gray-100">

                {/* Formulario de agregar campo (aparece al hacer clic en Agregar) */}
                {isAddingHere && (
                  <div className="p-4 bg-blue-50 border-b border-blue-100">
                    <form onSubmit={e => handleAddField(e, project.id)} className="space-y-3">
                      <p className="text-xs font-bold text-blue-700 mb-2">Nuevo campo para {project.name}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del campo</label>
                          <input
                            type="text"
                            required
                            autoFocus
                            value={newFieldName}
                            onChange={e => setNewFieldName(e.target.value)}
                            placeholder="Ej: Ticket Jira"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                          <select
                            value={newFieldType}
                            onChange={e => setNewFieldType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="TEXT">Texto Corto</option>
                            <option value="DROPDOWN">Menú Desplegable</option>
                          </select>
                        </div>
                        <div className="flex items-end pb-0.5">
                          <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newFieldRequired}
                              onChange={e => setNewFieldRequired(e.target.checked)}
                              className="mr-2 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-semibold">¿Obligatorio?</span>
                          </label>
                        </div>
                      </div>

                      {newFieldType === 'DROPDOWN' && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Opciones (separadas por coma)</label>
                          <input
                            type="text"
                            required
                            value={newFieldOptions}
                            onChange={e => setNewFieldOptions(e.target.value)}
                            placeholder="QA, STG, PROD"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {hasMsg && (
                        <p className={`text-xs font-medium ${fieldMsg!.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                          {fieldMsg!.text}
                        </p>
                      )}

                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setAddingToProject(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={addLoading}
                          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {addLoading ? 'Guardando...' : 'Añadir campo'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Lista de campos */}
                {projectFields.length === 0 && !isAddingHere ? (
                  <div className="px-4 py-6 text-center">
                    <ListPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Sin campos personalizados</p>
                    <button
                      onClick={() => openAddForm(project.id)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      + Agregar el primero
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {projectFields.map((field: any) => {
                      const isEditing = editingFieldId === field.id;
                      const menuOpen = openMenuId === field.id;

                      if (isEditing) {
                        return (
                          <div
                            key={field.id}
                            id={`edit-field-form-${field.id}`}
                            className="px-4 py-3 bg-yellow-50 border-b border-yellow-100"
                          >
                            <p className="text-xs font-bold text-yellow-700 mb-2">Editando: {field.name}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="sm:col-span-1">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre</label>
                                <input
                                  type="text" required autoFocus
                                  value={editName} onChange={e => setEditName(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                                <select value={editType} onChange={e => setEditType(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-yellow-400 focus:outline-none">
                                  <option value="TEXT">Texto Corto</option>
                                  <option value="DROPDOWN">Menú Desplegable</option>
                                </select>
                              </div>
                              <div className="flex items-end pb-0.5">
                                <label className="flex items-center text-sm cursor-pointer">
                                  <input type="checkbox" checked={editRequired} onChange={e => setEditRequired(e.target.checked)}
                                    className="mr-2 rounded text-yellow-500 focus:ring-yellow-400" />
                                  <span className="text-xs font-semibold">¿Obligatorio?</span>
                                </label>
                              </div>
                            </div>
                            {editType === 'DROPDOWN' && (
                              <div className="mt-2">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Opciones (separadas por coma)</label>
                                <input type="text" value={editOptions} onChange={e => setEditOptions(e.target.value)}
                                  placeholder="QA, STG, PROD"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none" />
                              </div>
                            )}
                            <div className="flex gap-2 justify-end mt-3">
                              <button type="button" onClick={() => setEditingFieldId(null)}
                                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                                <X className="w-3 h-3" /> Cancelar
                              </button>
                              <button type="button" disabled={editLoading} onClick={() => handleSaveEdit(field.id, project.id)}
                                className="px-4 py-1.5 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-1">
                                {editLoading ? 'Guardando...' : <><Check className="w-3.5 h-3.5" /> Guardar</>}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={field.id}
                          className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors group relative"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold ${
                                field.field_type === 'DROPDOWN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {field.field_type === 'DROPDOWN' ? '▾ Lista' : 'Aa Texto'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-800 truncate">{field.name}</span>
                                {field.is_required && <span className="text-xs text-red-500 font-bold flex-shrink-0">* Obligatorio</span>}
                              </div>
                              {field.field_type === 'DROPDOWN' && field.options?.length > 0 && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">{field.options.join(' · ')}</p>
                              )}
                            </div>
                          </div>

                          {/* Menú 3 puntos */}
                          <div className="relative flex-shrink-0 ml-2">
                            <button
                              onClick={() => setOpenMenuId(menuOpen ? null : field.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                              title="Opciones"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {menuOpen && (
                              <>
                                {/* Overlay para cerrar el menú */}
                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36 overflow-hidden">
                                  <button
                                    onClick={() => openEditForm(field)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteField(field.id, field.name, project.id)}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Eliminar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
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
