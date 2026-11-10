'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, ClipboardCheck, Search } from 'lucide-react';
import { adjustInventory, errorMessage, getProducts, initAuth } from '@/lib/api';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/cn';
import { LOW_STOCK, StockBadge } from '@/components/StockBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

type StockFilter = 'all' | 'low' | 'out';

function OpnameDialog({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [actual, setActual] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Isi ulang form setiap kali dialog dibuka untuk produk lain.
  const [forId, setForId] = useState<number | null>(null);
  if (product && product.id !== forId) {
    setForId(product.id);
    setActual(String(product.current_stock));
    setReason('');
    setError(null);
  }

  const actualNum = actual === '' ? null : Number(actual);
  const diff = product && actualNum != null ? actualNum - product.current_stock : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || actualNum == null || diff === 0) return;
    setSaving(true);
    setError(null);
    try {
      await adjustInventory(product.id, { actual_stock: actualNum, reason: reason.trim() || 'Stock opname' });
      toast({ tone: 'success', title: 'Stok diperbarui', description: `${product.name}: ${diff > 0 ? '+' : ''}${diff} ${product.unit}` });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan penyesuaian stok.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!product}
      onClose={onClose}
      title="Stock opname"
      description={product ? `${product.name} · ${product.sku}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="opname" loading={saving} disabled={actualNum == null || diff === 0}>
            Simpan penyesuaian
          </Button>
        </>
      }
    >
      {product && (
        <form id="opname" onSubmit={submit} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-zinc-50/70 px-3.5 py-3">
              <p className="text-xs text-ink-subtle">Stok di sistem</p>
              <p className="num mt-1 text-lg font-semibold text-ink">
                {formatNumber(product.current_stock)} <span className="text-sm font-normal text-ink-subtle">{product.unit}</span>
              </p>
            </div>
            <div
              className={cn(
                'rounded-lg border px-3.5 py-3',
                diff < 0 ? 'border-red-200 bg-red-50' : diff > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-line bg-zinc-50/70',
              )}
            >
              <p className="text-xs text-ink-subtle">Selisih</p>
              <p className={cn('num mt-1 text-lg font-semibold', diff < 0 ? 'text-red-700' : diff > 0 ? 'text-emerald-700' : 'text-ink')}>
                {diff > 0 ? '+' : ''}
                {formatNumber(diff)} <span className="text-sm font-normal text-ink-subtle">{product.unit}</span>
              </p>
            </div>
          </div>
          <Field
            label="Stok fisik sebenarnya"
            htmlFor="actual"
            required
            hint={diff !== 0 ? `Nilai selisih ${formatRupiah(Math.abs(diff) * product.current_hpp)} (dihitung dari HPP)` : 'Hitung barang di rak dan gudang.'}
          >
            <Input id="actual" type="number" min={0} required autoFocus value={actual} onChange={(e) => setActual(e.target.value)} />
          </Field>
          <Field label="Alasan" htmlFor="reason">
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rusak, kedaluwarsa, hilang, opname bulanan" />
          </Field>
        </form>
      )}
    </Dialog>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const load = useCallback(async () => {
    try {
      await initAuth();
      setProducts(await getProducts());
    } catch (e) {
      setError(errorMessage(e, 'Gagal memuat data stok.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari API
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      value: products.reduce((a, p) => a + Math.max(p.current_stock, 0) * p.current_hpp, 0),
      low: products.filter((p) => p.current_stock > 0 && p.current_stock <= LOW_STOCK).length,
      out: products.filter((p) => p.current_stock <= 0).length,
    }),
    [products],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      if (filter === 'low') return p.current_stock > 0 && p.current_stock <= LOW_STOCK;
      if (filter === 'out') return p.current_stock <= 0;
      return true;
    });
  }, [products, query, filter]);

  return (
    <Page>
      <PageHeader title="Stok & opname" description="Pantau persediaan dan catat selisih stok fisik" />

      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ['Nilai persediaan', formatRupiah(totals.value), 'Dihitung dari HPP'],
          ['Stok menipis', formatNumber(totals.low), `${LOW_STOCK} unit atau kurang`],
          ['Stok habis', formatNumber(totals.out), 'Tidak bisa dijual'],
        ].map(([label, value, hint]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-ink-subtle">{label}</p>
            {loading ? <Skeleton className="mt-3 h-7 w-32" /> : <p className="num mt-2 text-2xl font-semibold tracking-tight">{value}</p>}
            <p className="mt-1 text-xs text-ink-subtle">{hint}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Input
            type="search"
            aria-label="Cari produk"
            placeholder="Cari nama atau SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leading={<Search />}
            className="sm:w-72"
          />
          <Select aria-label="Filter stok" value={filter} onChange={(e) => setFilter(e.target.value as StockFilter)} className="sm:w-48">
            <option value="all">Semua stok</option>
            <option value="low">Stok menipis</option>
            <option value="out">Stok habis</option>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3 border-t border-line p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState icon={Boxes} title="Tidak ada produk" description="Tidak ada produk yang cocok dengan filter ini." />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Produk</TH>
                <TH align="right">Stok sistem</TH>
                <TH align="right">HPP</TH>
                <TH align="right">Nilai stok</TH>
                <TH align="right">
                  <span className="sr-only">Aksi</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ink-subtle">{p.sku}</div>
                  </TD>
                  <TD align="right">
                    <StockBadge stock={p.current_stock} unit={p.unit} />
                  </TD>
                  <TD align="right" className="text-ink-muted">
                    {formatRupiah(p.current_hpp)}
                  </TD>
                  <TD align="right" className="font-medium">
                    {formatRupiah(Math.max(p.current_stock, 0) * p.current_hpp)}
                  </TD>
                  <TD align="right">
                    <Button variant="secondary" size="sm" onClick={() => setAdjusting(p)}>
                      <ClipboardCheck /> Opname
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <OpnameDialog product={adjusting} onClose={() => setAdjusting(null)} onSaved={load} />
    </Page>
  );
}
