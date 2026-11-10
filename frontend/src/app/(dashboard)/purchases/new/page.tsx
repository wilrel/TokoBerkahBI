'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { createPurchase, errorMessage, getProducts, initAuth } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import type { Product } from '@/lib/types';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { useToast } from '@/components/ui/toast';

type Line = { key: number; product_id: number | ''; quantity: string; unit_cost: string };

let nextKey = 1;
const newLine = (): Line => ({ key: nextKey++, product_id: '', quantity: '1', unit_cost: '' });

export default function NewPurchasePage() {
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [supplier, setSupplier] = useState('');
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        const data = await getProducts();
        if (!cancelled) setProducts(data);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, 'Gagal memuat produk.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productById = new Map(products.map((p) => [p.id, p]));
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const subtotal = (l: Line) => (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
  const total = lines.reduce((a, l) => a + subtotal(l), 0);
  const valid = lines.length > 0 && lines.every((l) => l.product_id !== '' && Number(l.quantity) > 0 && l.unit_cost !== '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await createPurchase({
        supplier_name: supplier.trim() || undefined,
        items: lines.map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) })),
      });
      toast({ tone: 'success', title: 'Pembelian tersimpan', description: `Stok dan HPP ${lines.length} produk diperbarui.` });
      router.push('/purchases');
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan pembelian.'));
      setSaving(false);
    }
  };

  return (
    <Page size="narrow">
      <PageHeader
        eyebrow={
          <LinkButton href="/purchases" variant="ghost" size="sm" className="-ml-2.5">
            <ChevronLeft /> Pembelian
          </LinkButton>
        }
        title="Catat pembelian"
        description="Stok bertambah dan HPP diperbarui otomatis berdasarkan harga beli."
      />

      <form onSubmit={submit} className="space-y-6">
        {error && <Alert>{error}</Alert>}

        <Card className="p-5">
          <Field label="Supplier" htmlFor="supplier" hint="Opsional. Nama distributor atau toko tempat membeli.">
            <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="PT Distributor Sembako" />
          </Field>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Barang"
            description="Harga beli per satuan, sebelum diskon"
            action={
              <Button variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
                <Plus /> Tambah baris
              </Button>
            }
          />

          {lines.length === 0 ? (
            <div className="border-t border-line">
              <EmptyState icon={PackagePlus} title="Belum ada barang" description="Tambahkan minimal satu barang." />
            </div>
          ) : (
            <div className="divide-y divide-line border-t border-line">
              <div className="hidden grid-cols-[1fr_88px_150px_130px_32px] gap-3 bg-zinc-50/70 px-5 py-2 text-xs font-medium text-ink-subtle md:grid">
                <span>Produk</span>
                <span>Jumlah</span>
                <span>Harga beli</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>
              {lines.map((l, idx) => {
                const product = l.product_id === '' ? undefined : productById.get(l.product_id);
                return (
                  <div key={l.key} className="grid grid-cols-2 items-start gap-3 px-5 py-3.5 md:grid-cols-[1fr_88px_150px_130px_32px] md:items-center">
                    <Select
                      aria-label={`Produk baris ${idx + 1}`}
                      value={l.product_id}
                      onChange={(e) => {
                        const id = e.target.value === '' ? '' : Number(e.target.value);
                        const p = id === '' ? undefined : productById.get(id);
                        // Isi harga beli dengan HPP terakhir sebagai titik awal.
                        update(l.key, { product_id: id, unit_cost: l.unit_cost === '' && p ? String(p.current_hpp) : l.unit_cost });
                      }}
                      className="col-span-2 md:col-span-1"
                    >
                      <option value="">Pilih produk</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      aria-label={`Jumlah baris ${idx + 1}`}
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })}
                      trailing={product?.unit}
                    />
                    <Input
                      type="number"
                      min={0}
                      aria-label={`Harga beli baris ${idx + 1}`}
                      value={l.unit_cost}
                      onChange={(e) => update(l.key, { unit_cost: e.target.value })}
                      leading={<span className="text-xs">Rp</span>}
                    />
                    <div className="num self-center text-sm font-medium text-ink md:text-right">{formatRupiah(subtotal(l))}</div>
                    <IconButton
                      aria-label={`Hapus baris ${idx + 1}`}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="justify-self-end hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-line bg-zinc-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-ink-subtle">Total pembelian</p>
              <p className="num text-2xl font-semibold tracking-tight">{formatRupiah(total)}</p>
            </div>
            <div className="flex gap-2">
              <LinkButton href="/purchases" variant="secondary">
                Batal
              </LinkButton>
              <Button type="submit" disabled={!valid} loading={saving}>
                Simpan pembelian
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </Page>
  );
}
