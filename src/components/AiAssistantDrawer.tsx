import React, { useEffect, useState } from 'react';
import {
  X,
  Bot,
  Send,
  Loader2,
  ArrowRight,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AiAssistResponse,
  AppView,
  Role,
  SystemDiagnosticReport,
} from '../types';

interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  currentView: AppView;
  userRole: Role;
  allowedViews: AppView[];
  recentErrors: string[];
  onClearErrors: () => void;
  onNavigate: (view: AppView) => void;
  onRefreshSystem: () => void;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  steps?: string[];
  suggestedView?: AppView | 'none';
  diagnosticAction?: AiAssistResponse['diagnosticAction'];
  error?: boolean;
}

const WORKFLOW_MODULES: Array<{
  id: AppView;
  step: string;
  title: string;
  summary: string;
  howTo: string;
}> = [
  {
    id: 'wood',
    step: '01',
    title: 'Entrada de Madera y Pies Tablares',
    summary: 'Convierte medidas en cm a pulgadas/pies comerciales y calcula utilidad.',
    howTo: 'Ingresa grosor, ancho, largo, costo por pie tablar y vincula a un producto para sumar stock.',
  },
  {
    id: 'inventory',
    step: '02',
    title: 'Inventario en Patio',
    summary: 'Controla existencias, mínimos de alerta y ajustes auditados.',
    howTo: 'Filtra productos con stock bajo, da de alta nuevos SKUs o registra entradas/mermas.',
  },
  {
    id: 'optimizer',
    step: '03',
    title: 'Optimizador de Cortes 2D',
    summary: 'Acomoda piezas en tableros reduciendo desperdicio y considerando sierra.',
    howTo: 'Define medidas del tablero, agrega tus piezas y pulsa "Calcular Optimización 2D".',
  },
  {
    id: 'pos',
    step: '04',
    title: 'Punto de Venta (POS)',
    summary: 'Cobro atómico con IVA, maquila por partida y Hoja de Patio automática.',
    howTo: 'Agrega productos, opcionalmente define cortes en "Maquila", elige pago/entrega y confirma.',
  },
  {
    id: 'deliveries',
    step: '05',
    title: 'Patio, Taller y Entregas',
    summary: 'Seguimiento de sierra en taller y rutas de chofer.',
    howTo: 'Avanza el estado de las órdenes de maquila o asigna chofer y confirma entregas.',
  },
  {
    id: 'reports',
    step: '06',
    title: 'Facturas CFDI, Reportes y Base de Datos',
    summary: 'Emisión de facturas CFDI, cortes guardados, bitácora AES-256 y respaldo Cloud Firestore.',
    howTo: 'Timbra facturas desde tus tickets, guarda cortes financieros o sincroniza tus tablas con Cloud Firestore.',
  },
  {
    id: 'settings',
    step: '07',
    title: 'Seguridad Búnker y Sucursales',
    summary: 'Control del Modo Búnker, Watchdog del motor y alta de sucursales.',
    howTo: 'Desactiva el Modo Búnker si hubo bloqueos y administra tus razones sociales.',
  },
];

const QUICK_PROMPTS = [
  '¿Cómo funciona el sistema completo de punta a punta?',
  '¿Cómo entro a todos los módulos sin errores de permisos?',
  '¿Cómo hago una venta con maquila y hoja de patio?',
  'Diagnostica los errores actuales y dime cómo corregirlos.',
];

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  open,
  onClose,
  currentView,
  userRole,
  allowedViews,
  recentErrors,
  onClearErrors,
  onNavigate,
  onRefreshSystem,
}) => {
  const [tab, setTab] = useState<'chat' | 'workflow' | 'diagnostics'>('chat');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnosticReport | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Soy NicCore Copilot. Puedo explicarte paso a paso cómo trabajar en cada módulo, abrir el módulo que necesites o diagnosticar y corregir errores del sistema.',
      steps: [
        'Pregúntame cómo operar cualquier módulo (POS, Pies Tablares, Optimizador 2D, Taller).',
        'Usa la pestaña "Cómo Trabaja" para entrar directamente a cada paso del flujo.',
        'Usa "Diagnóstico" para verificar salud de módulos y limpiar errores.',
      ],
      suggestedView: 'none',
      diagnosticAction: 'NONE',
    },
  ]);

  const fetchDiagnostics = async () => {
    setLoadingDiag(true);
    try {
      const res = await fetch('/api/v1/ai/diagnostics');
      if (res.ok) {
        setDiagnostics(await res.json());
      }
    } finally {
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchDiagnostics();
    }
  }, [open]);

  if (!open) return null;

  const executeFixAction = async (action: AiAssistResponse['diagnosticAction']) => {
    if (action === 'RESET_BUNKER') {
      const res = await fetch('/api/v1/admin/bunker/deactivate', { method: 'POST' });
      if (res.ok) {
        toast.success('Modo Búnker desactivado');
        onRefreshSystem();
        await fetchDiagnostics();
      }
    } else if (action === 'CLEAR_ERRORS') {
      onClearErrors();
      toast.success('Registro de errores limpiado');
    } else if (action === 'RUN_HEALTH_CHECK' || action === 'REFRESH_DATA') {
      onRefreshSystem();
      await fetchDiagnostics();
      toast.success('Diagnóstico y datos actualizados');
    }
  };

  const sendQuestion = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || sending) return;

    const userMsg: ChatTurn = { id: `u_${Date.now()}`, role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/v1/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          currentView,
          userRole,
          recentErrors,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al consultar la IA');
      }

      const aiMsg: ChatTurn = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: data.answer,
        steps: data.steps,
        suggestedView: data.suggestedView,
        diagnosticAction: data.diagnosticAction,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errText = err instanceof Error ? err.message : 'Error consultando Gemini';
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: errText,
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const tryOpenModule = (target: AppView) => {
    if (!allowedViews.includes(target)) {
      toast.warning(
        `Tu rol actual (${userRole}) no tiene acceso a "${target}". Inicia sesión como ADMIN o MANAGER.`
      );
      return;
    }
    onNavigate(target);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs no-print">
      <div className="w-full max-w-xl bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold">NicCore Copilot IA</h2>
              <p className="text-[11px] text-slate-300">
                Guía operativa, entrada a módulos y corrección de errores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
            className="p-1.5 text-slate-300 hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'chat' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Asistente Gemini
          </button>
          <button
            type="button"
            onClick={() => setTab('workflow')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
              tab === 'workflow'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Cómo Trabaja
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('diagnostics');
              fetchDiagnostics();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
              tab === 'diagnostics'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            Diagnóstico ({recentErrors.length})
          </button>
        </div>

        {/* Body */}
        {tab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl p-4 text-sm space-y-3 ${
                      m.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : m.error
                        ? 'bg-red-50 border border-red-200 text-red-900'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-line">{m.text}</p>

                    {m.steps && m.steps.length > 0 && (
                      <ol className="space-y-1.5 text-xs text-slate-700 list-decimal list-inside pt-1 border-t border-slate-200">
                        {m.steps.map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ol>
                    )}

                    {(m.suggestedView && m.suggestedView !== 'none') ||
                    (m.diagnosticAction && m.diagnosticAction !== 'NONE') ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {m.suggestedView && m.suggestedView !== 'none' && (
                          <button
                            type="button"
                            onClick={() => tryOpenModule(m.suggestedView as AppView)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 inline-flex items-center gap-1.5"
                          >
                            Entrar a {m.suggestedView} <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {m.diagnosticAction && m.diagnosticAction !== 'NONE' && (
                          <button
                            type="button"
                            onClick={() => executeFixAction(m.diagnosticAction!)}
                            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 inline-flex items-center gap-1.5"
                          >
                            <Wrench className="w-3.5 h-3.5" /> Aplicar Corrección
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  Consultando a NicCore Copilot (Gemini)...
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-white space-y-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    type="button"
                    key={qp}
                    onClick={() => sendQuestion(qp)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-lg whitespace-nowrap shrink-0"
                  >
                    {qp}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendQuestion(input);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Pregunta cómo usar un módulo o pega un error..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Send className="w-4 h-4" />
                  Enviar
                </button>
              </form>
            </div>
          </>
        )}

        {tab === 'workflow' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <p className="text-xs text-slate-500 mb-2">
              Flujo operativo recomendado de la maderería. Pulsa cualquier módulo para entrar
              directamente (rol actual: <span className="font-bold text-slate-800">{userRole}</span>
              ).
            </p>
            {WORKFLOW_MODULES.map((mod) => {
              const allowed = allowedViews.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  className="p-4 bg-white border border-slate-200 rounded-xl space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono text-emerald-700 font-bold">
                        Paso {mod.step}
                      </p>
                      <h4 className="font-bold text-slate-900 text-sm">{mod.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => tryOpenModule(mod.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shrink-0 ${
                        allowed
                          ? 'bg-slate-900 text-white hover:bg-slate-800'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {allowed ? 'Entrar' : 'Requiere Admin'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600">{mod.summary}</p>
                  <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700">Cómo trabajar: </span>
                    {mod.howTo}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'diagnostics' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Estado de Todos los Módulos</h3>
                <p className="text-xs text-slate-500">
                  Verificación en vivo de rutas API, inventario y seguridad
                </p>
              </div>
              <button
                type="button"
                onClick={fetchDiagnostics}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDiag ? 'animate-spin' : ''}`} />
                Reescanear
              </button>
            </div>

            {diagnostics && (
              <div className="space-y-2.5">
                {diagnostics.modules.map((item) => (
                  <div
                    key={item.viewId}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {item.status === 'OK' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <p className="text-xs font-bold text-slate-900">{item.module}</p>
                      </div>
                      <p className="text-xs text-slate-600">{item.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => tryOpenModule(item.viewId)}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
                    >
                      Abrir
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">
                  Errores Capturados ({recentErrors.length})
                </h4>
                {recentErrors.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearErrors}
                    className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpiar
                  </button>
                )}
              </div>

              {recentErrors.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  No se han detectado errores en esta sesión.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentErrors.map((err, i) => (
                    <div
                      key={i}
                      className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-mono text-red-800 break-words"
                    >
                      {err}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTab('chat');
                      sendQuestion(
                        `Analiza y corrige estos errores detectados en la aplicación: ${recentErrors.join(
                          '; '
                        )}`
                      );
                    }}
                    className="w-full py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700"
                  >
                    Pedir a Gemini que Analice y Corrija estos Errores
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
