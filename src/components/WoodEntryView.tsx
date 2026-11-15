import React, { useEffect, useState } from 'react';
import { Calculator, Trees, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Product, WoodCalculation, WoodClass, WoodEntry } from '../types';
import { syncWoodEntryToFirestore } from '../lib/firestorePersistence';

export const WoodEntryView: React.FC = () => {
  const [species, setSpecies] = useState('Pino Nacional');
  const [woodClass, setWoodClass] = useState<WoodClass>('PRIMERA');
  const [thicknessCm, setThicknessCm] = useState('2.5');
  const [widthCm, setWidthCm] = useState('30');
  const [lengthCm, setLengthCm] = useState('250');
  const [quantity, setQuantity] = useState('50');
  const [costPerBoardFoot, setCostPerBoardFoot] = useState('28');
  const [marginPercent, setMarginPercent] = useState('35');
  const [linkedProductId, setLinkedProductId] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<WoodEntry[]>([]);
  const [calc, setCalc] = useState<WoodCalculation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadInitial = async () => {
    const [prodRes, entriesRes] = await Promise.all([
      fetch('/api/v1/inventory'),
      fetch('/api/v1/wood/entries'),
    ]);
    if (prodRes.ok) {
      const list = await prodRes.json();
      setProducts(list);
      if (list.length > 0 && !linkedProductId) {
        setLinkedProductId(list[0].id);
      }
    }
    if (entriesRes.ok) {
      setEntries(await entriesRes.json());
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/v1/wood/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            thicknessCm: Number(thicknessCm) || 0,
            widthCm: Number(widthCm) || 0,
            lengthCm: Number(lengthCm) || 0,
            quantity: Number(quantity) || 1,
            costPerBoardFoot: Number(costPerBoardFoot) || 0,
            marginPercent: Number(marginPercent) || 0,
          }),
        });
        if (res.ok) {
          setCalc(await res.json());
        }
      } catch {
        // ignore transient debounce error
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [thicknessCm, widthCm, lengthCm, quantity, costPerBoardFoot, marginPercent]);

  const handleRegisterEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/wood/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species,
          woodClass,
          thicknessCm: Number(thicknessCm),
          widthCm: Number(widthCm),
          lengthCm: Number(lengthCm),
          quantity: Number(quantity),
          costPerBoardFoot: Number(costPerBoardFoot),
          marginPercent: Number(marginPercent),
          productId: linkedProductId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al registrar entrada');
      syncWoodEntryToFirestore(data).catch(() => {});
      toast.success(`Entrada registrada: ${data.totalBoardFeet} PT`, {
        description: linkedProductId
          ? 'El stock y precio del producto vinculado fueron actualizados.'
          : 'Lote registrado en bitácora de aserradero.',
      });
      await loadInitial();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al registrar entrada');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Input Form */}
        <form
          onSubmit={handleRegisterEntry}
          className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Calculator className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Cálculo Tablar y Recepción de Lote
                </h3>
                <p className="text-xs text-slate-500">
                  Conversión métrica a pulgadas/pies comerciales y valuación de margen
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Especie / Madera</label>
              <input
                type="text"
                required
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Clasificación</label>
              <select
                value={woodClass}
                onChange={(e) => setWoodClass(e.target.value as WoodClass)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="PRIMERA">Primera</option>
                <option value="SEGUNDA">Segunda</option>
                <option value="TERCERA">Tercera</option>
                <option value="ESPECIAL">Especial / Estufada</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Grosor (cm)</label>
              <input
                type="number"
                step="0.1"
                value={thicknessCm}
                onChange={(e) => setThicknessCm(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Ancho (cm)</label>
              <input
                type="number"
                step="0.1"
                value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Largo (cm)</label>
              <input
                type="number"
                step="1"
                value={lengthCm}
                onChange={(e) => setLengthCm(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Piezas recibidas</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Costo / Pie Tablar ($)</label>
              <input
                type="number"
                step="0.01"
                value={costPerBoardFoot}
                onChange={(e) => setCostPerBoardFoot(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Margen objetivo (%)</label>
              <input
                type="number"
                step="1"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">
              Vincular a producto de inventario (actualiza stock y precio)
            </label>
            <select
              value={linkedProductId}
              onChange={(e) => setLinkedProductId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            >
              <option value="">Solo calcular / No vincular a catálogo</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} (Stock actual: {p.stock})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Registrar Entrada de Lote al Patio
          </button>
        </form>

        {/* Live Calculation Breakdown */}
        <div className="lg:col-span-2 bg-slate-900 text-white rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="text-sm font-semibold text-slate-300">Conversión Comercial</span>
              <span className="text-xs font-mono text-emerald-400">
                PT = (G&quot; × A&quot; × L&apos;) / 12
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-800/80 rounded-xl p-3">
                <p className="text-[11px] text-slate-400">Grosor</p>
                <p className="text-lg font-bold font-mono tabular-nums">
                  {calc?.thicknessInch ?? '-'}&quot;
                </p>
              </div>
              <div className="bg-slate-800/80 rounded-xl p-3">
                <p className="text-[11px] text-slate-400">Ancho</p>
                <p className="text-lg font-bold font-mono tabular-nums">
                  {calc?.widthInch ?? '-'}&quot;
                </p>
              </div>
              <div className="bg-slate-800/80 rounded-xl p-3">
                <p className="text-[11px] text-slate-400">Largo</p>
                <p className="text-lg font-bold font-mono tabular-nums">
                  {calc?.lengthFeet ?? '-'}&apos;
                </p>
              </div>
            </div>

            <div className="space-y-3 text-sm pt-2">
              <div className="flex justify-between text-slate-300">
                <span>Pies Tablares / pieza</span>
                <span className="font-mono tabular-nums font-semibold">
                  {calc?.boardFeetPerPiece ?? 0} PT
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Volumen total del lote</span>
                <span className="font-mono tabular-nums font-semibold">
                  {calc?.totalBoardFeet ?? 0} PT · {calc?.totalM3 ?? 0} m³
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Costo unitario por pieza</span>
                <span className="font-mono tabular-nums">${(calc?.unitCost ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-white font-bold pt-3 border-t border-slate-800">
                <span>Precio público sugerido</span>
                <span className="font-mono tabular-nums text-emerald-400 text-lg">
                  ${(calc?.publicUnitPrice ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Utilidad proyectada del lote</span>
                <span className="font-mono tabular-nums font-bold text-emerald-300">
                  +${(calc?.projectedProfit ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 border-t border-slate-800 pt-4">
            Calculado con estándares de aserradero comercial (1&quot; = 2.5 cm, 1&apos; = 30.48 cm).
          </p>
        </div>
      </div>

      {/* Entries History */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Trees className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-slate-900 text-sm">Bitácora de Entradas Recientes</h3>
        </div>
        {entries.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Aún no has registrado lotes en esta sesión. Usa la calculadora superior para dar de alta
            una recepción de madera.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {entry.species} · Clase {entry.woodClass}
                  </p>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    {entry.thicknessInch}&quot;×{entry.widthInch}&quot;×{entry.lengthFeet}&apos; ·{' '}
                    {entry.quantity} pzas · {entry.totalBoardFeet} PT ({entry.totalM3} m³)
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <p className="text-xs text-slate-500">
                    Costo ${entry.unitCost.toFixed(2)} <ArrowRight className="inline w-3 h-3" />{' '}
                    Público ${entry.publicUnitPrice.toFixed(2)}
                  </p>
                  <p className="text-xs font-bold text-emerald-700">
                    Utilidad lote: +${entry.projectedProfit.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
