export type Role = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export type AppView =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'deliveries'
  | 'optimizer'
  | 'wood'
  | 'reports'
  | 'settings';

export type UnitType =
  | 'M2'
  | 'M3'
  | 'KG'
  | 'LITER'
  | 'LINEAR_M'
  | 'FEET'
  | 'INCH'
  | 'PIECE';

export type WoodClass = 'PRIMERA' | 'SEGUNDA' | 'TERCERA' | 'ESPECIAL';

export type PaymentMethod =
  | 'CASH'
  | 'CARD_CREDIT'
  | 'CARD_DEBIT'
  | 'TRANSFER'
  | 'CREDIT'
  | 'MIXED';

export type WorkshopStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_WORKSHOP'
  | 'IN_WORKSHOP'
  | 'WORKSHOP_DONE'
  | 'DELIVERED';

export type DeliveryType = 'IMMEDIATE' | 'DELIVERY';

export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_ROUTE'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'FAILED';

export interface Product {
  id: string;
  name: string;
  sku: string;
  unit: UnitType;
  woodClass: WoodClass;
  measure: string;
  cost: number;
  price: number;
  stock: number;
  minAlert: number;
  active: boolean;
  updatedAt: string;
}

export interface MaquilaSpecs {
  width: string;
  length: string;
  thickness: string;
  notes: string;
}

export interface CartItem extends Product {
  qty: number;
  cuts: MaquilaSpecs | null;
}

export interface TicketItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  requiresCutting: boolean;
  cuttingSpecs?: MaquilaSpecs | null;
}

export interface PatioSheet {
  folio: string;
  ticketCode: string;
  customerName: string;
  generatedAt: string;
  workshopStatus: WorkshopStatus;
  deliveryType: DeliveryType;
  items: TicketItem[];
}

export interface Ticket {
  id: string;
  code: string;
  customerName: string;
  items: TicketItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  paymentMethod: PaymentMethod;
  workshopStatus: WorkshopStatus;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  patioSheet: PatioSheet;
  createdAt: string;
  confirmedAt: string;
  telegramNotified?: boolean;
}

export interface Delivery {
  id: string;
  ticketCode: string;
  customerName: string;
  phone: string;
  address: string;
  driverName: string;
  status: DeliveryStatus;
  eta: string;
  itemsSummary: string;
  driverCheckedInAtYard: boolean;
  updatedAt: string;
}

export interface WoodCalculation {
  widthInch: number;
  thicknessInch: number;
  lengthFeet: number;
  boardFeetPerPiece: number;
  totalBoardFeet: number;
  totalM3: number;
  unitCost: number;
  publicUnitPrice: number;
  projectedProfit: number;
}

export interface WoodEntry extends WoodCalculation {
  id: string;
  species: string;
  woodClass: WoodClass;
  thicknessCm: number;
  widthCm: number;
  lengthCm: number;
  quantity: number;
  costPerBoardFoot: number;
  marginPercent: number;
  productId?: string;
  createdAt: string;
}

export interface PlacedPiece {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface SheetLayout {
  sheetIndex: number;
  width: number;
  height: number;
  efficiency: number;
  usedAreaCm2: number;
  wasteAreaCm2: number;
  pieces: PlacedPiece[];
}

export interface OptimizationResult {
  engine: 'CPP_SOCKET' | 'NODE_SIMULATION';
  stockWidth: number;
  stockHeight: number;
  kerfMm: number;
  sheetsCount: number;
  totalPiecesPlaced: number;
  unplacedCount: number;
  efficiency: number;
  wasteM2: number;
  sheets: SheetLayout[];
  computeTimeMs: number;
}

export interface AuditEntry {
  timestamp: string;
  iv: string;
  cipherText: string;
  decrypted?: Record<string, unknown> | null;
  verified: boolean;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  employees: number;
  revenue: number;
  foundedYear: number;
  status: 'Active' | 'Inactive';
  description: string;
  createdAt: string;
}

export interface ReportsSummary {
  totalSales: number;
  totalTax: number;
  confirmedTickets: number;
  totalTickets: number;
  lowStockCount: number;
  lowStockProducts: Product[];
  pendingDeliveries: number;
  pendingWorkshop: number;
  inventoryValuation: number;
  byPaymentMethod: Record<string, number>;
  recentTickets: Ticket[];
}

export interface HealthStatus {
  status: string;
  architecture: string;
  bunkerMode: boolean;
  errorCount: number;
  telegramConfigured: boolean;
  version: string;
  bridge: {
    watchdogActive: boolean;
    mode: 'CPP_SOCKET' | 'NODE_SIMULATION';
    socketPath: string;
    socketConnected: boolean;
    lastCheck: string;
  };
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface AiAssistResponse {
  answer: string;
  steps: string[];
  suggestedView: AppView | 'none';
  diagnosticAction: 'RUN_HEALTH_CHECK' | 'REFRESH_DATA' | 'RESET_BUNKER' | 'CLEAR_ERRORS' | 'NONE';
  modelUsed: string;
}

export interface SystemDiagnosticItem {
  module: string;
  viewId: AppView;
  status: 'OK' | 'WARNING' | 'ERROR';
  detail: string;
}

export interface SystemDiagnosticReport {
  overall: 'HEALTHY' | 'ATTENTION';
  bunkerMode: boolean;
  modules: SystemDiagnosticItem[];
}

export type InvoiceStatus = 'DRAFT' | 'STAMPED' | 'CANCELLED';

export interface InvoiceRecord {
  id: string;
  folio: string;
  serie: string;
  uuid: string;
  ticketId: string;
  ticketCode: string;
  rfcEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  usoCFDI: string;
  regimenFiscal: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  items: TicketItem[];
  xmlPreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedReportRecord {
  id: string;
  title: string;
  totalSales: number;
  totalTax: number;
  confirmedTickets: number;
  invoicesCount: number;
  inventoryValuation: number;
  byPaymentMethod: Record<string, number>;
  createdBy: string;
  createdAt: string;
}

export interface CutOptimizationRecord {
  id: string;
  engine: 'CPP_SOCKET' | 'NODE_SIMULATION';
  stockWidth: number;
  stockHeight: number;
  kerfMm: number;
  sheetsCount: number;
  totalPiecesPlaced: number;
  unplacedCount: number;
  efficiency: number;
  wasteM2: number;
  computeTimeMs: number;
  createdAt: string;
}

export interface DatabaseOverview {
  storageEngine: string;
  serverFile: {
    filePath: string;
    exists: boolean;
    sizeBytes: number;
    updatedAt: string | null;
  };
  counts: {
    products: number;
    tickets: number;
    invoices: number;
    deliveries: number;
    woodEntries: number;
    cutOptimizations: number;
    savedReports: number;
    auditLogs: number;
    companies: number;
    users: number;
  };
}


