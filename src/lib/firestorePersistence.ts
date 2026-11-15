import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  AuditEntry,
  Company,
  Delivery,
  InvoiceRecord,
  Product,
  Role,
  SavedReportRecord,
  Ticket,
  WoodEntry,
} from '../types';

function sanitizeId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function clampStr(val: unknown, fallback: string, maxLen: number): string {
  const str = String(val ?? '').trim();
  if (!str) return fallback.slice(0, maxLen);
  return str.slice(0, maxLen);
}

function getVerifiedUid(): string | null {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return null;
  return sanitizeId(user.uid, 'usr');
}

async function upsertDoc(
  collectionName: string,
  rawId: string,
  buildCreatePayload: (id: string, ownerUid: string) => Record<string, unknown>,
  buildUpdateFields?: () => Record<string, unknown>
): Promise<boolean> {
  const ownerUid = getVerifiedUid();
  if (!ownerUid) return false;

  const id = sanitizeId(rawId, collectionName);
  const path = `${collectionName}/${id}`;
  const ref = doc(db, collectionName, id);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    const payload = {
      ...buildCreatePayload(id, ownerUid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(ref, payload);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else if (buildUpdateFields) {
    try {
      await updateDoc(ref, {
        ...buildUpdateFields(),
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
  return false;
}

export async function syncUserProfileToFirestore(user: {
  name: string;
  email: string;
  role: Role;
}): Promise<void> {
  const uid = getVerifiedUid();
  if (!uid) return;
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(ref, {
        uid,
        name: clampStr(user.name, 'Usuario NicCore', 120),
        email: clampStr(user.email, 'usuario@niccore.mx', 160),
        role: auth.currentUser?.email === 'newsystems650@gmail.com' ? user.role : 'OPERATOR',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(ref, {
        name: clampStr(user.name, 'Usuario NicCore', 120),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function syncProductToFirestore(p: Product): Promise<boolean> {
  return upsertDoc(
    'products',
    p.id,
    (id, ownerUid) => ({
      id,
      ownerUid,
      name: clampStr(p.name, 'Producto', 160),
      sku: clampStr(p.sku, 'SKU', 48),
      unit: p.unit,
      woodClass: p.woodClass,
      measure: clampStr(p.measure, 'Estándar', 120),
      cost: Number(p.cost) || 0,
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      minAlert: Number(p.minAlert) || 0,
      active: Boolean(p.active),
    }),
    () => ({
      stock: Number(p.stock) || 0,
      price: Number(p.price) || 0,
      cost: Number(p.cost) || 0,
      minAlert: Number(p.minAlert) || 0,
      active: Boolean(p.active),
    })
  );
}

export async function syncTicketToFirestore(t: Ticket): Promise<boolean> {
  const summary =
    t.items.map((i) => `${i.quantity}x ${i.name}`).join(', ') || 'Venta Mostrador';
  return upsertDoc(
    'tickets',
    t.id,
    (id, ownerUid) => ({
      id,
      ownerUid,
      code: clampStr(t.code, id, 48),
      customerName: clampStr(t.customerName, 'Cliente Mostrador', 160),
      subtotal: Number(t.subtotal) || 0,
      taxAmount: Number(t.taxAmount) || 0,
      taxRate: Number(t.taxRate) || 0,
      total: Number(t.total) || 0,
      paymentMethod: t.paymentMethod,
      workshopStatus: t.workshopStatus,
      deliveryType: t.deliveryType,
      status: t.status,
      itemsSummary: clampStr(summary, 'Venta', 1000),
    }),
    () => ({
      workshopStatus: t.workshopStatus,
      status: t.status,
    })
  );
}

export async function syncInvoiceToFirestore(inv: InvoiceRecord): Promise<boolean> {
  return upsertDoc(
    'invoices',
    inv.id,
    (id, ownerUid) => ({
      id,
      ownerUid,
      folio: clampStr(inv.folio, 'FAC-A-0001', 48),
      uuid: clampStr(inv.uuid, '00000000-0000-0000-0000-000000000000', 64),
      ticketCode: clampStr(inv.ticketCode, 'VTA-0001', 48),
      rfcReceptor: clampStr(inv.rfcReceptor, 'XAXX010101000', 16),
      nombreReceptor: clampStr(inv.nombreReceptor, 'PUBLICO EN GENERAL', 180),
      usoCFDI: clampStr(inv.usoCFDI, 'G03', 16),
      regimenFiscal: clampStr(inv.regimenFiscal, '601', 16),
      paymentMethod: inv.paymentMethod,
      subtotal: Number(inv.subtotal) || 0,
      tax: Number(inv.tax) || 0,
      total: Number(inv.total) || 0,
      status: inv.status,
    }),
    () => ({
      status: inv.status,
    })
  );
}

export async function syncDeliveryToFirestore(d: Delivery): Promise<boolean> {
  return upsertDoc(
    'deliveries',
    d.id,
    (id, ownerUid) => ({
      id,
      ownerUid,
      ticketCode: clampStr(d.ticketCode, 'VTA-0001', 48),
      customerName: clampStr(d.customerName, 'Cliente', 160),
      address: clampStr(d.address, 'Patio Central', 300),
      driverName: clampStr(d.driverName, 'Por asignar', 120),
      status: d.status,
      driverCheckedInAtYard: Boolean(d.driverCheckedInAtYard),
    }),
    () => ({
      status: d.status,
      driverName: clampStr(d.driverName, 'Por asignar', 120),
      driverCheckedInAtYard: Boolean(d.driverCheckedInAtYard),
    })
  );
}

export async function syncWoodEntryToFirestore(w: WoodEntry): Promise<boolean> {
  return upsertDoc('woodEntries', w.id, (id, ownerUid) => ({
    id,
    ownerUid,
    species: clampStr(w.species, 'Pino', 120),
    woodClass: w.woodClass,
    quantity: Number(w.quantity) || 0,
    totalBoardFeet: Number(w.totalBoardFeet) || 0,
    totalM3: Number(w.totalM3) || 0,
    unitCost: Number(w.unitCost) || 0,
    publicUnitPrice: Number(w.publicUnitPrice) || 0,
    projectedProfit: Number(w.projectedProfit) || 0,
  }));
}

export async function syncSavedReportToFirestore(r: SavedReportRecord): Promise<boolean> {
  return upsertDoc('reports', r.id, (id, ownerUid) => ({
    id,
    ownerUid,
    title: clampStr(r.title, 'Reporte NicCore', 160),
    totalSales: Number(r.totalSales) || 0,
    totalTax: Number(r.totalTax) || 0,
    confirmedTickets: Number(r.confirmedTickets) || 0,
    invoicesCount: Number(r.invoicesCount) || 0,
    inventoryValuation: Number(r.inventoryValuation) || 0,
    createdBy: clampStr(r.createdBy, 'Administrador', 120),
  }));
}

export async function syncCompanyToFirestore(c: Company): Promise<boolean> {
  return upsertDoc('companies', c.id, (id, ownerUid) => ({
    id,
    ownerUid,
    name: clampStr(c.name, 'Sucursal NicCore', 160),
    industry: clampStr(c.industry, 'Maderería', 120),
    employees: Number(c.employees) || 1,
    status: c.status,
  }));
}

export async function syncAuditEntryToFirestore(entry: AuditEntry, idx: number): Promise<boolean> {
  const ownerUid = getVerifiedUid();
  if (!ownerUid) return false;
  const id = sanitizeId(
    `aud_${entry.iv.slice(0, 12) || idx}_${new Date(entry.timestamp).getTime()}`,
    'aud'
  );
  const path = `auditLogs/${id}`;
  const ref = doc(db, 'auditLogs', id);

  let exists = false;
  try {
    const snap = await getDoc(ref);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
  if (exists) return false;

  const actionName =
    entry.decrypted && typeof entry.decrypted.action === 'string'
      ? entry.decrypted.action
      : 'ENCRYPTED_BLOCK';

  try {
    await setDoc(ref, {
      id,
      ownerUid,
      action: clampStr(actionName, 'AUDIT_EVENT', 80),
      iv: clampStr(entry.iv || 'none', 'none', 128),
      cipherText: clampStr(entry.cipherText, 'cipher', 8000),
      verified: Boolean(entry.verified),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getFirestoreCollectionCounts(): Promise<Record<string, number> | null> {
  const uid = getVerifiedUid();
  if (!uid) return null;

  const collections = [
    'products',
    'tickets',
    'invoices',
    'deliveries',
    'woodEntries',
    'reports',
    'auditLogs',
    'companies',
  ];

  const counts: Record<string, number> = {};
  for (const col of collections) {
    try {
      const q = query(collection(db, col), where('ownerUid', '==', uid));
      const snap = await getDocs(q);
      counts[col] = snap.size;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, col);
    }
  }
  return counts;
}

export async function syncAllErpStateToFirestore(): Promise<number> {
  const uid = getVerifiedUid();
  if (!uid) return 0;

  let synced = 0;
  const [prodRes, tickRes, invRes, delRes, woodRes, repRes, audRes, compRes] = await Promise.all([
    fetch('/api/v1/inventory'),
    fetch('/api/v1/cashier/tickets'),
    fetch('/api/v1/admin/invoices'),
    fetch('/api/v1/deliveries'),
    fetch('/api/v1/wood/entries'),
    fetch('/api/v1/admin/reports/saved'),
    fetch('/api/v1/admin/audit-logs?decrypt=true'),
    fetch('/api/v1/companies'),
  ]);

  if (prodRes.ok) {
    const products: Product[] = await prodRes.json();
    for (const p of products) {
      if (await syncProductToFirestore(p)) synced++;
    }
  }
  if (tickRes.ok) {
    const tickets: Ticket[] = await tickRes.json();
    for (const t of tickets) {
      if (await syncTicketToFirestore(t)) synced++;
    }
  }
  if (invRes.ok) {
    const invoices: InvoiceRecord[] = await invRes.json();
    for (const inv of invoices) {
      if (await syncInvoiceToFirestore(inv)) synced++;
    }
  }
  if (delRes.ok) {
    const deliveries: Delivery[] = await delRes.json();
    for (const d of deliveries) {
      if (await syncDeliveryToFirestore(d)) synced++;
    }
  }
  if (woodRes.ok) {
    const woodEntries: WoodEntry[] = await woodRes.json();
    for (const w of woodEntries) {
      if (await syncWoodEntryToFirestore(w)) synced++;
    }
  }
  if (repRes.ok) {
    const reports: SavedReportRecord[] = await repRes.json();
    for (const r of reports) {
      if (await syncSavedReportToFirestore(r)) synced++;
    }
  }
  if (audRes.ok) {
    const audData = await audRes.json();
    const entries: AuditEntry[] = audData.entries || [];
    for (let i = 0; i < Math.min(entries.length, 25); i++) {
      if (await syncAuditEntryToFirestore(entries[i], i)) synced++;
    }
  }
  if (compRes.ok) {
    const companies: Company[] = await compRes.json();
    for (const c of companies) {
      if (await syncCompanyToFirestore(c)) synced++;
    }
  }

  return synced;
}
