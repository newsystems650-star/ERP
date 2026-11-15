import React, { useState } from 'react';
import {
  Trees,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { toast } from 'sonner';
import { AuthUser, Role } from '../types';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  syncAllErpStateToFirestore,
  syncUserProfileToFirestore,
} from '../lib/firestorePersistence';

interface LoginViewProps {
  onAuthenticated: (token: string, user: AuthUser) => void;
}

const DEMO_ACCOUNTS: Array<{ label: string; role: Role; email: string; pass: string }> = [
  { label: 'Admin (Dirección)', role: 'ADMIN', email: 'admin@niccore.mx', pass: 'NicCore2026!' },
  { label: 'Manager (Gerencia)', role: 'MANAGER', email: 'gerencia@niccore.mx', pass: 'NicCore2026!' },
  { label: 'Operator (Cajero)', role: 'OPERATOR', email: 'caja@niccore.mx', pass: 'NicCore2026!' },
  { label: 'Viewer (Chofer/Patio)', role: 'VIEWER', email: 'chofer@niccore.mx', pass: 'NicCore2026!' },
];

export const LoginView: React.FC<LoginViewProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@niccore.mx');
  const [password, setPassword] = useState('NicCore2026!');
  const [role, setRole] = useState<Role>('OPERATOR');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { name, email, password, role };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo autenticar');
      }

      toast.success(`Bienvenido, ${data.user.name}`);
      onAuthenticated(data.token, data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de autenticación';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const fbUser = credential.user;

      const res = await fetch('/api/v1/auth/firebase-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName || fbUser.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo vincular la cuenta Google');
      }

      await syncUserProfileToFirestore({
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
      });

      syncAllErpStateToFirestore().catch(() => {});

      toast.success(`Sesión vinculada con Cloud Firestore (${data.user.email})`);
      onAuthenticated(data.token, data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al conectar con Google';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-5">
        {/* Left Brand & Workflow Column */}
        <div className="lg:col-span-2 bg-slate-900 text-white p-8 flex flex-col justify-between space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3">
              <div className="bg-emerald-600 p-2.5 rounded-xl">
                <Trees className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">NicCore ERP</span>
            </div>
            <h1 className="text-2xl font-bold leading-snug">
              Control integral para madererías y aserraderos
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Inicia sesión con tu correo y contraseña o con Google para respaldar cada venta,
              factura CFDI, reporte e inventario en servidor y Cloud Firestore.
            </p>
          </div>

          <div className="space-y-3 border-t border-slate-800 pt-6">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Acceso rápido por perfil
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  type="button"
                  key={acc.email}
                  onClick={() => {
                    setMode('login');
                    setEmail(acc.email);
                    setPassword(acc.pass);
                    setErrorMsg('');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 transition-colors flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{acc.label}</p>
                    <p className="text-[11px] font-mono text-slate-400">{acc.email}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Auth Form */}
        <div className="lg:col-span-3 p-8 lg:p-10 flex flex-col justify-center space-y-5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'login' ? 'Ingresa a tu cuenta NicCore' : 'Registrar nuevo usuario'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'login'
                ? 'Persistencia atómica en servidor + sincronización opcional en Cloud Firestore.'
                : 'Asigna un rol operativo para controlar el acceso a cada módulo.'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <Database className="w-4 h-4 text-emerald-600" />
            )}
            Continuar con Google (Activar Respaldo Cloud Firestore)
          </button>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div className="h-px bg-slate-200 flex-1" />
            <span>o con correo y contraseña</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Nombre completo</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Gómez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Correo electrónico</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="usuario@niccore.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Mostrar u ocultar contraseña"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Rol en el sistema</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="OPERATOR">Operator (Cajero POS)</option>
                  <option value="MANAGER">Manager (Gerencia)</option>
                  <option value="VIEWER">Viewer (Chofer / Patio)</option>
                  <option value="ADMIN">Admin (Acceso total)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {mode === 'login' ? 'Entrar al Sistema' : 'Crear Cuenta y Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
