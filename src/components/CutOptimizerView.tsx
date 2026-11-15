import React, { useState } from 'react';
import { Maximize, Scissors, Plus, Trash2, Activity, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { OptimizationResult } from '../types';

interface PieceInputRow {
  id: string;
  label: string;
  width: string;
  height: string;
  qty: string;
  rotatable: boolean;
}

const SHEET_PRESETS = [
  { label: 'Estándar 122×244', w: '122', h: '244' },
  { label: 'Ancho 152×244', w: '152', h: '244' },
  { label: 'Jumbo 183×244', w: '183', h: '244' },
];

const PIECE_COLORS = [
  'bg-emerald-500/15 border-emerald-600 text-emerald-900',
  'bg-sky-500/15 border-sky-600 text-sky-900',
  'bg-amber-500/15 border-amber-600 text-amber-900',
  'bg-violet-500/15 border-violet-600 text-violet-900',
];

export const CutOptimizerView: React.FC = () => {
  const [stockWidth, setStockWidth] = useState('122');
  const [stockHeight, setStockHeight] = useState('244');
  const [kerfMm, setKerfMm] = useState('3');
  const [pieces, setPieces] = useState<PieceInputRow[]>([
    { id: '1', label: 'Puerta', width: '40', height: '75', qty: '4', rotatable: true },
    { id: '2', label: 'Repisa', width: '35', height: '80', qty: '3', rotatable: true },
    { id: '3', label: 'Zoclo', width: '12', height: '110', qty: '4', rotatable: true },
  ]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  const addPiece = () => {
    setPieces([
      ...pieces,
      {
        id: Math.random().toString(36).slice(2, 8),
        label: `Pieza ${pieces.length + 1}`,
        width: '30',
        height: '50',
        qty: '2',
        rotatable: true,
      },
    ]);
  };

  const updatePiece = (id: string, field: keyof PieceInputRow, value: string | boolean) => {
    setPieces((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const removePiece = (id: string) => {
    if (pieces.length <= 1) return;
    setPieces((prev) => prev.filter((row) => row.id !== id));
  };

  const runOptimization = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch('/api/v1/optimizer/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockWidth: Number(stockWidth),
          stockHeight: Number(stockHeight),
          kerfMm: Number(kerfMm),
          pieces: pieces.map((p) => ({
            id: p.id,
            label: p.label || 'Pieza',
            width: Number(p.width) || 0,
            height: Number(p.height) || 0,
            qty: Number(p.qty) || 0,
            rotatable: p.rotatable,
          })),
        }),
      });
      const data: OptimizationResult = await res.json();
      if (!res.ok) throw new Error('Error calculando optimización');
      setResult(data);
      setActiveSheetIdx(0);
      toast.success(
        `Optimización lista: ${data.sheetsCount} tablero(s) · ${(data.efficiency * 100).toFixed(1)}% aprovechamiento`
      );
    } catch {
      toast.error('Error al ejecutar el optimizador de cortes');
    } finally {
      setIsOptimizing(false);
    }
  };

  const activeSheet = result?.sheets[activeSheetIdx] || result?.sheets[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Configuration */}
      <div className="lg:col-span-1 space-y-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Maximize className="w-4 h-4 text-emerald-600" /> Medidas del Tablero Base
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {SHEET_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.label}
                onClick={() => {
                  setStockWidth(preset.w);
                  setStockHeight(preset.h);
                }}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  stockWidth === preset.w && stockHeight === preset.h
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Ancho (cm)</label>
              <input
                type="number"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                value={stockWidth}
                onChange={(e) => setStockWidth(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Largo (cm)</label>
              <input
                type="number"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                value={stockHeight}
                onChange={(e) => setStockHeight(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Sierra (mm)</label>
              <input
                type="number"
                step="0.5"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                value={kerfMm}
                onChange={(e) => setKerfMm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Scissors className="w-4 h-4 text-sky-600" /> Piezas a Cortar
            </h3>
            <button
              type="button"
              onClick={addPiece}
              className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Pieza
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {pieces.map((piece) => (
              <div
                key={piece.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    placeholder="Etiqueta"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                    value={piece.label}
                    onChange={(e) => updatePiece(piece.id, 'label', e.target.value)}
                  />
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={piece.rotatable}
                      onChange={(e) => updatePiece(piece.id, 'rotatable', e.target.checked)}
                    />
                    Rotar
                  </label>
                  <button
                    type="button"
                    onClick={() => removePiece(piece.id)}
                    aria-label="Eliminar pieza"
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500">Ancho cm</label>
                    <input
                      type="number"
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      value={piece.width}
                      onChange={(e) => updatePiece(piece.id, 'width', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500">Largo cm</label>
                    <input
                      type="number"
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      value={piece.height}
                      onChange={(e) => updatePiece(piece.id, 'height', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500">Cant.</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      value={piece.qty}
                      onChange={(e) => updatePiece(piece.id, 'qty', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={runOptimization}
            disabled={isOptimizing}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isOptimizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            Calcular Optimización 2D
          </button>
        </div>
      </div>

      {/* Right Visualization */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 flex flex-col min-h-[520px]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 mb-5">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Plano de Corte Optimizado</h3>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              {result
                ? `${result.sheetsCount} tablero(s) · ${result.totalPiecesPlaced} piezas acomodadas · ${result.computeTimeMs} ms`
                : 'Configura las piezas y presiona calcular'}
            </p>
          </div>

          {result && (
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-slate-500">Aprovechamiento</p>
                <p className="text-lg font-bold text-emerald-700 font-mono tabular-nums">
                  {(result.efficiency * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Merma total</p>
                <p className="text-lg font-bold text-red-600 font-mono tabular-nums">
                  {result.wasteM2} m²
                </p>
              </div>
            </div>
          )}
        </div>

        {result && result.unplacedCount > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {result.unplacedCount} pieza(s) exceden las dimensiones máximas del tablero (
              {result.stockWidth} × {result.stockHeight} cm) y no pudieron colocarse.
            </span>
          </div>
        )}

        {result && result.sheets.length > 1 && (
          <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
            {result.sheets.map((s, idx) => (
              <button
                type="button"
                key={s.sheetIndex}
                onClick={() => setActiveSheetIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                  activeSheetIdx === idx
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tablero {s.sheetIndex} ({(s.efficiency * 100).toFixed(0)}%)
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-6 flex items-center justify-center overflow-hidden">
          {activeSheet ? (
            <div
              className="bg-white border-2 border-slate-700 relative shadow-sm"
              style={{
                width: '100%',
                maxWidth: '460px',
                aspectRatio: `${activeSheet.width}/${activeSheet.height}`,
              }}
            >
              {activeSheet.pieces.map((p, i) => {
                const colorCls = PIECE_COLORS[i % PIECE_COLORS.length];
                return (
                  <div
                    key={i}
                    title={`${p.label}: ${p.w}×${p.h} cm @ (${p.x}, ${p.y})`}
                    className={`absolute border flex flex-col items-center justify-center text-center overflow-hidden leading-tight p-0.5 ${colorCls}`}
                    style={{
                      left: `${(p.x / activeSheet.width) * 100}%`,
                      top: `${(p.y / activeSheet.height) * 100}%`,
                      width: `${(p.w / activeSheet.width) * 100}%`,
                      height: `${(p.h / activeSheet.height) * 100}%`,
                    }}
                  >
                    <span className="text-[10px] font-bold truncate max-w-full">{p.label}</span>
                    <span className="text-[9px] font-mono tabular-nums opacity-80">
                      {p.w}×{p.h}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center space-y-2 text-slate-400">
              <Scissors className="w-12 h-12 mx-auto opacity-40" />
              <p className="text-sm font-medium">
                Agrega tus cortes y ejecuta el algoritmo de optimización
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
