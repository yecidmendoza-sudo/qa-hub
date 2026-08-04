import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client';

type Stage = 'loading' | 'set-password' | 'success' | 'error';

export default function AcceptInvite() {
  const [stage, setStage] = useState<Stage>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase processes the #access_token from the URL hash automatically.
    // We wait for the session to be established, then show the password form.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session) {
        setStage('set-password');
      } else if (event === 'SIGNED_OUT') {
        setStage('error');
        setErrorMsg('El link de invitación es inválido o ya expiró. Solicita una nueva invitación.');
      }
    });

    // Fallback: if session already exists when component mounts
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStage('set-password');
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setErrorMsg(error.message || 'Error al guardar la contraseña.');
    } else {
      setStage('success');
      // Redirect to app after 2 seconds
      setTimeout(() => {
        window.location.href = '/#/';
      }, 2000);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Verificando invitación…</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-red-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">❌</div>
          <h1 className="text-xl font-bold text-red-400">Link inválido o expirado</h1>
          <p className="text-gray-400 text-sm">{errorMsg}</p>
          <a
            href="/#/login"
            className="inline-block mt-4 px-6 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm hover:bg-gray-600 transition-colors"
          >
            Ir al Login
          </a>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-green-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-green-400">¡Contraseña configurada!</h1>
          <p className="text-gray-400 text-sm">
            Tu cuenta está lista. Entrando a QA Hub…
          </p>
          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // ── Set Password Form ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl">🧪</div>
          <h1 className="text-2xl font-bold text-white">Bienvenido a Gideon QA</h1>
          <p className="text-gray-400 text-sm">
            Configura tu contraseña para activar tu cuenta
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-3 text-gray-500 hover:text-gray-300 text-xs"
              >
                {showPwd ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Confirmar contraseña
            </label>
            <input
              type={showPwd ? 'text' : 'password'}
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none"
            />
          </div>

          {errorMsg && (
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            {submitting ? 'Guardando…' : 'Activar mi cuenta →'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600">
          Solo lectura · Gideon QA Hub · Shipedge
        </p>
      </div>
    </div>
  );
}
