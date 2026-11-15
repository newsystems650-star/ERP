import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Cpu, Building2, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Company, HealthStatus } from '../types';
import { syncCompanyToFirestore } from '../lib/firestorePersistence';

interface SettingsViewProps {
  onHealthChange: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onHealthChange }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingBunker, setTogglingBunker] = useState(false);

  // New Company / Branch form
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    industry: 'Maderería / Aserradero',
    employees: '18',
    revenue: '2500000',
    foundedYear: '2020',
    description: '',
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [hRes, cRes] = await Promise.all([
        fetch('/api/v1/health'),
        fetch('/api/v1/companies'),
      ]);
      if (hRes.ok) setHealth(await hRes.json());
      if (cRes.ok) setCompanies(await cRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const toggleBunkerMode = async (activate: boolean) => {
    setTogglingBunker(true);
    try {
      const endpoint = activate
        ? '/api/v1/admin/bunker/simulate'
        : '/api/v1/admin/bunker/deactivate';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        toast[activate ? 'warning' : 'success'](
          activate
            ? 'Modo Búnker activado: auditoría intensiva habilitada'
            : 'Modo Búnker desactivado correctamente'
        );
        await loadAll();
        onHealthChange();
      }
    } finally {
      setTogglingBunker(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) return;
    setSavingCompany(true);
    try {
      const res = await fetch('/api/v1/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyForm.name,
          industry: companyForm.industry,
          employees: Number(companyForm.employees) || 10,
          revenue: Number(companyForm.revenue) || 0,
          foundedYear: Number(companyForm.foundedYear) || 2024,
          status: 'Active',
          description: companyForm.description || 'Sucursal operativa NicCore',
        }),
      });
      if (!res.ok) throw new Error('No se pudo registrar la sucursal');
      const createdCompany: Company = await res.json();
      syncCompanyToFirestore(createdCompany).catch(() => {});
      toast.success('Empresa / Sucursal agregada');
      setShowAddCompany(false);
      setCompanyForm({
        name: '',
        industry: 'Maderería / Aserradero',
        employees: '18',
        revenue: '2500000',
        foundedYear: '2020',
        description: '',
      });
      await loadAll();
    } catch {
      toast.error('Error al crear empresa');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    const res = await fetch(`/api/v1/companies/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Sucursal eliminada');
      await loadAll();
    }
  };

  return (
    <div className="space-y-6">
      {/* Bunker & C++ Bridge Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {health?.bunkerMode ? (
                <ShieldAlert className="w-5 h-5 text-red-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              )}
              <div>
                <h3 className="font-bold text-slate-900 text-base">Seguridad Modo Búnker</h3>
                <p className="text-xs text-slate-500">
                  Bloqueo preventivo tras anomalías o errores consecutivos
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-bold ${
                health?.bunkerMode ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {health?.bunkerMode ? 'ACTIVO' : 'NORMAL'}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Cuando está activo, cada petición HTTP queda trazada y se registra un evento crítico en
            la bitácora AES-256.
          </p>

          <div className="pt-2">
            {health?.bunkerMode ? (
              <button
                type="button"
                disabled={togglingBunker}
                onClick={() => toggleBunkerMode(false)}
                className="w-full py-2.5 px-4 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                Desactivar Modo Búnker
              </button>
            ) : (
              <button
                type="button"
                disabled={togglingBunker}
                onClick={() => toggleBunkerMode(true)}
                className="w-full py-2.5 px-4 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50"
              >
                Probar Activación Modo Búnker
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-slate-700" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Puente Node ↔ Motor C++</h3>
                <p className="text-xs text-slate-500">
                  Watchdog de socket Unix y respaldo en Node.js
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-700">
              {health?.bridge.mode || '...'}
            </span>
          </div>

          <div className="text-xs space-y-1.5 text-slate-600 font-mono bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <p>Socket: {health?.bridge.socketPath || '/tmp/ni_bridge.sock'}</p>
            <p>Watchdog: {health?.bridge.watchdogActive ? 'Monitoreando cada 5s' : 'Inactivo'}</p>
            <p>Telegram Hooks: {health?.telegramConfigured ? 'Configurado' : 'Cola interna (sin token)'}</p>
          </div>
        </div>
      </div>

      {/* Companies / Branches */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Empresas y Sucursales (NiCompanies)</h3>
              <p className="text-xs text-slate-500">Razones sociales y patios vinculados al ERP</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCompany(!showAddCompany)}
            className="px-3.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Agregar Sucursal
          </button>
        </div>

        {showAddCompany && (
          <form
            onSubmit={handleCreateCompany}
            className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <input
              type="text"
              required
              placeholder="Nombre de sucursal o razón social"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
            />
            <input
              type="text"
              placeholder="Giro (ej. Maderería)"
              value={companyForm.industry}
              onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Empleados"
                value={companyForm.employees}
                onChange={(e) => setCompanyForm({ ...companyForm, employees: e.target.value })}
                className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono"
              />
              <button
                type="submit"
                disabled={savingCompany}
                className="flex-1 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center justify-center gap-1.5"
              >
                {savingCompany && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="p-6 text-xs text-slate-500">Cargando sucursales...</div>
          ) : (
            companies.map((c) => (
              <div
                key={c.id}
                className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.industry} · {c.employees} empleados · Fundada {c.foundedYear}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCompany(c.id)}
                  aria-label={`Eliminar ${c.name}`}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
