import React, { useEffect, useState } from 'react';
import { Menu, ShieldAlert, LogOut, Bot, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { AppView, AuthUser, HealthStatus, Role } from './types';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';
import { DashboardView } from './components/DashboardView';
import { POSView } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { DeliveriesWorkshopView } from './components/DeliveriesWorkshopView';
import { CutOptimizerView } from './components/CutOptimizerView';
import { WoodEntryView } from './components/WoodEntryView';
import { ReportsAuditView } from './components/ReportsAuditView';
import { SettingsView } from './components/SettingsView';

const TOKEN_STORAGE_KEY = 'niccore_session_token';

const VIEW_META: Record<AppView, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard General',
    subtitle: 'Resumen operativo, ventas confirmadas y alertas de patio.',
  },
  pos: {
    title: 'Punto de Venta',
    subtitle: 'Cobro atómico con IVA, instrucciones de maquila y hoja de patio.',
  },
  inventory: {
    title: 'Inventario de Madera',
    subtitle: 'Existencias en patio, mínimos críticos y ajustes auditados.',
  },
  deliveries: {
    title: 'Patio, Taller y Entregas',
    subtitle: 'Seguimiento de maquila en sierra y logística de reparto.',
  },
  optimizer: {
    title: 'Optimizador de Cortes 2D',
    subtitle: 'Aprovechamiento de tableros y reducción de merma.',
  },
  wood: {
    title: 'Entrada de Madera',
    subtitle: 'Calculadora de pies tablares, conversión comercial y alta de lotes.',
  },
  reports: {
    title: 'Facturas, Reportes y Base de Datos',
    subtitle: 'Facturas CFDI, cortes guardados, bitácora AES-256 y respaldo Cloud Firestore.',
  },
  settings: {
    title: 'Seguridad y Sucursales',
    subtitle: 'Control de Modo Búnker, puente C++ y gestión de empresas.',
  },
};

const ALLOWED_VIEWS: Record<Role, AppView[]> = {
  ADMIN: ['dashboard', 'pos', 'inventory', 'deliveries', 'optimizer', 'wood', 'reports', 'settings'],
  MANAGER: ['dashboard', 'pos', 'inventory', 'deliveries', 'optimizer', 'wood', 'reports'],
  OPERATOR: ['pos', 'inventory', 'deliveries'],
  VIEWER: ['deliveries'],
};

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>('ADMIN');
  const [view, setView] = useState<AppView>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [recentErrors, setRecentErrors] = useState<string[]>([]);

  const recordError = (msg: string) => {
    setRecentErrors((prev) => [msg, ...prev.filter((m) => m !== msg)].slice(0, 8));
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch {
      // ignore transient network check
    }
  };

  // Restore session via token
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        setAuthChecking(false);
        return;
      }
      try {
        const res = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setRole(data.user.role);
          setView(ALLOWED_VIEWS[data.user.role as Role][0]);
        } else {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } finally {
        setAuthChecking(false);
      }
    };
    restoreSession();
    fetchHealth();
  }, []);

  // Global error capture for AI Copilot diagnostics
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      if (e.message) recordError(e.message);
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason || '');
      if (reason) recordError(reason);
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  useEffect(() => {
    if (!ALLOWED_VIEWS[role].includes(view)) {
      setView(ALLOWED_VIEWS[role][0]);
    }
  }, [role, view]);

  const handleAuthenticated = (token: string, authedUser: AuthUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setUser(authedUser);
    setRole(authedUser.role);
    setView(ALLOWED_VIEWS[authedUser.role][0]);
    fetchHealth();
  };

  const handleLogout = async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    await signOut(auth).catch(() => {});
    setUser(null);
    setAiOpen(false);
    toast.info('Sesión cerrada correctamente');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white gap-3 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        Verificando sesión NicCore...
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" expand={false} richColors />
        <LoginView onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  const meta = VIEW_META[view];
  const allowedForRole = ALLOWED_VIEWS[role];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Toaster position="top-right" expand={false} richColors />

      <Sidebar
        user={user}
        currentRole={role}
        setRole={setRole}
        activeView={view}
        onSelectView={setView}
        onOpenAi={() => setAiOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 lg:ml-64 min-w-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-6 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
              className="lg:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">
                {meta.title}
              </h1>
              <p className="text-xs text-slate-500 truncate">{meta.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {health?.bunkerMode && (
              <button
                type="button"
                onClick={() => {
                  if (role === 'ADMIN') setView('settings');
                }}
                className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <ShieldAlert className="w-4 h-4" />
                Modo Búnker Activo
              </button>
            )}

            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 border border-emerald-600 rounded-xl text-xs font-semibold text-white hover:bg-emerald-700 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Bot className="w-4 h-4" />
              Asistente IA
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="px-3.5 py-2 bg-slate-900 border border-slate-900 rounded-xl text-xs font-semibold text-white hover:bg-slate-800 inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <LogOut className="w-4 h-4 text-slate-300" />
              Cerrar Sesión
            </button>
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <ModuleErrorBoundary
            moduleName={meta.title}
            onErrorCaptured={recordError}
            onOpenAi={() => setAiOpen(true)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-${role}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
              >
                {view === 'dashboard' && <DashboardView onNavigate={setView} />}
                {view === 'pos' && <POSView />}
                {view === 'inventory' && <InventoryView />}
                {view === 'deliveries' && <DeliveriesWorkshopView role={role} />}
                {view === 'optimizer' && <CutOptimizerView />}
                {view === 'wood' && <WoodEntryView />}
                {view === 'reports' && <ReportsAuditView />}
                {view === 'settings' && <SettingsView onHealthChange={fetchHealth} />}
              </motion.div>
            </AnimatePresence>
          </ModuleErrorBoundary>
        </div>
      </main>

      <AiAssistantDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        currentView={view}
        userRole={role}
        allowedViews={allowedForRole}
        recentErrors={recentErrors}
        onClearErrors={() => setRecentErrors([])}
        onNavigate={setView}
        onRefreshSystem={fetchHealth}
      />
    </div>
  );
}
