import { GoogleGenAI, Type } from '@google/genai';
import { erpStore } from './erpStore.ts';
import { cppBridge } from '../core/cpp_bridge.ts';

export interface AiAssistResult {
  answer: string;
  steps: string[];
  suggestedView:
    | 'dashboard'
    | 'pos'
    | 'inventory'
    | 'deliveries'
    | 'optimizer'
    | 'wood'
    | 'reports'
    | 'settings'
    | 'none';
  diagnosticAction: 'RUN_HEALTH_CHECK' | 'REFRESH_DATA' | 'RESET_BUNKER' | 'CLEAR_ERRORS' | 'NONE';
  modelUsed: string;
}

export interface SystemDiagnosticItem {
  module: string;
  viewId: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  detail: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const aiService = {
  runModuleDiagnostics(bunkerMode: boolean): {
    overall: 'HEALTHY' | 'ATTENTION';
    bunkerMode: boolean;
    modules: SystemDiagnosticItem[];
  } {
    const products = erpStore.getProducts();
    const lowStock = products.filter((p) => p.stock <= p.minAlert);
    const reports = erpStore.getReportsSummary();
    const bridge = cppBridge.getStatus();

    const modules: SystemDiagnosticItem[] = [
      {
        module: 'Dashboard General',
        viewId: 'dashboard',
        status: 'OK',
        detail: `${reports.confirmedTickets} tickets confirmados · $${reports.totalSales.toFixed(2)} en ventas.`,
      },
      {
        module: 'Punto de Venta (POS)',
        viewId: 'pos',
        status: products.length > 0 ? 'OK' : 'ERROR',
        detail: `${products.length} productos activos listos para cobro atómico con IVA y maquila.`,
      },
      {
        module: 'Inventario de Madera',
        viewId: 'inventory',
        status: lowStock.length > 0 ? 'WARNING' : 'OK',
        detail:
          lowStock.length > 0
            ? `${lowStock.length} producto(s) por debajo del stock mínimo.`
            : 'Existencias saludables en patio.',
      },
      {
        module: 'Patio, Taller y Entregas',
        viewId: 'deliveries',
        status: 'OK',
        detail: `${reports.pendingWorkshop} órdenes en sierra · ${reports.pendingDeliveries} entregas activas.`,
      },
      {
        module: 'Optimizador de Cortes 2D',
        viewId: 'optimizer',
        status: 'OK',
        detail: `Motor activo en modo ${bridge.mode}.`,
      },
      {
        module: 'Entrada de Madera (Pies Tablares)',
        viewId: 'wood',
        status: 'OK',
        detail: 'Calculadora tablar (G"×A"×L\'/12) y alta de lotes operativa.',
      },
      {
        module: 'Reportes y Auditoría AES-256',
        viewId: 'reports',
        status: 'OK',
        detail: `${cppBridge.getAuditLogs(false).length} bloques cifrados registrados.`,
      },
      {
        module: 'Seguridad y Modo Búnker',
        viewId: 'settings',
        status: bunkerMode ? 'WARNING' : 'OK',
        detail: bunkerMode
          ? 'Modo Búnker activo por anomalía o intentos fallidos. Puedes desactivarlo en Seguridad.'
          : 'Protección nominal sin bloqueos activos.',
      },
    ];

    return {
      overall: bunkerMode || lowStock.length > 0 ? 'ATTENTION' : 'HEALTHY',
      bunkerMode,
      modules,
    };
  },

  async assist(params: {
    question: string;
    currentView: string;
    userRole: string;
    recentErrors?: string[];
    bunkerMode: boolean;
  }): Promise<AiAssistResult> {
    const ai = getGeminiClient();
    const summary = erpStore.getReportsSummary();
    const bridge = cppBridge.getStatus();
    const diagnostics = this.runModuleDiagnostics(params.bunkerMode);

    if (!ai) {
      throw new Error(
        'GEMINI_API_KEY no está configurada en el servidor. Configúrala en Settings > Secrets para habilitar el asistente Gemini.'
      );
    }

    const systemInstruction = `Eres NicCore Copilot, la IA especialista del ERP maderero NicCore: Timber ERP.
Tu trabajo es:
1. Explicar con claridad en español cómo funciona el sistema NicCore y cómo trabajar paso a paso en cada módulo.
2. Guiar al usuario para entrar al módulo correcto según su duda o rol.
3. Diagnosticar errores reportados por el usuario o capturados en consola/API y sugerir la acción automática que lo resuelve.

Módulos disponibles y roles permitidos:
- dashboard ("Dashboard General"): Roles ADMIN, MANAGER. Muestra KPIs, ventas, IVA, alertas de stock bajo y últimas hojas de patio.
- pos ("Punto de Venta"): Roles ADMIN, MANAGER, OPERATOR. Permite agregar productos, configurar maquila (corte a medida), aplicar IVA 16%, elegir método de pago (Efectivo, Tarjeta, Transferencia, Crédito con hook Telegram), elegir retiro o envío a domicilio, descontar stock atómicamente y generar Hoja de Patio imprimible.
- inventory ("Inventario de Madera"): Roles ADMIN, MANAGER, OPERATOR. Muestra catálogo con SKU, medidas, costo, precio, stock mínimo, alta de productos y ajustes auditados (+/-).
- deliveries ("Patio, Taller y Entregas"): Roles ADMIN, MANAGER, OPERATOR, VIEWER. Para Admin/Manager/Operator gestiona órdenes de maquila en sierra y asignación de choferes. Para VIEWER (Chofer) muestra la vista móvil de entregas.
- optimizer ("Optimizador de Cortes 2D"): Roles ADMIN, MANAGER. Calcula acomodo óptimo 2D de piezas sobre tableros (ej. 122x244 cm) considerando grosor de sierra (kerf) y rotación.
- wood ("Entrada de Madera"): Roles ADMIN, MANAGER. Convierte cm a pulgadas/pies comerciales, calcula Pies Tablares PT=(G"*A"*L')/12, m3, precio público con margen y suma el lote al inventario.
- reports ("Reportes y Auditoría"): Roles ADMIN, MANAGER. Desglose por método de pago, exportación CSV y verificación/descifrado de bloques AES-256.
- settings ("Seguridad y Sucursales"): Solo rol ADMIN. Control del Modo Búnker, estado del Watchdog C++ y administración de empresas/sucursales.

Regla clave de acceso: si un usuario con rol OPERATOR o VIEWER intenta entrar a módulos de ADMIN/MANAGER (como Optimizador, Entrada de Madera, Reportes o Seguridad), debe iniciar sesión con una cuenta ADMIN o MANAGER (por ejemplo admin@niccore.mx).

Contexto en tiempo real del sistema:
- Vista actual del usuario: ${params.currentView}
- Rol actual del usuario: ${params.userRole}
- Modo Búnker activo: ${params.bunkerMode ? 'SI' : 'NO'}
- Motor cálculo/puente: ${bridge.mode}
- Productos en inventario: ${erpStore.getProducts().length} (${summary.lowStockCount} con stock bajo)
- Tickets confirmados: ${summary.confirmedTickets}, Entregas pendientes: ${summary.pendingDeliveries}
- Estado módulos: ${JSON.stringify(diagnostics.modules)}
- Errores recientes capturados en el navegador: ${
      params.recentErrors && params.recentErrors.length > 0
        ? params.recentErrors.join(' | ')
        : 'Ninguno'
    }

Responde siempre en español claro, directo y práctico.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: params.question,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: 'Explicación clara y directa en español sobre cómo funciona o cómo corregir el error.',
            },
            steps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de 2 a 5 pasos concretos para operar el módulo o resolver el error.',
            },
            suggestedView: {
              type: Type.STRING,
              description:
                'El ID del módulo al que debería entrar el usuario: dashboard, pos, inventory, deliveries, optimizer, wood, reports, settings, o none.',
            },
            diagnosticAction: {
              type: Type.STRING,
              description:
                'Acción automática sugerida: RUN_HEALTH_CHECK, REFRESH_DATA, RESET_BUNKER, CLEAR_ERRORS, o NONE.',
            },
          },
          required: ['answer', 'steps', 'suggestedView', 'diagnosticAction'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    const parsed = JSON.parse(rawText || '{}');

    const validViews = new Set([
      'dashboard',
      'pos',
      'inventory',
      'deliveries',
      'optimizer',
      'wood',
      'reports',
      'settings',
      'none',
    ]);
    const validActions = new Set([
      'RUN_HEALTH_CHECK',
      'REFRESH_DATA',
      'RESET_BUNKER',
      'CLEAR_ERRORS',
      'NONE',
    ]);

    return {
      answer: parsed.answer || 'No se pudo generar respuesta.',
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      suggestedView: validViews.has(parsed.suggestedView) ? parsed.suggestedView : 'none',
      diagnosticAction: validActions.has(parsed.diagnosticAction)
        ? parsed.diagnosticAction
        : 'NONE',
      modelUsed: 'gemini-4-hydrogen',
    };
  },
};
