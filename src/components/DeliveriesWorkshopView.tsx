import React, { useEffect, useState } from 'react';
import {
  Truck,
  Package,
  Clock,
  Phone,
  Check,
  Scissors,
  FileText,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Delivery, DeliveryStatus, Role, Ticket, WorkshopStatus } from '../types';
import { PatioSheetModal } from './PatioSheetModal';

interface DeliveriesWorkshopViewProps {
  role: Role;
}

const NEXT_WORKSHOP: Record<WorkshopStatus, WorkshopStatus | null> = {
  NOT_REQUIRED: null,
  PENDING_WORKSHOP: 'IN_WORKSHOP',
  IN_WORKSHOP: 'WORKSHOP_DONE',
  WORKSHOP_DONE: 'DELIVERED',
  DELIVERED: null,
};

const WORKSHOP_LABEL: Record<WorkshopStatus, string> = {
  NOT_REQUIRED: 'Sin maquila',
  PENDING_WORKSHOP: 'Pendiente en patio',
  IN_WORKSHOP: 'Cortando en sierra',
  WORKSHOP_DONE: 'Maquila lista',
  DELIVERED: 'Entregado',
};

const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignada',
  IN_ROUTE: 'En ruta',
  ARRIVED: 'En sitio',
  DELIVERED: 'Entregada',
  FAILED: 'Incidencia',
};

export const DeliveriesWorkshopView: React.FC<DeliveriesWorkshopViewProps> = ({ role }) => {
  const [tab, setTab] = useState<'workshop' | 'deliveries'>(
    role === 'VIEWER' ? 'deliveries' : 'workshop'
  );
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tRes, dRes] = await Promise.all([
        fetch('/api/v1/cashier/tickets'),
        fetch('/api/v1/deliveries'),
      ]);
      if (tRes.ok) setTickets(await tRes.json());
      if (dRes.ok) setDeliveries(await dRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const advanceWorkshop = async (ticket: Ticket) => {
    const next = NEXT_WORKSHOP[ticket.workshopStatus];
    if (!next) return;
    try {
      const res = await fetch(`/api/v1/cashier/tickets/${ticket.id}/workshop`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workshopStatus: next }),
      });
      if (!res.ok) throw new Error('Error actualizando taller');
      toast.success(`Hoja ${ticket.patioSheet.folio} → ${WORKSHOP_LABEL[next]}`);
      await loadAll();
    } catch {
      toast.error('No se pudo actualizar el estado del taller');
    }
  };

  const updateDelivery = async (
    id: string,
    payload: { status?: DeliveryStatus; driverName?: string; driverCheckedInAtYard?: boolean },
    successMsg: string
  ) => {
    try {
      const res = await fetch(`/api/v1/deliveries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Error actualizando entrega');
      toast.success(successMsg);
      await loadAll();
    } catch {
      toast.error('No se pudo actualizar la entrega');
    }
  };

  const handleYardCheckInAll = async () => {
    const pending = deliveries.filter((d) => !d.driverCheckedInAtYard && d.status !== 'DELIVERED');
    if (pending.length === 0) {
      toast.info('Ya confirmaste tu llegada al patio para las entregas activas');
      return;
    }
    await Promise.all(
      pending.map((d) =>
        fetch(`/api/v1/deliveries/${d.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driverCheckedInAtYard: true, status: 'ASSIGNED' }),
        })
      )
    );
    toast.success('Llegada al patio confirmada para carga de material');
    await loadAll();
  };

  // VIEWER = Mobile-first Driver / Patio View
  if (role === 'VIEWER') {
    const pendingCount = deliveries.filter((d) => d.status !== 'DELIVERED').length;
    const doneCount = deliveries.filter((d) => d.status === 'DELIVERED').length;

    return (
      <div className="max-w-md mx-auto space-y-5">
        <div className="bg-emerald-700 p-6 rounded-2xl text-white">
          <div className="flex justify-between items-start mb-5">
            <div>
              <h2 className="text-xl font-bold">Mis Entregas de Hoy</h2>
              <p className="text-emerald-100 text-xs">Vista operativa de chofer y patio</p>
            </div>
            <Truck className="w-6 h-6 text-emerald-200" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[11px] text-emerald-100">Total</p>
              <p className="text-lg font-bold font-mono tabular-nums">{deliveries.length}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[11px] text-emerald-100">Pendientes</p>
              <p className="text-lg font-bold font-mono tabular-nums">{pendingCount}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[11px] text-emerald-100">Entregadas</p>
              <p className="text-lg font-bold font-mono tabular-nums">{doneCount}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleYardCheckInAll}
          className="w-full bg-slate-900 text-white py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
        >
          <Package className="w-4 h-4" />
          Llegué al Patio a Cargar
        </button>

        <div className="space-y-4">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    <span className="font-mono">{d.ticketCode}</span> · {d.customerName}
                  </h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3.5 h-3.5" /> ETA: {d.eta} ·{' '}
                    {DELIVERY_LABEL[d.status]}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <p className="text-slate-700 font-medium">{d.address}</p>
                <p className="text-slate-500">{d.itemsSummary}</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => toast.info(`Llamando a ${d.customerName}: ${d.phone}`)}
                  className="bg-slate-100 text-slate-700 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-200"
                >
                  <Phone className="w-3.5 h-3.5" /> Llamar
                </button>
                {d.status !== 'DELIVERED' ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateDelivery(
                        d.id,
                        {
                          status: d.status === 'IN_ROUTE' ? 'DELIVERED' : 'IN_ROUTE',
                        },
                        d.status === 'IN_ROUTE'
                          ? `Entrega ${d.ticketCode} completada`
                          : `Entrega ${d.ticketCode} marcada En Ruta`
                      )
                    }
                    className="bg-emerald-600 text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {d.status === 'IN_ROUTE' ? 'Confirmar Entrega' : 'Salir a Ruta'}
                  </button>
                ) : (
                  <div className="bg-emerald-50 text-emerald-800 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center">
                    Entregada
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ADMIN / MANAGER / OPERATOR view
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
          <button
            type="button"
            onClick={() => setTab('workshop')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === 'workshop'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Taller y Hojas de Patio ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('deliveries')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === 'deliveries'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Logística de Entregas ({deliveries.length})
          </button>
        </div>

        <button
          type="button"
          onClick={loadAll}
          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-2xl animate-pulse" />
      ) : tab === 'workshop' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Folio Patio · Ticket</th>
                <th className="text-left px-4 py-3 font-semibold">Cliente · Material</th>
                <th className="text-left px-4 py-3 font-semibold">Estado Taller</th>
                <th className="text-right px-5 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tickets.map((t) => {
                const next = NEXT_WORKSHOP[t.workshopStatus];
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <p className="font-bold font-mono text-slate-900">{t.patioSheet.folio}</p>
                      <p className="text-xs font-mono text-slate-500">{t.code}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{t.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {t.items.map((i) => `${i.quantity} ${i.name}`).join(' · ')}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-semibold inline-flex items-center gap-1 ${
                          t.workshopStatus === 'IN_WORKSHOP'
                            ? 'text-amber-700'
                            : t.workshopStatus === 'WORKSHOP_DONE' ||
                              t.workshopStatus === 'DELIVERED'
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {t.workshopStatus !== 'NOT_REQUIRED' && (
                          <Scissors className="w-3.5 h-3.5" />
                        )}
                        {WORKSHOP_LABEL[t.workshopStatus]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> Hoja
                      </button>
                      {next && (
                        <button
                          type="button"
                          onClick={() => advanceWorkshop(t)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 inline-flex items-center gap-1"
                        >
                          Avanzar <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Ticket · Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">Destino y Carga</th>
                <th className="text-left px-4 py-3 font-semibold">Chofer Asignado</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <p className="font-mono font-bold text-slate-900">{d.ticketCode}</p>
                    <p className="text-xs text-slate-600">{d.customerName}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{d.address}</p>
                    <p className="text-slate-500">{d.itemsSummary}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={d.driverName}
                      onChange={(e) =>
                        updateDelivery(
                          d.id,
                          { driverName: e.target.value, status: 'ASSIGNED' },
                          `Chofer asignado: ${e.target.value}`
                        )
                      }
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                    >
                      <option value="Por asignar">Por asignar</option>
                      <option value="Roberto Méndez">Roberto Méndez</option>
                      <option value="Carlos Paredes">Carlos Paredes</option>
                      <option value="Luis Hernández">Luis Hernández</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={d.status}
                      onChange={(e) =>
                        updateDelivery(
                          d.id,
                          { status: e.target.value as DeliveryStatus },
                          `Estado de entrega actualizado`
                        )
                      }
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold"
                    >
                      <option value="PENDING">Pendiente</option>
                      <option value="ASSIGNED">Asignada</option>
                      <option value="IN_ROUTE">En Ruta</option>
                      <option value="ARRIVED">En Sitio</option>
                      <option value="DELIVERED">Entregada</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PatioSheetModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
    </div>
  );
};
