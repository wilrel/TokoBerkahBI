'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { createProduct, errorMessage, getCategories, getProducts, initAuth } from '@/lib/api';
import { formatNumber, formatPct, formatRupiah } from '@/lib/format';
import type { Category, Product } from '@/lib/types';
import { StockBadge } from '@/components/StockBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

const emptyForm = { sku: '', name: '', unit: 'pcs', category_id: '', selling_price: '', current_hpp: '', current_stock: '0' };

function AddProductDialog({
  open,
  onClose,
  categories,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onCreated: (p: Product) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof emptyForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const price = Number(form.selling_price) || 0;
  const hpp = Number(form.current_hpp) || 0;
  const margin = price > 0 ? ((price - hpp) / price) * 100 : null;

  const close = () => {
    setForm(emptyForm);
    setError(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const product = await createProduct({
        sku: form.sku.trim(),
        name: form.name.trim(),
        unit: form.unit.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        selling_price: price,
        current_hpp: hpp,
        current_stock: Number(form.current_stock) || 0,
      });
      toast({ tone: 'success', title: 'Produk ditambahkan', description: product.name });
      onCreated(product);
      close();
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan produk.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Tambah produk"
      description="Stok awal akan tercatat sebagai pergerakan stok pembuka."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Batal
          </Button>
          <Button type="submit" form="add-product" loading={saving}>
            Simpan produk
          </Button>
        </>
      }
    >
      <form id="add-product" onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nama produk" htmlFor="p-name" required>
          <Input id="p-name" required value={form.name} onChange={set('name')} placeholder="Beras Premium 5kg" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU" htmlFor="p-sku" required>
            <Input id="p-sku" required value={form.sku} onChange={set('sku')} placeholder="BRS-5KG" />
          </Field>
          <Field label="Satuan" htmlFor="p-unit" required>
            <Input id="p-unit" required value={form.unit} onChange={set('unit')} placeholder="pcs, kg, sak" />
          </Field>
        </div>
        <Field label="Kategori" htmlFor="p-cat">
          <Select id="p-cat" value={form.category_id} onChange={set('category_id')}>
            <option value="">Tanpa kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Harga jual" htmlFor="p-price" required>
            <Input id="p-price" type="number" min={0} required value={form.selling_price} onChange={set('selling_price')} leading={<span className="text-xs">Rp</span>} />
          </Field>
          <Field label="HPP (modal)" htmlFor="p-hpp" required hint={margin != null ? `Margin ${formatPct(margin)}` : undefined}>
            <Input id="p-hpp" type="number" min={0} required value={form.current_hpp} onChange={set('current_hpp')} leading={<span className="text-xs">Rp</span>} />
          </Field>
        </div>
        <Field label="Stok awal" htmlFor="p-stock">
          <Input id="p-stock" type="number" min={0} value={form.current_stock} onChange={set('current_stock')} />
        </Field>
      </form>
    </Dialog>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      await initAuth();
      const [p, c] = await Promise.all([getProducts(), getCategories()]);
      setProducts(p);
      setCategories(c);
    } catch (e) {
      setError(errorMessage(e, 'Gagal memuat produk.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari API
    load();
  }, [load]);

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
        (!categoryFilter || String(p.category_id ?? 'none') === categoryFilter),
    );
  }, [products, query, categoryFilter]);

  return (
    <Page>
      <PageHeader
        title="Produk"
        description={loading ? 'Daftar produk dan harga' : `${formatNumber(products.length)} produk terdaftar`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Tambah produk
          </Button>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

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
          <Select aria-label="Filter kategori" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="sm:w-52">
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Tanpa kategori</option>
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
            <EmptyState
              icon={Package}
              title={products.length === 0 ? 'Belum ada produk' : 'Produk tidak ditemukan'}
              description={products.length === 0 ? 'Tambahkan produk pertama atau import dari file CSV.' : 'Coba kata kunci atau kategori lain.'}
              action={
                products.length === 0 && (
                  <Button onClick={() => setAdding(true)}>
                    <Plus /> Tambah produk
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Produk</TH>
                <TH>Kategori</TH>
                <TH align="right">Harga jual</TH>
                <TH align="right">HPP</TH>
                <TH align="right">Margin</TH>
                <TH align="right">Stok</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => {
                const margin = p.selling_price > 0 ? ((p.selling_price - p.current_hpp) / p.selling_price) * 100 : 0;
                return (
                  <TR key={p.id}>
                    <TD>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-ink-subtle">{p.sku}</div>
                    </TD>
                    <TD className="text-ink-muted">{p.category_id ? categoryName.get(p.category_id) ?? '-' : '-'}</TD>
                    <TD align="right" className="font-medium">
                      {formatRupiah(p.selling_price)}
                    </TD>
                    <TD align="right" className="text-ink-muted">
                      {formatRupiah(p.current_hpp)}
                    </TD>
                    <TD align="right" className={margin < 0 ? 'text-red-700' : 'text-ink-muted'}>
                      {formatPct(margin)}
                    </TD>
                    <TD align="right">
                      <StockBadge stock={p.current_stock} unit={p.unit} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <AddProductDialog
        open={adding}
        onClose={() => setAdding(false)}
        categories={categories}
        onCreated={(p) => setProducts((list) => [p, ...list])}
      />
    </Page>
  );
}
