'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, ReceiptText, Search } from 'lucide-react';
import { errorMessage, getProfitLoss, initAuth } from '@/lib/api';
import { DateRange, PresetKey, formatDateLabel, formatNumber, formatPct, formatRupiah, presetRange } from '@/lib/format';
import { cn } from '@/lib/cn';
import DateRangeFilter from '@/components/reports/DateRangeFilter';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

type Row = {
  quantity: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
};
type ProductRow = Row & { product_id: number; sku: string; name: string; unit: string; category: string };
type CategoryRow = Row & { category: string };

type ProfitLoss = {
  start_date: string;
  end_date: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  stock_loss: number;
  stock_gain: number;
  stock_adjustment: number;
  profit_after_adjustment: number;
  transaction_count: number;
  items_sold: number;
  by_category: CategoryRow[];
  by_product: ProductRow[];
};

type SortKey = 'name' | 'quantity' | 'revenue' | 'gross_profit' | 'gross_margin_pct';

const longDate = (iso: string) => formatDateLabel(iso, { day: 'numeric', month: 'long', year: 'numeric' });

function downloadCsv(pl: ProfitLoss) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: (string | number)[][] = [
    ['Laporan Laba Rugi', `${pl.start_date} s/d ${pl.end_date}`],
    [],
    ['Pendapatan (penjualan)', pl.revenue],
    ['Harga Pokok Penjualan (HPP)', -pl.cogs],
    ['Laba Kotor', pl.gross_profit],
    ['Kehilangan/kerusakan stok', -pl.stock_loss],
    ['Kelebihan stok (opname)', pl.stock_gain],
    ['Laba setelah selisih stok', pl.profit_after_adjustment],
    [],
    ['SKU', 'Produk', 'Kategori', 'Terjual', 'Satuan', 'Omzet', 'HPP', 'Laba Kotor', 'Margin %'],
    ...pl.by_product.map((p) => [p.sku, p.name, p.category, p.quantity, p.unit, p.revenue, p.cogs, p.gross_profit, p.gross_margin_pct.toFixed(1)]),
  ];
  const csv = lines.map((l) => l.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laba-rugi_${pl.start_date}_${pl.end_date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Satu baris laporan. `kind` menentukan tanda & bobot visual. */
function Line({
  label,
  value,
  kind = 'plain',
  note,
}: {
  label: string;
  value: number;
  kind?: 'plain' | 'minus' | 'plus' | 'subtotal' | 'total';
  note?: string;
}) {
  const strong = kind === 'subtotal' || kind === 'total';
  const sign = kind === 'minus' && value !== 0 ? '− ' : kind === 'plus' && value !== 0 ? '+ ' : '';
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 px-5',
        strong ? 'border-t border-line py-3.5' : 'py-2.5',
        kind === 'total' && 'bg-zinc-50/70',
      )}
    >
      <div className="min-w-0">
        <span className={cn('text-sm', strong ? 'font-semibold text-ink' : 'text-ink-muted')}>{label}</span>
        {note && <span className="ml-2 text-xs text-ink-subtle">{note}</span>}
      </div>
      <span
        className={cn(
          'num shrink-0',
          kind === 'total' ? 'text-lg font-semibold' : strong ? 'text-[15px] font-semibold' : 'text-sm',
          strong && value < 0 ? 'text-red-700' : strong ? 'text-ink' : 'text-ink-muted',
        )}
      >
        {sign}
        {formatRupiah(strong ? value : Math.abs(value))}
      </span>
    </div>
  );
}

export default function ProfitLossPage() {
  const [preset, setPreset] = useState<PresetKey | null>('month');
  const [range, setRange] = useState<DateRange>(() => presetRange('month'));
  const [data, setData] = useState<ProfitLoss | null>(null);
  // Range yang terakhir selesai dimuat; loading = range sekarang belum selesai.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'gross_profit', dir: -1 });
  const [query, setQuery] = useState('');

  useEffect(() => {
    initAuth().then((ok) => (ok ? setAuthed(true) : setError('Tidak bisa login ke server API. Pastikan backend berjalan.')));
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const key = `${range.start}|${range.end}`;
    getProfitLoss(range.start, range.end)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e, 'Gagal memuat laporan.')))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
  }, [authed, range.start, range.end]);

  const products = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const rows = q ? data.by_product.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) : data.by_product;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
    });
  }, [data, sort, query]);

  const loading = !error && loadedKey !== `${range.start}|${range.end}`;
  const maxCategoryRevenue = Math.max(1, ...(data?.by_category.map((c) => c.revenue) ?? [1]));

  const sortHeader = (key: SortKey, label: string, align: 'left' | 'right' = 'right') => {
    const active = sort.key === key;
    const Icon = !active ? ChevronsUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <TH align={align} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className={cn('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'name' ? 1 : -1 }))}
        >
          {label}
          <Icon className={cn('size-3', !active && 'opacity-50')} aria-hidden="true" />
        </button>
      </TH>
    );
  };

  return (
    <Page>
      <PageHeader
        title="Laba rugi"
        description={data ? `${longDate(data.start_date)} – ${longDate(data.end_date)}` : 'Pendapatan, HPP, dan laba per periode'}
        actions={
          <>
            <DateRangeFilter
              value={range}
              preset={preset}
              onChange={(r, p) => {
                setRange(r);
                setPreset(p);
              }}
            />
            <Button variant="secondary" disabled={!data} onClick={() => data && downloadCsv(data)}>
              <Download /> Ekspor CSV
            </Button>
          </>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      {!data && loading ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <Card className="space-y-4 p-5 xl:col-span-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </Card>
          <Card className="space-y-4 p-5 xl:col-span-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </Card>
        </div>
      ) : data ? (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <Card className="overflow-hidden xl:col-span-3">
              <CardHeader
                title="Ringkasan"
                description={`${formatNumber(data.transaction_count)} transaksi · ${formatNumber(data.items_sold)} barang terjual`}
              />
              <div className="border-t border-line pt-1.5">
                <Line label="Pendapatan penjualan" value={data.revenue} />
                <Line label="Harga pokok penjualan (HPP)" value={data.cogs} kind="minus" />
                <Line label="Laba kotor" value={data.gross_profit} kind="subtotal" note={`margin ${formatPct(data.gross_margin_pct)}`} />
                <Line label="Kehilangan atau kerusakan stok" value={data.stock_loss} kind="minus" />
                <Line label="Kelebihan stok dari opname" value={data.stock_gain} kind="plus" />
                <Line label="Laba setelah selisih stok" value={data.profit_after_adjustment} kind="total" />
              </div>
              <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-ink-subtle">
                Biaya operasional seperti gaji, listrik, dan sewa belum dicatat, sehingga angka ini belum laba bersih. Selisih stok dinilai
                dengan HPP produk saat ini.
              </p>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader title="Per kategori" description="Kontribusi omzet dan laba" />
              {data.by_category.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-ink-subtle">Belum ada penjualan.</p>
              ) : (
                <ul className="space-y-4 px-5 pb-5">
                  {data.by_category.map((c) => (
                    <li key={c.category}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-ink">{c.category}</span>
                        <span className="num shrink-0 text-ink">{formatRupiah(c.revenue)}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(c.revenue / maxCategoryRevenue) * 100}%` }} />
                      </div>
                      <p className="num mt-1.5 text-xs text-ink-subtle">
                        Laba {formatRupiah(c.gross_profit)} · margin {formatPct(c.gross_margin_pct)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader
              title="Per produk"
              description={`${formatNumber(products.length)} produk terjual`}
              action={
                <Input
                  type="search"
                  aria-label="Cari produk"
                  placeholder="Cari nama atau SKU"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  leading={<Search />}
                  className="w-full sm:w-64"
                />
              }
            />
            {products.length === 0 ? (
              <EmptyState icon={ReceiptText} title={query ? 'Produk tidak ditemukan' : 'Belum ada penjualan'} />
            ) : (
              <Table>
                <THead>
                  <tr>
                    {sortHeader('name', 'Produk', 'left')}
                    {sortHeader('quantity', 'Terjual')}
                    {sortHeader('revenue', 'Omzet')}
                    <TH align="right">HPP</TH>
                    {sortHeader('gross_profit', 'Laba kotor')}
                    {sortHeader('gross_margin_pct', 'Margin')}
                  </tr>
                </THead>
                <TBody>
                  {products.map((p) => (
                    <TR key={p.product_id}>
                      <TD>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-ink-subtle">
                          {p.sku} · {p.category}
                        </div>
                      </TD>
                      <TD align="right" className="text-ink-muted">
                        {formatNumber(p.quantity)} {p.unit}
                      </TD>
                      <TD align="right">{formatRupiah(p.revenue)}</TD>
                      <TD align="right" className="text-ink-muted">
                        {formatRupiah(p.cogs)}
                      </TD>
                      <TD align="right" className={cn('font-medium', p.gross_profit < 0 && 'text-red-700')}>
                        {formatRupiah(p.gross_profit)}
                      </TD>
                      <TD align="right" className="text-ink-muted">
                        {formatPct(p.gross_margin_pct)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>
      ) : null}
    </Page>
  );
}
