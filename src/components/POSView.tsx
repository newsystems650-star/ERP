import React, { useEffect, useState } from 'react';
import {
  Search,
  Package,
  Plus,
  Minus,
  ShoppingCart,
  Scissors,
  Trash2,
  ChevronRight,
  X,
  Users,
  CreditCard,
  DollarSign,
  Activity,
  ShieldAlert,
  Truck,
  Loader2,
  CheckCircle2,
  BellRing,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  CartItem,
  DeliveryType,
  MaquilaSpecs,
  PaymentMethod,
  Product,
  Ticket,
} from '../types';
import { PatioSheetModal } from './PatioSheetModal';
import {
  syncInvoiceToFirestore,
  syncProductToFirestore,
  syncTicketToFirestore,
} from '../lib/firestorePersistence';

export const POSView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Maquila Modal
  const [showMaquila, setShowMaquila] = useState(false);
  const [activeItem, setActiveItem] = useState<CartItem | null>(null);
  const [maquilaData, setMaquilaData] = useState<MaquilaSpecs>({
    width: '',
    length: '',
    thickness: '',
    notes: '',
  });

  // Checkout Modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [applyTax, setApplyTax] = useState(false);
  const [issueInvoice, setIssueInvoice] = useState(false);
  const [rfcReceptor, setRfcReceptor] = useState('XAXX010101000');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('IMMEDIATE');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Confirmed Ticket Patio Sheet Modal
  const [confirmedTicket, setConfirmedTicket] = useState<Ticket | null>(null);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/v1/inventory');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      toast.error('No se pudo cargar el catálogo de productos');
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error(`Sin existencias para ${product.name}`);
      return;
    }
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      if (existing.qty + 1 > product.stock) {
        toast.warning(`Stock máximo disponible: ${product.stock}`);
        return;
      }
      setCart(cart.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item)));
    } else {
      setCart([...cart, { ...product, qty: 1, cuts: null }]);
    }
    toast.success(`${product.name} agregado`);
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          const nextQty = item.qty + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.stock) {
            toast.warning(`Stock máximo disponible: ${item.stock}`);
            return item;
          }
          return { ...item, qty: nextQty };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const openMaquila = (item: CartItem) => {
    setActiveItem(item);
    setMaquilaData(item.cuts || { width: '', length: '', thickness: '', notes: '' });
    setShowMaquila(true);
  };

  const saveMaquila = () => {
    if (!activeItem) return;
    setCart(cart.map((item) => (item.id === activeItem.id ? { ...item, cuts: maquilaData } : item)));
    setShowMaquila(false);
    toast.info('Instrucciones de maquila guardadas');
  };

  const handleRequestCreditApproval = async () => {
    try {
      const res = await fetch('/api/v1/cashier/credit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: 'SOLICITUD-POS',
          customerName: customerName || 'Cliente Mostrador',
          amount: total,
        }),
      });
      if (res.ok) {
        toast.success('Solicitud de crédito enviada al administrador (Hook Telegram / Cola)');
      }
    } catch {
      toast.error('Error al enviar solicitud de crédito');
    }
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/cashier/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || 'Venta Mostrador',
          items: cart.map((item) => ({
            productId: item.id,
            name: item.name,
            sku: item.sku,
            quantity: item.qty,
            unitPrice: item.price,
            cuts: item.cuts,
          })),
          applyTax,
          paymentMethod,
          deliveryType,
          deliveryAddress: deliveryType === 'DELIVERY' ? deliveryAddress.trim() : undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Error al procesar la venta');
      }

      // Sync ticket to Firestore if user connected Firebase
      syncTicketToFirestore(payload).catch(() => {});

      let invoiceFolio: string | null = null;
      if (issueInvoice) {
        const invRes = await fetch('/api/v1/admin/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketIdOrCode: payload.code,
            rfcReceptor: rfcReceptor.trim() || 'XAXX010101000',
            nombreReceptor: customerName.trim() || 'PUBLICO EN GENERAL',
          }),
        });
        if (invRes.ok) {
          const invData = await invRes.json();
          invoiceFolio = invData.folio;
          syncInvoiceToFirestore(invData).catch(() => {});
        }
      }

      toast.success(`Ticket confirmado: ${payload.code}`, {
        description: invoiceFolio
          ? `Hoja de patio ${payload.patioSheet.folio} y Factura ${invoiceFolio} guardadas.`
          : `Hoja de patio ${payload.patioSheet.folio} generada y stock descontado.`,
        duration: 5000,
      });

      setCart([]);
      setCustomerName('');
      setDeliveryAddress('');
      setIssueInvoice(false);
      setShowCheckout(false);
      setConfirmedTicket(payload);

      const invListRes = await fetch('/api/v1/inventory');
      if (invListRes.ok) {
        const updatedProducts: Product[] = await invListRes.json();
        setProducts(updatedProducts);
        for (const p of updatedProducts) {
          syncProductToFirestore(p).catch(() => {});
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al procesar la venta';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const tax = applyTax ? subtotal * 0.16 : 0;
  const total = subtotal + tax;

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col xl:flex-row gap-6 relative">
      {/* Catalog */}
      <div className="flex-1 space-y-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar madera o tablero por nombre o SKU..."
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loadingProducts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-36 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
            No se encontraron productos para "{search}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const isLow = product.stock <= product.minAlert;
              const outOfStock = product.stock <= 0;
              return (
                <button
                  type="button"
                  key={product.id}
                  disabled={outOfStock}
                  onClick={() => addToCart(product)}
                  className={`text-left bg-white p-5 rounded-2xl border transition-all group ${
                    outOfStock
                      ? 'border-slate-200 opacity-50 cursor-not-allowed'
                      : 'border-slate-200 hover:border-emerald-600 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-mono text-slate-500">{product.sku}</span>
                    <span
                      className={`text-xs font-semibold font-mono tabular-nums ${
                        outOfStock
                          ? 'text-red-600'
                          : isLow
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      Stock: {product.stock}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">{product.measure}</p>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                      <Plus className="w-4 h-4" /> Agregar
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="w-full xl:w-96 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shrink-0 xl:sticky xl:top-6 xl:max-h-[calc(100vh-8rem)]">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-900 text-sm">Ticket Activo</h2>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {cart.reduce((sum, i) => sum + i.qty, 0)} pzas
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[220px]">
          {cart.length === 0 ? (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 opacity-50" />
              <p className="text-sm">Selecciona madera del catálogo</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="pb-4 border-b border-slate-100 last:border-b-0 last:pb-0 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{item.name}</h4>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      ${item.price.toFixed(2)} c/u
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 font-mono tabular-nums shrink-0">
                    ${(item.qty * item.price).toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, -1)}
                      aria-label="Disminuir cantidad"
                      className="p-1.5 text-slate-600 hover:text-slate-900"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2.5 text-xs font-bold font-mono tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, 1)}
                      aria-label="Aumentar cantidad"
                      className="p-1.5 text-slate-600 hover:text-slate-900"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openMaquila(item)}
                      className={`text-xs inline-flex items-center gap-1 font-semibold hover:underline ${
                        item.cuts ? 'text-blue-700' : 'text-emerald-700'
                      }`}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      {item.cuts ? 'Editar maquila' : 'Maquila'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCart(cart.filter((i) => i.id !== item.id))}
                      aria-label="Eliminar partida"
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>IVA ({applyTax ? '16%' : '0%'})</span>
              <span className="font-mono tabular-nums">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200">
              <span>Total</span>
              <span className="font-mono tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
            className="w-full bg-emerald-600 text-white py-3 px-4 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Cobrar y Confirmar
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Maquila Modal */}
      <AnimatePresence>
        {showMaquila && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <Scissors className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Instrucciones de Maquila</h3>
                </div>
                <button
                  onClick={() => setShowMaquila(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600">
                  Medidas finales de corte para{' '}
                  <span className="font-bold text-slate-900">{activeItem?.name}</span>
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Ancho (cm)</label>
                    <input
                      type="number"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={maquilaData.width}
                      onChange={(e) => setMaquilaData({ ...maquilaData, width: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Largo (cm)</label>
                    <input
                      type="number"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={maquilaData.length}
                      onChange={(e) => setMaquilaData({ ...maquilaData, length: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Grosor (cm)</label>
                    <input
                      type="number"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={maquilaData.thickness}
                      onChange={(e) =>
                        setMaquilaData({ ...maquilaData, thickness: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Notas para sierra</label>
                  <textarea
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 h-20 resize-none"
                    placeholder="Ej: Cantear un lado, cepillar a medida..."
                    value={maquilaData.notes}
                    onChange={(e) => setMaquilaData({ ...maquilaData, notes: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  onClick={saveMaquila}
                  className="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors"
                >
                  Guardar Instrucciones
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {showCheckout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-2xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Finalizar Venta Atómica</h3>
                  <p className="text-xs text-slate-500">
                    Descuenta stock, genera Hoja de Patio y registra auditoría AES-256
                  </p>
                </div>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Cliente
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre del cliente (opcional)"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Método de Pago
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { id: 'CASH' as PaymentMethod, label: 'Efectivo', icon: DollarSign },
                        { id: 'CARD_CREDIT' as PaymentMethod, label: 'Tarjeta', icon: CreditCard },
                        { id: 'TRANSFER' as PaymentMethod, label: 'Transferencia', icon: Activity },
                        { id: 'CREDIT' as PaymentMethod, label: 'Crédito / Fiado', icon: ShieldAlert },
                      ].map((method) => (
                        <button
                          type="button"
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id)}
                          className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                            paymentMethod === method.id
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <method.icon className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-semibold whitespace-nowrap">
                            {method.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    {paymentMethod === 'CREDIT' && (
                      <button
                        type="button"
                        onClick={handleRequestCreditApproval}
                        className="w-full mt-2 py-2 px-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100 flex items-center justify-center gap-1.5"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        Solicitar Autorización por Telegram
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" /> Logística de Entrega
                    </label>
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => setDeliveryType('IMMEDIATE')}
                        className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                          deliveryType === 'IMMEDIATE'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        Al Momento
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('DELIVERY')}
                        className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                          deliveryType === 'DELIVERY'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        A Domicilio
                      </button>
                    </div>
                    {deliveryType === 'DELIVERY' && (
                      <input
                        type="text"
                        placeholder="Dirección de entrega..."
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    )}
                  </div>

                  <div className="bg-slate-900 rounded-xl p-5 text-white space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-300">Aplicar IVA (16%)</span>
                      <button
                        type="button"
                        onClick={() => setApplyTax(!applyTax)}
                        aria-pressed={applyTax}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          applyTax ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            applyTax ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-slate-300">
                          Timbrar Factura CFDI
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !issueInvoice;
                            setIssueInvoice(next);
                            if (next) setApplyTax(true);
                          }}
                          aria-pressed={issueInvoice}
                          className={`w-11 h-6 rounded-full transition-colors relative ${
                            issueInvoice ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              issueInvoice ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      {issueInvoice && (
                        <input
                          type="text"
                          placeholder="RFC Receptor (ej. XAXX010101000)"
                          value={rfcReceptor}
                          onChange={(e) => setRfcReceptor(e.target.value.toUpperCase())}
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5 pt-3 border-t border-slate-800 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal</span>
                        <span className="font-mono tabular-nums">${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>IVA</span>
                        <span className="font-mono tabular-nums">${tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold pt-2">
                        <span>Total</span>
                        <span className="text-emerald-400 font-mono tabular-nums">
                          ${total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleCheckout}
                  className="w-full bg-emerald-600 text-white py-3 px-4 rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar Venta y Generar Hoja de Patio
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PatioSheetModal ticket={confirmedTicket} onClose={() => setConfirmedTicket(null)} />
    </div>
  );
};
