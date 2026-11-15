import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  FileText,
  AlertTriangle,
  Truck,
  ArrowRight,
  Clock,
  Scissors,
  RefreshCw,
} from 'lucide-react';
import { AppView, ReportsSummary, Ticket } from '../types';
import { PatioSheetModal } from './PatioSheetModal';

interface DashboardViewProps {
  onNavigate: (view: AppView) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/admin/reports');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Ventas Confirmadas</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ${(summary?.totalSales ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            IVA recaudado: ${(summary?.totalTax ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Tickets y Taller</span>
            <FileText className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {summary?.confirmedTickets ?? 0} confirmados
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {summary?.pendingWorkshop ?? 0} órdenes en maquila activa
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Stock Bajo</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                (summary?.lowStockCount ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {summary?.lowStockCount ?? 0} productos
          </p>
          <button
            onClick={() => onNavigate('inventory')}
            className="text-xs font-semibold text-emerald-700 hover:underline mt-1 inline-flex items-center gap-1"
          >
            Revisar inventario <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Entregas Pendientes</span>
            <Truck className="w-4 h-4 text-slate-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {summary?.pendingDeliveries ?? 0} en ruta / patio
          </p>
          <button
            onClick={() => onNavigate('deliveries')}
            className="text-xs font-semibold text-emerald-700 hover:underline mt-1 inline-flex items-center gap-1"
          >
            Ver logística <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Split: Recent Tickets & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Últimas Operaciones</h3>
              <p className="text-xs text-slate-500">
                Haz clic en cualquier ticket para abrir su Hoja de Patio
              </p>
            </div>
            <button
              onClick={loadSummary}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {summary?.recentTickets.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No hay tickets registrados todavía. Crea la primera venta desde Punto de Venta.
              </div>
            ) : (
              summary?.recentTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="w-full px-6 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 font-mono">{ticket.code}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-sm font-medium text-slate-700 truncate">
                        {ticket.customerName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.confirmedAt).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>·</span>
                      <span>{ticket.items.length} partidas</span>
                      {ticket.workshopStatus !== 'NOT_REQUIRED' && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Scissors className="w-3 h-3" /> Maquila
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="text-right shrink-0 ml-4">
                    <p className="text-sm font-bold text-emerald-700 font-mono tabular-nums">
                      ${ticket.total.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">{ticket.paymentMethod}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Low Stock & Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Alertas de Reabastecimiento</h3>
              <p className="text-xs text-slate-500">Productos por debajo del mínimo</p>
            </div>
            <div className="divide-y divide-slate-200">
              {summary?.lowStockProducts.length === 0 ? (
                <div className="p-6 text-xs text-slate-500 text-center">
                  Todo el inventario está por encima del mínimo operativo.
                </div>
              ) : (
                summary?.lowStockProducts.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{p.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-red-600 font-mono tabular-nums">
                        {p.stock} uds
                      </p>
                      <p className="text-xs text-slate-400 font-mono tabular-nums">
                        Min: {p.minAlert}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => onNavigate('wood')}
                className="w-full py-2 px-4 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Registrar Entrada de Madera
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Valuación de Inventario</h3>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              ${(summary?.inventoryValuation ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500">
              Costo total en patio calculado sobre existencias vigentes.
            </p>
          </div>
        </div>
      </div>

      <PatioSheetModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
    </div>
  );
};
