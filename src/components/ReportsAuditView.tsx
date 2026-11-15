import React, { useEffect, useState } from 'react';
import {
  Download,
  Lock,
  Unlock,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Database,
  Plus,
  CheckCircle2,
  XCircle,
  Cloud,
  BookmarkCheck,
  Code2,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { toast } from 'sonner';
import {
  AuditEntry,
  DatabaseOverview,
  InvoiceRecord,
  ReportsSummary,
  SavedReportRecord,
  Ticket,
} from '../types';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  getFirestoreCollectionCounts,
  syncAllErpStateToFirestore,
  syncInvoiceToFirestore,
  syncSavedReportToFirestore,
  syncUserProfileToFirestore,
} from '../lib/firestorePersistence';

type TabId = 'invoices' | 'reports' | 'audit' | 'database';

export const ReportsAuditView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('invoices');
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportRecord[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [dbOverview, setDbOverview] = useState<DatabaseOverview | null>(null);
  const [cloudCounts, setCloudCounts] = useState<Record<string, number> | null>(null);
  const [decrypted, setDecrypted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncingCloud, setSyncingCloud] = useState(false);

  // New Invoice form
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [selectedTicketCode, setSelectedTicketCode] = useState('');
  const [rfcReceptor, setRfcReceptor] = useState('XAXX010101000');
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [usoCFDI, setUsoCFDI] = useState('G03');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [xmlModalInvoice, setXmlModalInvoice] = useState<InvoiceRecord | null>(null);

  // New Saved Report form
  const [reportTitle, setReportTitle] = useState('');
  const [savingReport, setSavingReport] = useState(false);

  const loadData = async (decryptFlag = decrypted) => {
    setLoading(true);
    try {
      const [repRes, invRes, tickRes, savedRepRes, audRes, dbRes] = await Promise.all([
        fetch('/api/v1/admin/reports'),
        fetch('/api/v1/admin/invoices'),
        fetch('/api/v1/cashier/tickets'),
        fetch('/api/v1/admin/reports/saved'),
        fetch(`/api/v1/admin/audit-logs?decrypt=${decryptFlag}`),
        fetch('/api/v1/admin/database-status'),
      ]);

      if (repRes.ok) setSummary(await repRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
      if (tickRes.ok) {
        const tData: Ticket[] = await tickRes.json();
        setTickets(tData);
        if (tData.length > 0 && !selectedTicketCode) {
          setSelectedTicketCode(tData[0].code);
          setNombreReceptor(tData[0].customerName);
        }
      }
      if (savedRepRes.ok) setSavedReports(await savedRepRes.json());
      if (audRes.ok) {
        const data = await audRes.json();
        setAuditEntries(data.entries || []);
      }
      if (dbRes.ok) setDbOverview(await dbRes.json());

      if (auth.currentUser?.emailVerified) {
        getFirestoreCollectionCounts()
          .then((counts) => setCloudCounts(counts))
          .catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const toggleDecrypt = async () => {
    const next = !decrypted;
    setDecrypted(next);
    await loadData(next);
    toast.info(next ? 'Bloques AES-256 descifrados y verificados' : 'Mostrando bloques cifrados');
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketCode) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch('/api/v1/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketIdOrCode: selectedTicketCode,
          rfcReceptor,
          nombreReceptor,
          usoCFDI,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al emitir factura');
      syncInvoiceToFirestore(data).catch(() => {});
      toast.success(`Factura ${data.folio} timbrada y guardada`);
      setShowNewInvoice(false);
      await loadData(decrypted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al timbrar factura');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleCancelInvoice = async (inv: InvoiceRecord) => {
    const res = await fetch(`/api/v1/admin/invoices/${inv.id}/cancel`, { method: 'PATCH' });
    if (res.ok) {
      const updated = await res.json();
      syncInvoiceToFirestore(updated).catch(() => {});
      toast.warning(`Factura ${inv.folio} cancelada`);
      await loadData(decrypted);
    }
  };

  const handleSaveReportSnapshot = async () => {
    setSavingReport(true);
    try {
      const res = await fetch('/api/v1/admin/reports/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reportTitle.trim() || undefined,
          createdBy: auth.currentUser?.email || 'Administrador',
        }),
      });
      if (!res.ok) throw new Error('No se pudo guardar el corte');
      const created: SavedReportRecord = await res.json();
      syncSavedReportToFirestore(created).catch(() => {});
      toast.success(`Corte "${created.title}" guardado en base de datos`);
      setReportTitle('');
      await loadData(decrypted);
    } catch {
      toast.error('Error al guardar reporte');
    } finally {
      setSavingReport(false);
    }
  };

  const handleConnectAndSyncFirestore = async () => {
    setSyncingCloud(true);
    try {
      if (!auth.currentUser) {
        const cred = await signInWithPopup(auth, googleAuthProvider);
        await syncUserProfileToFirestore({
          name: cred.user.displayName || cred.user.email || 'Usuario',
          email: cred.user.email || 'usuario@niccore.mx',
          role: 'ADMIN',
        });
      }
      const synced = await syncAllErpStateToFirestore();
      const counts = await getFirestoreCollectionCounts();
      setCloudCounts(counts);
      toast.success(`Respaldo completado en Cloud Firestore (${synced} registros sincronizados)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo sincronizar con Firestore');
    } finally {
      setSyncingCloud(false);
    }
  };

  const exportCsv = () => {
    if (!summary) return;
    const headers = ['Folio', 'Fecha', 'Cliente', 'Pago', 'Subtotal', 'IVA', 'Total', 'Taller'];
    const rows = summary.recentTickets.map((t) => [
      t.code,
      t.confirmedAt,
      `"${t.customerName.replace(/"/g, '""')}"`,
      t.paymentMethod,
      t.subtotal.toFixed(2),
      t.taxAmount.toFixed(2),
      t.total.toFixed(2),
      t.workshopStatus,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `niccore_reporte_ventas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Reporte CSV descargado');
  };

  const downloadXml = (inv: InvoiceRecord) => {
    const blob = new Blob([inv.xmlPreview], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${inv.folio}_${inv.rfcReceptor}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`XML ${inv.folio} descargado`);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 border border-slate-200 rounded-2xl">
        {[
          { id: 'invoices' as TabId, label: `Facturas CFDI (${invoices.length})`, icon: FileText },
          { id: 'reports' as TabId, label: `Cortes y Reportes (${savedReports.length})`, icon: FileSpreadsheet },
          { id: 'audit' as TabId, label: `Auditoría de Acciones (${auditEntries.length})`, icon: Lock },
          { id: 'database' as TabId, label: 'Base de Datos y Respaldo', icon: Database },
        ].map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: FACTURAS CFDI */}
      {activeTab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Facturas Emitidas (CFDI 4.0)</h3>
              <p className="text-xs text-slate-500">
                Cada factura se guarda en servidor y Cloud Firestore con UUID fiscal y XML
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewInvoice(!showNewInvoice)}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Emitir Factura desde Ticket
            </button>
          </div>

          {showNewInvoice && (
            <form
              onSubmit={handleCreateInvoice}
              className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Ticket Confirmado</label>
                <select
                  value={selectedTicketCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedTicketCode(code);
                    const found = tickets.find((t) => t.code === code);
                    if (found) setNombreReceptor(found.customerName);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                >
                  {tickets.map((t) => (
                    <option key={t.id} value={t.code}>
                      {t.code} (${t.total.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">RFC Receptor</label>
                <input
                  type="text"
                  required
                  minLength={10}
                  value={rfcReceptor}
                  onChange={(e) => setRfcReceptor(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Razón Social</label>
                <input
                  type="text"
                  required
                  value={nombreReceptor}
                  onChange={(e) => setNombreReceptor(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="flex items-end gap-2">
                <select
                  value={usoCFDI}
                  onChange={(e) => setUsoCFDI(e.target.value)}
                  className="w-24 px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                >
                  <option value="G03">G03</option>
                  <option value="G01">G01</option>
                  <option value="S01">S01</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingInvoice}
                  className="flex-1 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50"
                >
                  {creatingInvoice ? 'Timbrando...' : 'Timbrar CFDI'}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Folio / Ticket</th>
                  <th className="py-3 px-4">Receptor / RFC</th>
                  <th className="py-3 px-4">UUID SAT</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 font-mono">{inv.folio}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{inv.ticketCode}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{inv.nombreReceptor}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {inv.rfcReceptor} · Uso {inv.usoCFDI}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">{inv.uuid}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      ${inv.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          inv.status === 'STAMPED' ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {inv.status === 'STAMPED' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {inv.status === 'STAMPED' ? 'TIMBRADA' : 'CANCELADA'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => setXmlModalInvoice(inv)}
                        className="px-2.5 py-1 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                      >
                        <Code2 className="w-3 h-3" /> XML
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadXml(inv)}
                        className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-semibold hover:bg-slate-800 inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Descargar
                      </button>
                      {inv.status === 'STAMPED' && (
                        <button
                          type="button"
                          onClick={() => handleCancelInvoice(inv)}
                          className="px-2 py-1 text-[11px] font-semibold text-red-600 hover:underline"
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CORTES Y REPORTES */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Corte Financiero Actual</h3>
                <p className="text-xs text-slate-500">
                  Desglose acumulado por método de pago y exportación inmediata
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Título del corte (ej. Cierre Turno Vespertino)"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-64"
                />
                <button
                  type="button"
                  disabled={savingReport}
                  onClick={handleSaveReportSnapshot}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <BookmarkCheck className="w-4 h-4" />
                  Guardar Corte en BD
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!summary || summary.recentTickets.length === 0}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {summary && Object.keys(summary.byPaymentMethod).length > 0 ? (
                (Object.entries(summary.byPaymentMethod) as Array<[string, number]>).map(
                  ([method, amount]) => (
                    <div key={method} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-xs font-semibold text-slate-500">{method}</p>
                      <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                        ${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )
                )
              ) : (
                <p className="col-span-4 text-xs text-slate-500">Sin movimientos financieros aún.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                Historial de Reportes Guardados ({savedReports.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-200">
              {savedReports.length === 0 ? (
                <p className="p-6 text-xs text-slate-500">
                  Pulsa "Guardar Corte en BD" para archivar un reporte financiero permanente.
                </p>
              ) : (
                savedReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{rep.title}</p>
                      <p className="text-slate-500 font-mono">
                        {new Date(rep.createdAt).toLocaleString('es-MX')} · {rep.createdBy}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 font-mono tabular-nums">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Ventas</span>
                        <span className="font-bold text-slate-900">
                          ${rep.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">IVA</span>
                        <span className="font-bold text-slate-900">${rep.totalTax.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Tickets / Facturas</span>
                        <span className="font-bold text-emerald-700">
                          {rep.confirmedTickets} / {rep.invoicesCount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDITORÍA DE ACCIONES */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-slate-700" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Auditoría Inmutable (AES-256 Append-Only)
                </h3>
                <p className="text-xs text-slate-500">
                  Registro criptográfico permanente de cada venta, factura, ajuste e inicio de sesión
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleDecrypt}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border inline-flex items-center gap-1.5 transition-colors ${
                  decrypted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {decrypted ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {decrypted ? 'Ocultar Descifrado' : 'Verificar y Descifrar'}
              </button>
              <button
                type="button"
                onClick={() => loadData(decrypted)}
                className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
                aria-label="Actualizar bitácora"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Leyendo bloques...</div>
            ) : auditEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay registros en la bitácora de auditoría.
              </div>
            ) : (
              auditEntries.map((entry, idx) => (
                <div key={idx} className="px-6 py-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 text-slate-500 font-mono">
                    <span>{new Date(entry.timestamp).toLocaleString('es-MX')}</span>
                    <span>
                      {decrypted
                        ? entry.verified
                          ? 'INTEGRIDAD VERIFICADA'
                          : 'FIRMA INVÁLIDA'
                        : `IV: ${entry.iv.slice(0, 12)}...`}
                    </span>
                  </div>
                  {decrypted && entry.decrypted ? (
                    <pre className="p-2.5 bg-slate-900 text-emerald-300 rounded-lg font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(entry.decrypted)}
                    </pre>
                  ) : (
                    <p className="font-mono text-[11px] text-slate-600 break-all bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {entry.cipherText}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BASE DE DATOS Y RESPALDO */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Persistencia en Servidor + Cloud Firestore
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                Todos tus datos se guardan atómicamente en disco del servidor y se replican a tu base
                de datos Cloud Firestore cuando vinculas tu cuenta Google.
              </p>
              {dbOverview && (
                <p className="text-[11px] font-mono text-slate-500">
                  Archivo servidor: {dbOverview.serverFile.filePath} (
                  {(dbOverview.serverFile.sizeBytes / 1024).toFixed(1)} KB) · Firestore:{' '}
                  {auth.currentUser ? `Conectado (${auth.currentUser.email})` : 'Pendiente de vincular Google'}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={syncingCloud}
              onClick={handleConnectAndSyncFirestore}
              className="px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingCloud ? 'animate-spin' : ''}`} />
              {auth.currentUser
                ? 'Sincronizar Todo a Cloud Firestore'
                : 'Conectar Google y Respaldar en Firestore'}
            </button>
          </div>

          {dbOverview && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { key: 'products', label: 'Productos Catálogo', local: dbOverview.counts.products },
                { key: 'tickets', label: 'Tickets de Venta', local: dbOverview.counts.tickets },
                { key: 'invoices', label: 'Facturas CFDI', local: dbOverview.counts.invoices },
                { key: 'deliveries', label: 'Entregas Logística', local: dbOverview.counts.deliveries },
                { key: 'woodEntries', label: 'Entradas Madera', local: dbOverview.counts.woodEntries },
                { key: 'cutOptimizations', label: 'Cortes 2D', local: dbOverview.counts.cutOptimizations },
                { key: 'reports', label: 'Reportes Guardados', local: dbOverview.counts.savedReports },
                { key: 'auditLogs', label: 'Acciones AES-256', local: dbOverview.counts.auditLogs },
                { key: 'companies', label: 'Sucursales', local: dbOverview.counts.companies },
                { key: 'users', label: 'Usuarios ERP', local: dbOverview.counts.users },
              ].map((item) => (
                <div
                  key={item.key}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1"
                >
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {item.local}
                  </p>
                  {cloudCounts && item.key in cloudCounts && (
                    <p className="text-[11px] font-mono text-emerald-700">
                      Firestore: {cloudCounts[item.key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* XML Modal */}
      {xmlModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h4 className="font-bold text-slate-900 text-sm">
                XML CFDI 4.0 · {xmlModalInvoice.folio}
              </h4>
              <button
                type="button"
                onClick={() => setXmlModalInvoice(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cerrar
              </button>
            </div>
            <div className="p-6">
              <pre className="p-4 bg-slate-900 text-emerald-300 rounded-xl font-mono text-xs overflow-x-auto">
                {xmlModalInvoice.xmlPreview}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
