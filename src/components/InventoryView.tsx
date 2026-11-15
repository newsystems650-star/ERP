import React, { useEffect, useState } from 'react';
import { Search, Plus, ArrowUpDown, AlertTriangle, Package, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Product, UnitType, WoodClass } from '../types';
import { syncProductToFirestore } from '../lib/firestorePersistence';

export const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low'>('all');

  // Stock adjustment modal
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
  const [adjustQty, setAdjustQty] = useState('10');
  const [adjustReason, setAdjustReason] = useState('Conteo físico / Reposición');
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Create product modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProd, setNewProd] = useState({
    name: '',
    sku: '',
    unit: 'PIECE' as UnitType,
    woodClass: 'PRIMERA' as WoodClass,
    measure: '',
    cost: '',
    price: '',
    stock: '',
    minAlert: '10',
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory');
      if (res.ok) {
        setProducts(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;
    const raw = Number(adjustQty);
    if (!Number.isFinite(raw) || raw <= 0) {
      toast.error('Ingresa una cantidad válida mayor a 0');
      return;
    }
    const delta = adjustType === 'in' ? raw : -raw;
    setSavingAdjust(true);
    try {
      const res = await fetch(`/api/v1/inventory/${adjustProduct.id}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason: adjustReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al ajustar stock');
      syncProductToFirestore(data).catch(() => {});
      toast.success(`Stock actualizado: ${data.name} (${data.stock} uds)`);
      setAdjustProduct(null);
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al ajustar stock');
    } finally {
      setSavingAdjust(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim() || !newProd.sku.trim()) {
      toast.error('Nombre y SKU son obligatorios');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/v1/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProd,
          cost: Number(newProd.cost) || 0,
          price: Number(newProd.price) || 0,
          stock: Number(newProd.stock) || 0,
          minAlert: Number(newProd.minAlert) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al crear producto');
      syncProductToFirestore(data).catch(() => {});
      toast.success(`Producto creado: ${data.sku}`);
      setShowCreate(false);
      setNewProd({
        name: '',
        sku: '',
        unit: 'PIECE',
        woodClass: 'PRIMERA',
        measure: '',
        cost: '',
        price: '',
        stock: '',
        minAlert: '10',
      });
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear producto');
    } finally {
      setCreating(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || p.stock <= p.minAlert;
    return matchesSearch && matchesFilter;
  });

  const lowCount = products.filter((p) => p.stock <= p.minAlert).length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('low')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                filter === 'low'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock Bajo ({lowCount})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo Producto
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">SKU / Producto</th>
                <th className="text-left px-4 py-3 font-semibold">Medidas · Clase</th>
                <th className="text-right px-4 py-3 font-semibold">Costo</th>
                <th className="text-right px-4 py-3 font-semibold">P. Público</th>
                <th className="text-right px-4 py-3 font-semibold">Existencia</th>
                <th className="text-right px-5 py-3 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    Cargando inventario...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No hay productos que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isLow = p.stock <= p.minAlert;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {p.sku} · {p.unit}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <p>{p.measure}</p>
                        <p className="text-slate-400">Clase {p.woodClass}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-600">
                        ${p.cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                        ${p.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono tabular-nums font-bold ${
                            isLow ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                          {p.stock}
                        </span>
                        <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                          Min: {p.minAlert}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustProduct(p);
                            setAdjustType('in');
                            setAdjustQty('10');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                          Ajustar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleAdjustStock}
            className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Ajuste de Existencias</h3>
                <p className="text-xs text-slate-500">
                  {adjustProduct.name} · Actual: {adjustProduct.stock}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustProduct(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('in')}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold ${
                    adjustType === 'in'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Entrada (+ Stock)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('out')}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold ${
                    adjustType === 'out'
                      ? 'border-red-600 bg-red-50 text-red-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  Merma / Salida (- Stock)
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Cantidad</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Motivo de auditoría</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingAdjust}
                className="w-full py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingAdjust && <Loader2 className="w-4 h-4 animate-spin" />}
                Aplicar Ajuste Auditado
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateProduct}
            className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Nuevo Producto Maderero</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-600">Nombre comercial</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Tablón Pino Estufado 2×10"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">SKU</label>
                <input
                  type="text"
                  required
                  placeholder="TAB-210"
                  value={newProd.sku}
                  onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Clase</label>
                <select
                  value={newProd.woodClass}
                  onChange={(e) =>
                    setNewProd({ ...newProd, woodClass: e.target.value as WoodClass })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="PRIMERA">PRIMERA</option>
                  <option value="SEGUNDA">SEGUNDA</option>
                  <option value="TERCERA">TERCERA</option>
                  <option value="ESPECIAL">ESPECIAL</option>
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-600">Medidas comerciales</label>
                <input
                  type="text"
                  placeholder="25 × 5 × 250 cm (2×10×8')"
                  value={newProd.measure}
                  onChange={(e) => setNewProd({ ...newProd, measure: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Costo unitario ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newProd.cost}
                  onChange={(e) => setNewProd({ ...newProd, cost: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Precio público ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newProd.price}
                  onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Stock inicial</label>
                <input
                  type="number"
                  required
                  value={newProd.stock}
                  onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Alerta mínimo</label>
                <input
                  type="number"
                  required
                  value={newProd.minAlert}
                  onChange={(e) => setNewProd({ ...newProd, minAlert: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Producto en Catálogo
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
