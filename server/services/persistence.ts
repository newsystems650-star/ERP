import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'niccore_db.json');

export interface PersistedDatabase {
  erp?: {
    products: unknown[];
    tickets: unknown[];
    invoices: unknown[];
    deliveries: unknown[];
    woodEntries: unknown[];
    cutOptimizations: unknown[];
    savedReports: unknown[];
    ticketSeq: number;
    invoiceSeq: number;
  };
  companies?: unknown[];
  users?: unknown[];
  updatedAt?: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPersistedDatabase(): PersistedDatabase {
  try {
    ensureDataDir();
    if (!fs.existsSync(DB_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw) as PersistedDatabase;
  } catch (err) {
    console.error('[Persistence] Error loading database file:', err);
    return {};
  }
}

export function savePersistedSection<K extends keyof PersistedDatabase>(
  section: K,
  value: PersistedDatabase[K]
): void {
  try {
    ensureDataDir();
    const current = loadPersistedDatabase();
    current[section] = value;
    current.updatedAt = new Date().toISOString();
    const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(current, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error(`[Persistence] Error saving section ${String(section)}:`, err);
  }
}

export function getPersistenceFileMeta(): {
  filePath: string;
  exists: boolean;
  sizeBytes: number;
  updatedAt: string | null;
} {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { filePath: 'data/niccore_db.json', exists: false, sizeBytes: 0, updatedAt: null };
    }
    const stat = fs.statSync(DB_FILE);
    return {
      filePath: 'data/niccore_db.json',
      exists: true,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return { filePath: 'data/niccore_db.json', exists: false, sizeBytes: 0, updatedAt: null };
  }
}
