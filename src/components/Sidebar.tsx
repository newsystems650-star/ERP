import React from 'react';
import {
  Activity,
  ShoppingCart,
  Package,
  Truck,
  Scissors,
  Calculator,
  FileText,
  Settings,
  Trees,
  X,
  Bot,
} from 'lucide-react';
import { AppView, AuthUser, Role } from '../types';

interface SidebarProps {
  user: AuthUser;
  currentRole: Role;
  setRole: (r: Role) => void;
  activeView: AppView;
  onSelectView: (v: AppView) => void;
  onOpenAi: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const MENU_ITEMS: Array<{
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity, roles: ['ADMIN', 'MANAGER'] },
  { id: 'pos', label: 'Punto de Venta', icon: ShoppingCart, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
  { id: 'inventory', label: 'Inventario', icon: Package, roles: ['ADMIN', 'MANAGER', 'OPERATOR'] },
  { id: 'deliveries', label: 'Patio y Entregas', icon: Truck, roles: ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] },
  { id: 'optimizer', label: 'Optimizador Cortes', icon: Scissors, roles: ['ADMIN', 'MANAGER'] },
  { id: 'wood', label: 'Entrada Madera', icon: Calculator, roles: ['ADMIN', 'MANAGER'] },
  { id: 'reports', label: 'Facturas, Reportes y BD', icon: FileText, roles: ['ADMIN', 'MANAGER'] },
  { id: 'settings', label: 'Seguridad y Sucursales', icon: Settings, roles: ['ADMIN'] },
];

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  currentRole,
  setRole,
  activeView,
  onSelectView,
  onOpenAi,
  mobileOpen,
  onCloseMobile,
}) => {
  const visibleItems = MENU_ITEMS.filter((item) => item.roles.includes(currentRole));

  const content = (
    <aside className="w-64 bg-slate-900 text-white h-full flex flex-col border-r border-slate-800">
      <div className="px-6 py-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-lg">
            <Trees className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight whitespace-nowrap">NicCore ERP</span>
        </div>
        <button
          onClick={onCloseMobile}
          aria-label="Cerrar menú"
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" aria-label="Navegación principal">
        {visibleItems.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectView(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-3 mt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              onOpenAi();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/60 transition-colors whitespace-nowrap"
          >
            <Bot className="w-4 h-4 shrink-0" />
            <span className="truncate">Guía y Copilot IA</span>
          </button>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800/70 rounded-xl p-3.5 space-y-3 border border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {user.role === 'ADMIN' ? (
            <div>
              <label htmlFor="role-switcher" className="block text-[10px] text-slate-400 mb-1">
                Simular vista de rol
              </label>
              <select
                id="role-switcher"
                value={currentRole}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full bg-slate-900 text-slate-200 text-xs rounded-lg px-2.5 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ADMIN">Admin (Dirección)</option>
                <option value="MANAGER">Manager (Gerencia)</option>
                <option value="OPERATOR">Operator (Cajero)</option>
                <option value="VIEWER">Viewer (Chofer / Patio)</option>
              </select>
            </div>
          ) : (
            <p className="text-[11px] font-mono text-slate-400">Perfil: {currentRole}</p>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-30 no-print">{content}</div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
