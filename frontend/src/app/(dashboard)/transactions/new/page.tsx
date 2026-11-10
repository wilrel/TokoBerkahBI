'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, PackageSearch, Plus, ScanLine, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { createTransaction, errorMessage, getProducts, initAuth } from '@/lib/api';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import BarcodeScanner from '@/components/BarcodeScanner';

type CartItem = { product: Product; quantity: number };

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Tunai' },
  { key: 'QRIS', label: 'QRIS' },
  { key: 'TRANSFER', label: 'Transfer' },
] as const;

const LOW_STOCK = 5;

export default function POSPage() {
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [payment, setPayment] = useState<(typeof PAYMENT_METHODS)[number]['key']>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        const data = await getProducts();
        if (!cancelled) setProducts(data.filter((p) => p.is_active));
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e, 'Gagal memuat produk.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Tekan "/" untuk langsung ke kolom cari, seperti aplikasi kasir pada umumnya.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : products;
  }, [products, search]);

  const qtyInCart = (id: number) => cart.find((i) => i.product.id === id)?.quantity ?? 0;
  const total = cart.reduce((sum, i) => sum + i.product.selling_price * i.quantity, 0);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cash = Number(cashReceived) || 0;
  const change = cash - total;
  const cashShort = payment === 'CASH' && cashReceived !== '' && change < 0;

  const setQty = (product: Product, quantity: number) => {
    if (quantity > product.current_stock) {
      toast({ tone: 'error', title: 'Stok tidak cukup', description: `Sisa stok ${product.name}: ${product.current_stock} ${product.unit}.` });
      return;
    }
    setCart((c) => {
      if (quantity <= 0) return c.filter((i) => i.product.id !== product.id);
      const exists = c.some((i) => i.product.id === product.id);
      return exists ? c.map((i) => (i.product.id === product.id ? { ...i, quantity } : i)) : [...c, { product, quantity }];
    });
  };

  const findBySku = (code: string) => products.find((p) => p.sku.toLowerCase() === code.trim().toLowerCase());

  /** Barcode dari kamera atau scanner USB: cocokkan dengan SKU lalu tambah 1 ke pesanan. */
  const addByCode = (code: string) => {
    const product = findBySku(code);
    if (!product) {
      toast({ tone: 'error', title: 'Barcode belum terdaftar', description: `Kode ${code} tidak cocok dengan SKU produk mana pun.` });
      setLastScan(null);
      return false;
    }
    const next = qtyInCart(product.id) + 1;
    setQty(product, next);
    setLastScan(next <= product.current_stock ? `${product.name} ditambahkan, jumlah ${next}` : null);
    return next <= product.current_stock;
  };

  /** Scanner USB mengetik kode lalu menekan Enter. */
  const onSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = search.trim();
    if (!code) return;
    if (findBySku(code)) {
      addByCode(code);
      setSearch('');
    } else if (filtered.length === 1) {
      setQty(filtered[0], qtyInCart(filtered[0].id) + 1);
      setSearch('');
    }
  };

  const checkout = async () => {
    if (cart.length === 0 || cashShort) return;
    setSubmitting(true);
    try {
      await createTransaction({
        payment_method: payment,
        items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      });
      toast({
        tone: 'success',
        title: 'Transaksi tersimpan',
        description:
          payment === 'CASH' && cash > 0 ? `Total ${formatRupiah(total)} · kembalian ${formatRupiah(change)}` : `Total ${formatRupiah(total)}`,
      });
      setCart([]);
      setCashReceived('');
      setProducts((await getProducts()).filter((p) => p.is_active));
      searchRef.current?.focus();
    } catch (e) {
      toast({ tone: 'error', title: 'Transaksi gagal', description: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  };

  // Nominal cepat: uang pas + pecahan umum di atas total.
  const quickCash = useMemo(() => {
    if (total <= 0) return [];
    const notes = [10000, 20000, 50000, 100000];
    const opts = new Set<number>([total]);
    for (const n of notes) opts.add(Math.ceil(total / n) * n);
    return [...opts].sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:h-dvh lg:flex-row">
      {/* Produk */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-line bg-surface px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-ink">Kasir</h1>
              <p className="text-sm text-ink-subtle">Ketuk produk atau scan barcode untuk menambahkannya</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Input
              ref={searchRef}
              autoFocus
              type="search"
              aria-label="Cari produk atau scan barcode"
              placeholder="Cari produk, atau scan barcode"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchEnter}
              leading={<Search />}
              trailing={<kbd className="hidden rounded border border-line px-1.5 font-sans text-[11px] sm:inline">/</kbd>}
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={() => {
                setLastScan(null);
                setScanning(true);
              }}
            >
              <ScanLine /> <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loadError && <Alert className="mb-4">{loadError}</Alert>}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={PackageSearch} title="Produk tidak ditemukan" description="Coba kata kunci lain atau periksa SKU." />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((p) => {
                const inCart = qtyInCart(p.id);
                const out = p.current_stock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    onClick={() => setQty(p, inCart + 1)}
                    className={cn(
                      'group relative flex flex-col rounded-xl border bg-surface p-3.5 text-left shadow-[var(--shadow-card)] transition',
                      'hover:border-line-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.99]',
                      'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-[var(--shadow-card)]',
                      inCart > 0 ? 'border-accent ring-1 ring-accent' : 'border-line',
                    )}
                  >
                    {inCart > 0 && (
                      <span className="num absolute top-2.5 right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">
                        {inCart}
                      </span>
                    )}
                    <span className="pr-6 text-xs text-ink-subtle">{p.sku}</span>
                    <span className="mt-0.5 line-clamp-2 min-h-10 text-sm leading-5 font-medium text-ink">{p.name}</span>
                    <span className="mt-3 flex items-end justify-between gap-2">
                      <span className="num text-[15px] font-semibold text-ink">{formatRupiah(p.selling_price)}</span>
                      <span
                        className={cn(
                          'num text-xs',
                          out ? 'font-medium text-red-700' : p.current_stock <= LOW_STOCK ? 'font-medium text-amber-700' : 'text-ink-subtle',
                        )}
                      >
                        {out ? 'Habis' : `${formatNumber(p.current_stock)} ${p.unit}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Pesanan */}
      <aside className="flex max-h-[55dvh] flex-col border-t border-line bg-surface lg:max-h-none lg:w-[380px] lg:border-t-0 lg:border-l">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Pesanan</h2>
            {itemCount > 0 && <span className="num rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-ink-muted">{itemCount} item</span>}
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCart([])}>
              Kosongkan
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Pesanan masih kosong" description="Pilih produk untuk menambahkannya ke pesanan." className="py-6 lg:py-14" />
          ) : (
            <ul className="divide-y divide-line">
              {cart.map(({ product: p, quantity }) => (
                <li key={p.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                      <p className="num text-xs text-ink-subtle">
                        {formatRupiah(p.selling_price)} / {p.unit}
                      </p>
                    </div>
                    <p className="num shrink-0 text-sm font-medium text-ink">{formatRupiah(p.selling_price * quantity)}</p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-lg border border-line">
                      <IconButton aria-label={`Kurangi ${p.name}`} onClick={() => setQty(p, quantity - 1)} className="rounded-r-none">
                        <Minus />
                      </IconButton>
                      <input
                        type="number"
                        min={1}
                        aria-label={`Jumlah ${p.name}`}
                        value={quantity}
                        onChange={(e) => setQty(p, Math.max(1, Number(e.target.value) || 1))}
                        className="num h-8 w-11 border-x border-line text-center text-sm font-medium text-ink focus:outline-none"
                      />
                      <IconButton aria-label={`Tambah ${p.name}`} onClick={() => setQty(p, quantity + 1)} className="rounded-l-none">
                        <Plus />
                      </IconButton>
                    </div>
                    <IconButton aria-label={`Hapus ${p.name}`} onClick={() => setQty(p, 0)} className="hover:bg-red-50 hover:text-red-600">
                      <Trash2 />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 space-y-4 border-t border-line bg-zinc-50/60 px-5 py-4">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-0.5" role="group" aria-label="Metode pembayaran">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={payment === m.key}
                onClick={() => setPayment(m.key)}
                className={cn(
                  'h-8 rounded-md text-sm transition-colors',
                  payment === m.key ? 'bg-white font-medium text-ink shadow-[var(--shadow-card)]' : 'text-ink-muted hover:text-ink',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {payment === 'CASH' && cart.length > 0 && (
            <div className="space-y-2">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label="Uang diterima"
                placeholder="Uang diterima"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                leading={<span className="text-xs font-medium">Rp</span>}
              />
              <div className="flex flex-wrap gap-1.5">
                {quickCash.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCashReceived(String(n))}
                    className="num h-7 rounded-md border border-line bg-surface px-2 text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {n === total ? 'Uang pas' : formatRupiah(n)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-subtle">Total</dt>
              <dd className="num text-xl font-semibold tracking-tight text-ink">{formatRupiah(total)}</dd>
            </div>
            {payment === 'CASH' && cashReceived !== '' && (
              <div className="flex justify-between">
                <dt className="text-ink-subtle">{cashShort ? 'Kurang' : 'Kembalian'}</dt>
                <dd className={cn('num font-medium', cashShort ? 'text-red-700' : 'text-emerald-700')}>{formatRupiah(Math.abs(change))}</dd>
              </div>
            )}
          </dl>

          <Button size="lg" className="w-full" disabled={cart.length === 0 || cashShort} loading={submitting} onClick={checkout}>
            {cart.length === 0 ? 'Bayar' : `Bayar ${formatRupiah(total)}`}
          </Button>
        </div>
      </aside>
      <BarcodeScanner
        open={scanning}
        onClose={() => {
          setScanning(false);
          searchRef.current?.focus();
        }}
        onScan={addByCode}
        title="Scan barang"
        continuous
        lastResult={lastScan}
      />
    </div>
  );
}
