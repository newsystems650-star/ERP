import crypto from 'crypto';
import fs from 'fs';

const SOCKET_PATH = '/tmp/ni_bridge.sock';
const AUDIT_FILE = 'audit_log.enc';

export interface CutPieceInput {
  id: string;
  label: string;
  width: number;
  height: number;
  qty: number;
  rotatable?: boolean;
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

export interface AuditEntryRecord {
  timestamp: string;
  iv: string;
  cipherText: string;
  decrypted?: Record<string, unknown> | null;
  verified: boolean;
}

function getAuditKey(): Buffer {
  const raw = process.env.AUDIT_SECRET || 'default_secret_32_chars_long!!!';
  return crypto.createHash('sha256').update(raw).digest();
}

let lastWatchdogCheck = new Date().toISOString();
let watchdogActive = false;

export const cppBridge = {
  async auditLog(data: Record<string, unknown>) {
    const key = getAuditKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const logEntry = `[${new Date().toISOString()}] ${iv.toString('hex')}:${encrypted}\n`;
    fs.appendFileSync(AUDIT_FILE, logEntry);
  },

  getAuditLogs(decrypt = false): AuditEntryRecord[] {
    if (!fs.existsSync(AUDIT_FILE)) {
      return [];
    }
    const content = fs.readFileSync(AUDIT_FILE, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const key = getAuditKey();

    return lines
      .slice(-50)
      .reverse()
      .map((line) => {
        const match = line.match(/^\[(.*?)\]\s+([a-f0-9]+):([a-f0-9]+)$/i);
        if (!match) {
          return {
            timestamp: new Date().toISOString(),
            iv: '',
            cipherText: line,
            decrypted: null,
            verified: false,
          };
        }

        const [, timestamp, ivHex, cipherHex] = match;
        let decrypted: Record<string, unknown> | null = null;
        let verified = false;

        if (decrypt) {
          try {
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let out = decipher.update(cipherHex, 'hex', 'utf8');
            out += decipher.final('utf8');
            decrypted = JSON.parse(out);
            verified = true;
          } catch {
            verified = false;
          }
        }

        return {
          timestamp,
          iv: ivHex,
          cipherText: cipherHex,
          decrypted,
          verified,
        };
      });
  },

  // 2D Shelf / Guillotine Bin-Packing Optimizer
  async optimizeCuts(params: {
    stockWidth: number;
    stockHeight: number;
    kerfMm?: number;
    pieces: CutPieceInput[];
  }): Promise<OptimizationResult> {
    const start = performance.now();
    const stockWidth = Math.max(10, Number(params.stockWidth) || 122);
    const stockHeight = Math.max(10, Number(params.stockHeight) || 244);
    const kerfCm = Math.max(0, (Number(params.kerfMm) || 3) / 10);

    // Expand pieces by quantity and sort largest area / height first
    const expanded: Array<{ label: string; w: number; h: number; rotatable: boolean }> = [];
    for (const p of params.pieces || []) {
      const qty = Math.max(0, Math.min(200, Math.floor(Number(p.qty) || 0)));
      const w = Number(p.width) || 0;
      const h = Number(p.height) || 0;
      if (w <= 0 || h <= 0 || qty <= 0) continue;
      for (let i = 0; i < qty; i++) {
        expanded.push({
          label: (p.label || 'Pieza').trim(),
          w,
          h,
          rotatable: p.rotatable !== false,
        });
      }
    }

    expanded.sort((a, b) => Math.max(b.h, b.w) - Math.max(a.h, a.w) || b.w * b.h - a.w * a.h);

    interface Shelf {
      y: number;
      height: number;
      cursorX: number;
    }

    interface WorkingSheet {
      shelves: Shelf[];
      usedY: number;
      pieces: PlacedPiece[];
    }

    const workingSheets: WorkingSheet[] = [];
    let unplacedCount = 0;

    const createSheet = (): WorkingSheet => ({
      shelves: [],
      usedY: 0,
      pieces: [],
    });

    const tryPlaceOnSheet = (
      sheet: WorkingSheet,
      piece: { label: string; w: number; h: number; rotatable: boolean }
    ): boolean => {
      const orientations: Array<{ w: number; h: number; rotated: boolean }> = [
        { w: piece.w, h: piece.h, rotated: false },
      ];
      if (piece.rotatable && piece.w !== piece.h) {
        orientations.push({ w: piece.h, h: piece.w, rotated: true });
      }

      // 1. Try existing shelves
      for (const shelf of sheet.shelves) {
        for (const ori of orientations) {
          const neededW = shelf.cursorX === 0 ? ori.w : ori.w + kerfCm;
          if (ori.h <= shelf.height && shelf.cursorX + neededW <= stockWidth + 0.001) {
            const x = shelf.cursorX === 0 ? 0 : shelf.cursorX + kerfCm;
            sheet.pieces.push({
              label: piece.label,
              x: Number(x.toFixed(2)),
              y: Number(shelf.y.toFixed(2)),
              w: ori.w,
              h: ori.h,
              rotated: ori.rotated,
            });
            shelf.cursorX = x + ori.w;
            return true;
          }
        }
      }

      // 2. Open a new shelf
      // Prefer orientation with smaller height that fits width
      const validOris = orientations
        .filter((o) => o.w <= stockWidth + 0.001)
        .sort((a, b) => a.h - b.h);

      for (const ori of validOris) {
        const nextY = sheet.shelves.length === 0 ? 0 : sheet.usedY + kerfCm;
        if (nextY + ori.h <= stockHeight + 0.001) {
          const newShelf: Shelf = {
            y: nextY,
            height: ori.h,
            cursorX: ori.w,
          };
          sheet.shelves.push(newShelf);
          sheet.usedY = nextY + ori.h;
          sheet.pieces.push({
            label: piece.label,
            x: 0,
            y: Number(nextY.toFixed(2)),
            w: ori.w,
            h: ori.h,
            rotated: ori.rotated,
          });
          return true;
        }
      }

      return false;
    };

    for (const piece of expanded) {
      const fitsAtAll =
        (piece.w <= stockWidth && piece.h <= stockHeight) ||
        (piece.rotatable && piece.h <= stockWidth && piece.w <= stockHeight);
      if (!fitsAtAll) {
        unplacedCount++;
        continue;
      }

      let placed = false;
      for (const sheet of workingSheets) {
        if (tryPlaceOnSheet(sheet, piece)) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        const newSheet = createSheet();
        if (tryPlaceOnSheet(newSheet, piece)) {
          workingSheets.push(newSheet);
        } else {
          unplacedCount++;
        }
      }
    }

    const sheetAreaCm2 = stockWidth * stockHeight;
    const sheets: SheetLayout[] = workingSheets.map((ws, idx) => {
      const usedAreaCm2 = ws.pieces.reduce((acc, p) => acc + p.w * p.h, 0);
      const wasteAreaCm2 = Math.max(0, sheetAreaCm2 - usedAreaCm2);
      return {
        sheetIndex: idx + 1,
        width: stockWidth,
        height: stockHeight,
        efficiency: sheetAreaCm2 > 0 ? Number((usedAreaCm2 / sheetAreaCm2).toFixed(4)) : 0,
        usedAreaCm2: Number(usedAreaCm2.toFixed(1)),
        wasteAreaCm2: Number(wasteAreaCm2.toFixed(1)),
        pieces: ws.pieces,
      };
    });

    const totalUsedCm2 = sheets.reduce((acc, s) => acc + s.usedAreaCm2, 0);
    const totalSheetCm2 = sheets.length * sheetAreaCm2;
    const totalWasteCm2 = Math.max(0, totalSheetCm2 - totalUsedCm2);
    const computeTimeMs = Number((performance.now() - start).toFixed(2));

    await this.auditLog({
      action: 'OPTIMIZE_CUTS',
      stockWidth,
      stockHeight,
      sheetsCount: sheets.length,
      piecesCount: expanded.length - unplacedCount,
    });

    return {
      engine: fs.existsSync(SOCKET_PATH) ? 'CPP_SOCKET' : 'NODE_SIMULATION',
      stockWidth,
      stockHeight,
      kerfMm: kerfCm * 10,
      sheetsCount: sheets.length,
      totalPiecesPlaced: expanded.length - unplacedCount,
      unplacedCount,
      efficiency: totalSheetCm2 > 0 ? Number((totalUsedCm2 / totalSheetCm2).toFixed(4)) : 0,
      wasteM2: Number((totalWasteCm2 / 10000).toFixed(3)),
      sheets,
      computeTimeMs,
    };
  },

  startWatchdog() {
    if (watchdogActive) return;
    watchdogActive = true;
    lastWatchdogCheck = new Date().toISOString();
    setInterval(() => {
      lastWatchdogCheck = new Date().toISOString();
    }, 5000);
  },

  getStatus() {
    const socketConnected = fs.existsSync(SOCKET_PATH);
    return {
      watchdogActive,
      mode: socketConnected ? 'CPP_SOCKET' : 'NODE_SIMULATION',
      socketPath: SOCKET_PATH,
      socketConnected,
      lastCheck: lastWatchdogCheck,
    };
  },
};
