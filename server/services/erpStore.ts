import crypto from 'crypto';
import {
  getPersistenceFileMeta,
  loadPersistedDatabase,
  savePersistedSection,
} from './persistence.ts';

export type UnitType = 'M2' | 'M3' | 'KG' | 'LITER' | 'LINEAR_M' | 'FEET' | 'INCH' | 'PIECE';
export type WoodClass = 'PRIMERA' | 'SEGUNDA' | 'TERCERA' | 'ESPECIAL';
export type PaymentMethod = 'CASH' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'TRANSFER' | 'CREDIT' | 'MIXED';
export type WorkshopStatus = 'NOT_REQUIRED' | 'PENDING_WORKSHOP' | 'IN_WORKSHOP' | 'WORKSHOP_DONE' | 'DELIVERED';
export type DeliveryType = 'IMMEDIATE' | 'DELIVERY';
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'IN_ROUTE' | 'ARRIVED' | 'DELIVERED' | 'FAILED';
export type InvoiceStatus = 'DRAFT' | 'STAMPED' | 'CANCELLED';

export interface ProductRecord {
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
  width?: string;
  length?: string;
  thickness?: string;
  notes?: string;
}

export interface TicketItemRecord {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  requiresCutting: boolean;
  cuttingSpecs?: MaquilaSpecs | null;
}

export interface PatioSheetRecord {
  folio: string;
  ticketCode: string;
  customerName: string;
  generatedAt: string;
  workshopStatus: WorkshopStatus;
  deliveryType: DeliveryType;
  items: TicketItemRecord[];
}

export interface TicketRecord {
  id: string;
  code: string;
  customerName: string;
  items: TicketItemRecord[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  paymentMethod: PaymentMethod;
  workshopStatus: WorkshopStatus;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  patioSheet: PatioSheetRecord;
  createdAt: string;
  confirmedAt: string;
}

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
  items: TicketItemRecord[];
  xmlPreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRecord {
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

export interface WoodEntryRecord {
  id: string;
  species: string;
  woodClass: WoodClass;
  thicknessCm: number;
  widthCm: number;
  lengthCm: number;
  thicknessInch: number;
  widthInch: number;
  lengthFeet: number;
  boardFeetPerPiece: number;
  quantity: number;
  totalBoardFeet: number;
  totalM3: number;
  costPerBoardFoot: number;
  marginPercent: number;
  unitCost: number;
  publicUnitPrice: number;
  projectedProfit: number;
  productId?: string;
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

const initialProducts: ProductRecord[] = [
  {
    id: 'p1',
    name: 'Tabla Pino Nacional 1ra',
    sku: 'PIN-101',
    unit: 'PIECE',
    woodClass: 'PRIMERA',
    measure: '30 × 2.5 × 250 cm (1"×12"×8\')',
    cost: 128.0,
    price: 185.94,
    stock: 95,
    minAlert: 15,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p2',
    name: 'Cedro Rojo Especial',
    sku: 'CED-204',
    unit: 'PIECE',
    woodClass: 'ESPECIAL',
    measure: '20 × 2.5 × 250 cm (1"×8"×8\')',
    cost: 165.0,
    price: 245.0,
    stock: 4,
    minAlert: 10,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p3',
    name: 'MDF Melamina Blanca 15mm',
    sku: 'MDF-150',
    unit: 'PIECE',
    woodClass: 'PRIMERA',
    measure: '122 × 244 × 1.5 cm',
    cost: 310.0,
    price: 420.0,
    stock: 48,
    minAlert: 12,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p4',
    name: 'Triplay Pino Arauco 18mm',
    sku: 'TRI-018',
    unit: 'PIECE',
    woodClass: 'PRIMERA',
    measure: '122 × 244 × 1.8 cm',
    cost: 495.0,
    price: 650.0,
    stock: 6,
    minAlert: 10,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p5',
    name: 'Polín Pino Construcción 4×4',
    sku: 'POL-404',
    unit: 'PIECE',
    woodClass: 'SEGUNDA',
    measure: '10 × 10 × 250 cm (4"×4"×8\')',
    cost: 92.0,
    price: 145.0,
    stock: 62,
    minAlert: 20,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p6',
    name: 'Viga Encino Estufado',
    sku: 'ENC-310',
    unit: 'PIECE',
    woodClass: 'ESPECIAL',
    measure: '15 × 7.5 × 300 cm (3"×6"×10\')',
    cost: 520.0,
    price: 780.0,
    stock: 9,
    minAlert: 10,
    active: true,
    updatedAt: new Date().toISOString(),
  },
];

const initialTickets: TicketRecord[] = [
  {
    id: 'tk_seed_1',
    code: 'VTA-20261115-0001',
    customerName: 'Carpintería San José',
    items: [
      {
        productId: 'p3',
        name: 'MDF Melamina Blanca 15mm',
        sku: 'MDF-150',
        quantity: 6,
        unitPrice: 420,
        subtotal: 2520,
        requiresCutting: true,
        cuttingSpecs: { width: '60', length: '120', thickness: '1.5', notes: 'Corte recto para puertas' },
      },
      {
        productId: 'p1',
        name: 'Tabla Pino Nacional 1ra',
        sku: 'PIN-101',
        quantity: 12,
        unitPrice: 185.94,
        subtotal: 2231.28,
        requiresCutting: false,
        cuttingSpecs: null,
      },
    ],
    subtotal: 4751.28,
    taxAmount: 760.2,
    taxRate: 0.16,
    total: 5511.48,
    paymentMethod: 'TRANSFER',
    workshopStatus: 'IN_WORKSHOP',
    deliveryType: 'DELIVERY',
    deliveryAddress: 'Calle Oriente 150, Col. Agrícola Oriental',
    status: 'CONFIRMED',
    patioSheet: {
      folio: 'HP-0001',
      ticketCode: 'VTA-20261115-0001',
      customerName: 'Carpintería San José',
      generatedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
      workshopStatus: 'IN_WORKSHOP',
      deliveryType: 'DELIVERY',
      items: [
        {
          productId: 'p3',
          name: 'MDF Melamina Blanca 15mm',
          sku: 'MDF-150',
          quantity: 6,
          unitPrice: 420,
          subtotal: 2520,
          requiresCutting: true,
          cuttingSpecs: { width: '60', length: '120', thickness: '1.5', notes: 'Corte recto para puertas' },
        },
        {
          productId: 'p1',
          name: 'Tabla Pino Nacional 1ra',
          sku: 'PIN-101',
          quantity: 12,
          unitPrice: 185.94,
          subtotal: 2231.28,
          requiresCutting: false,
          cuttingSpecs: null,
        },
      ],
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    confirmedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
  {
    id: 'tk_seed_2',
    code: 'VTA-20261115-0002',
    customerName: 'Constructora del Valle',
    items: [
      {
        productId: 'p5',
        name: 'Polín Pino Construcción 4×4',
        sku: 'POL-404',
        quantity: 20,
        unitPrice: 145,
        subtotal: 2900,
        requiresCutting: false,
        cuttingSpecs: null,
      },
    ],
    subtotal: 2900,
    taxAmount: 464,
    taxRate: 0.16,
    total: 3364,
    paymentMethod: 'CASH',
    workshopStatus: 'NOT_REQUIRED',
    deliveryType: 'DELIVERY',
    deliveryAddress: 'Av. Primero de Mayo 214, Naucalpan Centro',
    status: 'CONFIRMED',
    patioSheet: {
      folio: 'HP-0002',
      ticketCode: 'VTA-20261115-0002',
      customerName: 'Constructora del Valle',
      generatedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
      workshopStatus: 'NOT_REQUIRED',
      deliveryType: 'DELIVERY',
      items: [
        {
          productId: 'p5',
          name: 'Polín Pino Construcción 4×4',
          sku: 'POL-404',
          quantity: 20,
          unitPrice: 145,
          subtotal: 2900,
          requiresCutting: false,
          cuttingSpecs: null,
        },
      ],
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    confirmedAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
];

const initialDeliveries: DeliveryRecord[] = [
  {
    id: 'del_1',
    ticketCode: 'VTA-20261115-0001',
    customerName: 'Carpintería San José',
    phone: '55-4190-2281',
    address: 'Calle Oriente 150, Col. Agrícola Oriental',
    driverName: 'Roberto Méndez',
    status: 'IN_ROUTE',
    eta: '13:20',
    itemsSummary: '6 MDF Melamina Blanca, 12 Tabla Pino 1ra',
    driverCheckedInAtYard: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'del_2',
    ticketCode: 'VTA-20261115-0002',
    customerName: 'Constructora del Valle',
    phone: '55-8214-9003',
    address: 'Av. Primero de Mayo 214, Naucalpan Centro',
    driverName: 'Carlos Paredes',
    status: 'PENDING',
    eta: '15:00',
    itemsSummary: '20 Polín Pino Construcción 4×4',
    driverCheckedInAtYard: false,
    updatedAt: new Date().toISOString(),
  },
];

function buildCfdiXmlPreview(params: {
  folio: string;
  serie: string;
  uuid: string;
  rfcEmisor: string;
  rfcReceptor: string;
  nombreReceptor: string;
  usoCFDI: string;
  subtotal: number;
  tax: number;
  total: number;
  fecha: string;
}): string {
  return `<cfdi:Comprobante Version="4.0" Serie="${params.serie}" Folio="${params.folio}" Fecha="${params.fecha}" SubTotal="${params.subtotal.toFixed(2)}" Total="${params.total.toFixed(2)}">
  <cfdi:Emisor Rfc="${params.rfcEmisor}" Nombre="NICCORE MADERERIA S.A. DE C.V." RegimenFiscal="601" />
  <cfdi:Receptor Rfc="${params.rfcReceptor}" Nombre="${params.nombreReceptor}" UsoCFDI="${params.usoCFDI}" />
  <cfdi:Impuestos TotalImpuestosTrasladados="${params.tax.toFixed(2)}" />
  <tfd:TimbreFiscalDigital UUID="${params.uuid}" FechaTimbrado="${params.fecha}" />
</cfdi:Comprobante>`;
}

const initialInvoices: InvoiceRecord[] = [
  {
    id: 'inv_seed_1',
    folio: 'FAC-A-0001',
    serie: 'A',
    uuid: '9F4D2A18-7C31-4E9B-A501-12894C00A001',
    ticketId: 'tk_seed_1',
    ticketCode: 'VTA-20261115-0001',
    rfcEmisor: 'NMA200415K81',
    rfcReceptor: 'CSJ180922M41',
    nombreReceptor: 'CARPINTERIA SAN JOSE SA DE CV',
    usoCFDI: 'G03',
    regimenFiscal: '601',
    paymentMethod: 'TRANSFER',
    subtotal: 4751.28,
    tax: 760.2,
    total: 5511.48,
    status: 'STAMPED',
    items: initialTickets[0].items,
    xmlPreview: buildCfdiXmlPreview({
      folio: 'FAC-A-0001',
      serie: 'A',
      uuid: '9F4D2A18-7C31-4E9B-A501-12894C00A001',
      rfcEmisor: 'NMA200415K81',
      rfcReceptor: 'CSJ180922M41',
      nombreReceptor: 'CARPINTERIA SAN JOSE SA DE CV',
      usoCFDI: 'G03',
      subtotal: 4751.28,
      tax: 760.2,
      total: 5511.48,
      fecha: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    }),
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

class ErpStore {
  products: ProductRecord[] = [...initialProducts];
  tickets: TicketRecord[] = [...initialTickets];
  invoices: InvoiceRecord[] = [...initialInvoices];
  deliveries: DeliveryRecord[] = [...initialDeliveries];
  woodEntries: WoodEntryRecord[] = [];
  cutOptimizations: CutOptimizationRecord[] = [];
  savedReports: SavedReportRecord[] = [];
  ticketSeq = 3;
  invoiceSeq = 2;

  constructor() {
    const persisted = loadPersistedDatabase();
    if (persisted.erp) {
      if (Array.isArray(persisted.erp.products)) {
        this.products = persisted.erp.products as ProductRecord[];
      }
      if (Array.isArray(persisted.erp.tickets)) {
        this.tickets = persisted.erp.tickets as TicketRecord[];
      }
      if (Array.isArray(persisted.erp.invoices)) {
        this.invoices = persisted.erp.invoices as InvoiceRecord[];
      }
      if (Array.isArray(persisted.erp.deliveries)) {
        this.deliveries = persisted.erp.deliveries as DeliveryRecord[];
      }
      if (Array.isArray(persisted.erp.woodEntries)) {
        this.woodEntries = persisted.erp.woodEntries as WoodEntryRecord[];
      }
      if (Array.isArray(persisted.erp.cutOptimizations)) {
        this.cutOptimizations = persisted.erp.cutOptimizations as CutOptimizationRecord[];
      }
      if (Array.isArray(persisted.erp.savedReports)) {
        this.savedReports = persisted.erp.savedReports as SavedReportRecord[];
      }
      if (typeof persisted.erp.ticketSeq === 'number') {
        this.ticketSeq = persisted.erp.ticketSeq;
      }
      if (typeof persisted.erp.invoiceSeq === 'number') {
        this.invoiceSeq = persisted.erp.invoiceSeq;
      }
    } else {
      this.persist();
    }
  }

  private persist(): void {
    savePersistedSection('erp', {
      products: this.products,
      tickets: this.tickets,
      invoices: this.invoices,
      deliveries: this.deliveries,
      woodEntries: this.woodEntries,
      cutOptimizations: this.cutOptimizations,
      savedReports: this.savedReports,
      ticketSeq: this.ticketSeq,
      invoiceSeq: this.invoiceSeq,
    });
  }

  getProducts(): ProductRecord[] {
    return this.products;
  }

  addProduct(input: {
    name: string;
    sku: string;
    unit: UnitType;
    woodClass: WoodClass;
    measure: string;
    cost: number;
    price: number;
    stock: number;
    minAlert?: number;
  }): ProductRecord {
    const existingSku = this.products.find((p) => p.sku.toLowerCase() === input.sku.toLowerCase());
    if (existingSku) {
      throw new Error(`El SKU ${input.sku} ya existe en el catálogo`);
    }
    const created: ProductRecord = {
      id: `p_${Date.now().toString(36)}`,
      name: input.name,
      sku: input.sku.toUpperCase(),
      unit: input.unit || 'PIECE',
      woodClass: input.woodClass || 'PRIMERA',
      measure: input.measure || 'Estándar',
      cost: Number(input.cost) || 0,
      price: Number(input.price) || 0,
      stock: Number(input.stock) || 0,
      minAlert: Number(input.minAlert) || 10,
      active: true,
      updatedAt: new Date().toISOString(),
    };
    this.products.unshift(created);
    this.persist();
    return created;
  }

  adjustStock(productId: string, delta: number): ProductRecord {
    const product = this.products.find((p) => p.id === productId);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    const nextStock = product.stock + delta;
    if (nextStock < 0) {
      throw new Error(`Stock insuficiente para ${product.name}`);
    }
    product.stock = Number(nextStock.toFixed(4));
    product.updatedAt = new Date().toISOString();
    this.persist();
    return product;
  }

  createTicketAtomic(input: {
    customerName: string;
    items: Array<{
      id?: string;
      productId?: string;
      name: string;
      sku?: string;
      qty?: number;
      quantity?: number;
      price?: number;
      unitPrice?: number;
      cuts?: MaquilaSpecs | null;
    }>;
    applyTax?: boolean;
    taxAmount?: number;
    paymentMethod: PaymentMethod;
    deliveryType: DeliveryType;
    deliveryAddress?: string;
  }): { ticket: TicketRecord; delivery?: DeliveryRecord } {
    if (!input.items || input.items.length === 0) {
      throw new Error('El ticket debe contener al menos un producto');
    }

    const normalizedItems: TicketItemRecord[] = [];
    for (const rawItem of input.items) {
      const pid = rawItem.productId || rawItem.id;
      const qty = Number(rawItem.quantity ?? rawItem.qty ?? 0);
      if (qty <= 0) {
        throw new Error(`Cantidad inválida para ${rawItem.name}`);
      }
      const product = this.products.find((p) => p.id === pid);
      if (product && product.stock < qty) {
        throw new Error(`Stock insuficiente para ${product.name} (disponible: ${product.stock})`);
      }
      const unitPrice = product ? product.price : Number(rawItem.unitPrice ?? rawItem.price ?? 0);
      const hasCuts = Boolean(
        rawItem.cuts &&
          (rawItem.cuts.width || rawItem.cuts.length || rawItem.cuts.thickness || rawItem.cuts.notes)
      );
      normalizedItems.push({
        productId: pid || 'custom',
        name: product ? product.name : rawItem.name,
        sku: product ? product.sku : rawItem.sku || 'CUSTOM',
        quantity: qty,
        unitPrice,
        subtotal: Number((unitPrice * qty).toFixed(2)),
        requiresCutting: hasCuts,
        cuttingSpecs: hasCuts ? rawItem.cuts : null,
      });
    }

    for (const item of normalizedItems) {
      const product = this.products.find((p) => p.id === item.productId);
      if (product) {
        product.stock = Number((product.stock - item.quantity).toFixed(4));
        product.updatedAt = new Date().toISOString();
      }
    }

    const subtotal = Number(
      normalizedItems.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)
    );
    const taxRate = input.applyTax || (input.taxAmount && input.taxAmount > 0) ? 0.16 : 0;
    const taxAmount = Number((subtotal * taxRate).toFixed(2));
    const total = Number((subtotal + taxAmount).toFixed(2));

    const requiresWorkshop = normalizedItems.some((i) => i.requiresCutting);
    const workshopStatus: WorkshopStatus = requiresWorkshop ? 'PENDING_WORKSHOP' : 'NOT_REQUIRED';

    const seqStr = String(this.ticketSeq++).padStart(4, '0');
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const code = `VTA-${dateStamp}-${seqStr}`;
    const now = new Date().toISOString();

    const patioSheet: PatioSheetRecord = {
      folio: `HP-${seqStr}`,
      ticketCode: code,
      customerName: input.customerName || 'Venta Mostrador',
      generatedAt: now,
      workshopStatus,
      deliveryType: input.deliveryType || 'IMMEDIATE',
      items: normalizedItems,
    };

    const ticket: TicketRecord = {
      id: `tk_${Date.now().toString(36)}`,
      code,
      customerName: input.customerName || 'Venta Mostrador',
      items: normalizedItems,
      subtotal,
      taxAmount,
      taxRate,
      total,
      paymentMethod: input.paymentMethod || 'CASH',
      workshopStatus,
      deliveryType: input.deliveryType || 'IMMEDIATE',
      deliveryAddress: input.deliveryAddress,
      status: 'CONFIRMED',
      patioSheet,
      createdAt: now,
      confirmedAt: now,
    };

    this.tickets.unshift(ticket);

    let createdDelivery: DeliveryRecord | undefined;
    if (ticket.deliveryType === 'DELIVERY') {
      createdDelivery = {
        id: `del_${Date.now().toString(36)}`,
        ticketCode: ticket.code,
        customerName: ticket.customerName,
        phone: '55-0000-0000',
        address: input.deliveryAddress || 'Dirección por confirmar en despacho',
        driverName: 'Por asignar',
        status: 'PENDING',
        eta: 'Hoy',
        itemsSummary: normalizedItems.map((i) => `${i.quantity} ${i.name}`).join(', '),
        driverCheckedInAtYard: false,
        updatedAt: now,
      };
      this.deliveries.unshift(createdDelivery);
    }

    this.persist();
    return { ticket, delivery: createdDelivery };
  }

  updateTicketWorkshopStatus(ticketId: string, status: WorkshopStatus): TicketRecord {
    const ticket = this.tickets.find((t) => t.id === ticketId || t.code === ticketId);
    if (!ticket) {
      throw new Error('Ticket no encontrado');
    }
    ticket.workshopStatus = status;
    ticket.patioSheet.workshopStatus = status;
    this.persist();
    return ticket;
  }

  updateDeliveryStatus(
    deliveryId: string,
    payload: { status?: DeliveryStatus; driverName?: string; driverCheckedInAtYard?: boolean }
  ): DeliveryRecord {
    const delivery = this.deliveries.find((d) => d.id === deliveryId);
    if (!delivery) {
      throw new Error('Entrega no encontrada');
    }
    if (payload.status) delivery.status = payload.status;
    if (payload.driverName !== undefined) delivery.driverName = payload.driverName;
    if (payload.driverCheckedInAtYard !== undefined) {
      delivery.driverCheckedInAtYard = payload.driverCheckedInAtYard;
    }
    delivery.updatedAt = new Date().toISOString();
    this.persist();
    return delivery;
  }

  addWoodEntry(entry: WoodEntryRecord, addToProductId?: string): WoodEntryRecord {
    this.woodEntries.unshift(entry);
    if (addToProductId) {
      const product = this.products.find((p) => p.id === addToProductId);
      if (product) {
        product.stock = Number((product.stock + entry.quantity).toFixed(4));
        product.cost = Number(entry.unitCost.toFixed(2));
        product.price = Number(entry.publicUnitPrice.toFixed(2));
        product.updatedAt = new Date().toISOString();
      }
    }
    this.persist();
    return entry;
  }

  createInvoiceFromTicket(input: {
    ticketIdOrCode: string;
    rfcReceptor: string;
    nombreReceptor: string;
    usoCFDI?: string;
    regimenFiscal?: string;
  }): InvoiceRecord {
    const ticket = this.tickets.find(
      (t) => t.id === input.ticketIdOrCode || t.code === input.ticketIdOrCode
    );
    if (!ticket) {
      throw new Error('Ticket de venta no encontrado');
    }
    const existing = this.invoices.find(
      (inv) => inv.ticketId === ticket.id && inv.status !== 'CANCELLED'
    );
    if (existing) {
      throw new Error(`El ticket ${ticket.code} ya cuenta con la factura vigente ${existing.folio}`);
    }

    const rfcReceptor = String(input.rfcReceptor || 'XAXX010101000').trim().toUpperCase();
    const nombreReceptor = String(input.nombreReceptor || ticket.customerName).trim().toUpperCase();
    if (rfcReceptor.length < 10) {
      throw new Error('RFC receptor inválido (mínimo 10 caracteres)');
    }

    const seqStr = String(this.invoiceSeq++).padStart(4, '0');
    const folio = `FAC-A-${seqStr}`;
    const uuid = crypto.randomUUID().toUpperCase();
    const now = new Date().toISOString();

    const invoice: InvoiceRecord = {
      id: `inv_${Date.now().toString(36)}`,
      folio,
      serie: 'A',
      uuid,
      ticketId: ticket.id,
      ticketCode: ticket.code,
      rfcEmisor: 'NMA200415K81',
      rfcReceptor,
      nombreReceptor,
      usoCFDI: input.usoCFDI || 'G03',
      regimenFiscal: input.regimenFiscal || '601',
      paymentMethod: ticket.paymentMethod,
      subtotal: ticket.subtotal,
      tax: ticket.taxAmount,
      total: ticket.total,
      status: 'STAMPED',
      items: ticket.items,
      xmlPreview: buildCfdiXmlPreview({
        folio,
        serie: 'A',
        uuid,
        rfcEmisor: 'NMA200415K81',
        rfcReceptor,
        nombreReceptor,
        usoCFDI: input.usoCFDI || 'G03',
        subtotal: ticket.subtotal,
        tax: ticket.taxAmount,
        total: ticket.total,
        fecha: now,
      }),
      createdAt: now,
      updatedAt: now,
    };

    this.invoices.unshift(invoice);
    this.persist();
    return invoice;
  }

  cancelInvoice(invoiceId: string): InvoiceRecord {
    const invoice = this.invoices.find((i) => i.id === invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }
    invoice.status = 'CANCELLED';
    invoice.updatedAt = new Date().toISOString();
    this.persist();
    return invoice;
  }

  saveCutOptimization(result: Omit<CutOptimizationRecord, 'id' | 'createdAt'>): CutOptimizationRecord {
    const record: CutOptimizationRecord = {
      id: `opt_${Date.now().toString(36)}`,
      engine: result.engine,
      stockWidth: result.stockWidth,
      stockHeight: result.stockHeight,
      kerfMm: result.kerfMm,
      sheetsCount: result.sheetsCount,
      totalPiecesPlaced: result.totalPiecesPlaced,
      unplacedCount: result.unplacedCount,
      efficiency: result.efficiency,
      wasteM2: result.wasteM2,
      computeTimeMs: result.computeTimeMs,
      createdAt: new Date().toISOString(),
    };
    this.cutOptimizations.unshift(record);
    this.cutOptimizations = this.cutOptimizations.slice(0, 100);
    this.persist();
    return record;
  }

  saveReportSnapshot(title?: string, createdBy = 'Administrador'): SavedReportRecord {
    const summary = this.getReportsSummary();
    const record: SavedReportRecord = {
      id: `rep_${Date.now().toString(36)}`,
      title: title?.trim() || `Corte de Caja ${new Date().toLocaleDateString('es-MX')}`,
      totalSales: summary.totalSales,
      totalTax: summary.totalTax,
      confirmedTickets: summary.confirmedTickets,
      invoicesCount: this.invoices.filter((i) => i.status === 'STAMPED').length,
      inventoryValuation: summary.inventoryValuation,
      byPaymentMethod: summary.byPaymentMethod,
      createdBy,
      createdAt: new Date().toISOString(),
    };
    this.savedReports.unshift(record);
    this.persist();
    return record;
  }

  getReportsSummary() {
    const totalSales = this.tickets.reduce((acc, t) => acc + t.total, 0);
    const totalTax = this.tickets.reduce((acc, t) => acc + t.taxAmount, 0);
    const confirmedTickets = this.tickets.filter((t) => t.status === 'CONFIRMED').length;
    const lowStockProducts = this.products.filter((p) => p.stock <= p.minAlert);
    const pendingDeliveries = this.deliveries.filter((d) => d.status !== 'DELIVERED').length;
    const pendingWorkshop = this.tickets.filter(
      (t) => t.workshopStatus === 'PENDING_WORKSHOP' || t.workshopStatus === 'IN_WORKSHOP'
    ).length;

    const byPaymentMethod = this.tickets.reduce<Record<string, number>>((acc, t) => {
      acc[t.paymentMethod] = Number(((acc[t.paymentMethod] || 0) + t.total).toFixed(2));
      return acc;
    }, {});

    const inventoryValuation = this.products.reduce(
      (acc, p) => acc + p.stock * p.cost,
      0
    );

    return {
      totalSales: Number(totalSales.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      confirmedTickets,
      totalTickets: this.tickets.length,
      invoicesCount: this.invoices.filter((i) => i.status === 'STAMPED').length,
      savedReportsCount: this.savedReports.length,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      pendingDeliveries,
      pendingWorkshop,
      inventoryValuation: Number(inventoryValuation.toFixed(2)),
      byPaymentMethod,
      recentTickets: this.tickets.slice(0, 20),
    };
  }

  getDatabaseOverview(auditCount: number, companiesCount: number, usersCount: number) {
    return {
      storageEngine: 'Persistencia Atómica Servidor + Cloud Firestore',
      serverFile: getPersistenceFileMeta(),
      counts: {
        products: this.products.length,
        tickets: this.tickets.length,
        invoices: this.invoices.length,
        deliveries: this.deliveries.length,
        woodEntries: this.woodEntries.length,
        cutOptimizations: this.cutOptimizations.length,
        savedReports: this.savedReports.length,
        auditLogs: auditCount,
        companies: companiesCount,
        users: usersCount,
      },
    };
  }
}

export const erpStore = new ErpStore();
