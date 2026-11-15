import React from 'react';
import { X, Printer, Scissors, Truck, PackageCheck } from 'lucide-react';
import { Ticket } from '../types';

interface PatioSheetModalProps {
  ticket: Ticket | null;
  onClose: () => void;
}

const WORKSHOP_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Sin maquila',
  PENDING_WORKSHOP: 'Pendiente de corte',
  IN_WORKSHOP: 'En sierra / taller',
  WORKSHOP_DONE: 'Corte terminado',
  DELIVERED: 'Entregado',
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD_CREDIT: 'Tarjeta Crédito',
  CARD_DEBIT: 'Tarjeta Débito',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito / Fiado',
  MIXED: 'Mixto',
};

export const PatioSheetModal: React.FC<PatioSheetModalProps> = ({ ticket, onClose }) => {
  if (!ticket) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patio-sheet-title"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div>
            <h3 id="patio-sheet-title" className="text-lg font-bold text-slate-900">
              Hoja de Patio y Comprobante
            </h3>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              {ticket.patioSheet.folio} · {ticket.code}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-500">Cliente</p>
              <p className="text-base font-bold text-slate-900">{ticket.customerName}</p>
              <p className="text-xs text-slate-500 mt-1">
                {new Date(ticket.confirmedAt).toLocaleString('es-MX')} · Pago:{' '}
                {PAYMENT_LABELS[ticket.paymentMethod] || ticket.paymentMethod}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-500">Estado de Taller</p>
              <p className="text-sm font-bold text-slate-900">
                {WORKSHOP_LABELS[ticket.workshopStatus] || ticket.workshopStatus}
              </p>
              <p className="text-xs text-slate-500 mt-1 flex items-center justify-end gap-1">
                {ticket.deliveryType === 'DELIVERY' ? (
                  <>
                    <Truck className="w-3.5 h-3.5" /> Entrega a domicilio
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-3.5 h-3.5" /> Retiro inmediato en patio
                  </>
                )}
              </p>
            </div>
          </div>

          {ticket.deliveryAddress && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Dirección de entrega: </span>
              {ticket.deliveryAddress}
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Detalle de Material y Maquila
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Producto / SKU</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Cant.</th>
                    <th className="text-right px-4 py-2.5 font-semibold">P. Unit</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ticket.items.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <tr>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{item.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          ${item.subtotal.toFixed(2)}
                        </td>
                      </tr>
                      {item.requiresCutting && item.cuttingSpecs && (
                        <tr className="bg-amber-50/70">
                          <td colSpan={4} className="px-4 py-2 text-xs text-amber-900">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              <Scissors className="w-3.5 h-3.5" />
                              Instrucción de corte:
                            </span>{' '}
                            <span className="font-mono tabular-nums">
                              {item.cuttingSpecs.width || '-'} × {item.cuttingSpecs.length || '-'} ×{' '}
                              {item.cuttingSpecs.thickness || '-'} cm
                            </span>
                            {item.cuttingSpecs.notes ? ` · ${item.cuttingSpecs.notes}` : ''}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">${ticket.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IVA ({Math.round(ticket.taxRate * 100)}%)</span>
                <span className="font-mono tabular-nums">${ticket.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total</span>
                <span className="font-mono tabular-nums">${ticket.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
