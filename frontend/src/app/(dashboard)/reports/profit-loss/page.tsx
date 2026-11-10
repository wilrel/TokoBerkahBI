'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { getProfitLoss, initAuth } from '@/lib/api';
import { DateRange, PresetKey, formatDateLabel, formatNumber, formatPct, formatRupiah, presetRange } from '@/lib/format';
import DateRangeFilter from '@/components/reports/DateRangeFilter';

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

const card = 'bg-white rounded-lg shadow border border-gray-200';
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
    ...pl.by_product.map((p) => [
      p.sku, p.name, p.category, p.quantity, p.unit, p.revenue, p.cogs, p.gross_profit, p.gross_margin_pct.toFixed(1),
    ]),
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

function StatementLine({
  label,
  value,
  sign = '',
  strong = false,
  sub,
}: {
  label: string;
  value: number;
  sign?: '' | '−' | '+';
  strong?: boolean;
  sub?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between py-2.5 ${strong ? 'border-t border-gray-300 font-semibold text-gray-900' : 'text-gray-700'}`}>
      <div>
        <span className={strong ? 'text-base' : 'text-sm'}>{label}</span>
        {sub && <span className="ml-2 text-xs text-gray-500">{sub}</span>}
      </div>
      <span className={`tabular-nums ${strong ? 'text-base' : 'text-sm'} ${value < 0 && strong ? 'text-red-700' : ''}`}>
        {sign && value !== 0 ? `${sign} ` : ''}
        {formatRupiah(Math.abs(value) * (strong && value < 0 ? -1 : 1))}
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
      .catch((e) => !cancelled && setError(e?.response?.data?.detail ?? 'Gagal memuat laporan.'))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
  }, [authed, range.start, range.end]);

  const products = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const rows = q
      ? data.by_product.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      : data.by_product;
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
    });
  }, [data, sort, query]);

  const sortHeader = (key: SortKey, label: string, align: 'left' | 'right' = 'right') => (
    <th className={`px-5 py-2 font-medium text-${align}`} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="uppercase hover:text-gray-900"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'name' ? 1 : -1 }))}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  const loading = !error && loadedKey !== `${range.start}|${range.end}`;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan Laba Rugi</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data ? `${longDate(data.start_date)} – ${longDate(data.end_date)}` : 'Pendapatan, HPP, dan laba per periode.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            value={range}
            preset={preset}
            onChange={(r, p) => {
              setRange(r);
              setPreset(p);
            }}
          />
          <button
            type="button"
            disabled={!data}
            onClick={() => data && downloadCsv(data)}
            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-1.5" aria-hidden="true" /> Ekspor CSV
          </button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {!data && loading ? (
        <div className="text-gray-500 text-sm">Memuat…</div>
      ) : data ? (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Laporan */}
            <div className={`${card} p-5 xl:col-span-3`}>
              <h2 className="text-base font-semibold text-gray-900 mb-2">Ringkasan</h2>
              <StatementLine label="Pendapatan penjualan" value={data.revenue} sub={`${formatNumber(data.transaction_count)} transaksi · ${formatNumber(data.items_sold)} barang`} />
              <StatementLine label="Harga Pokok Penjualan (HPP)" value={data.cogs} sign="−" />
              <StatementLine label="Laba Kotor" value={data.gross_profit} strong sub={`margin ${formatPct(data.gross_margin_pct)}`} />
              <StatementLine label="Kehilangan / kerusakan stok" value={data.stock_loss} sign="−" />
              <StatementLine label="Kelebihan stok dari opname" value={data.stock_gain} sign="+" />
              <StatementLine label="Laba setelah selisih stok" value={data.profit_after_adjustment} strong />
              <p className="mt-4 flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <Info className="w-4 h-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
                Biaya operasional (gaji, listrik, sewa) belum dicatat di sistem, jadi angka ini belum laba bersih.
                Selisih stok dinilai dengan HPP produk saat ini.
              </p>
            </div>

            {/* Per kategori */}
            <div className={`${card} xl:col-span-2 overflow-hidden`}>
              <h2 className="px-5 py-4 border-b border-gray-200 text-base font-semibold text-gray-900">Per kategori</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium">Kategori</th>
                      <th className="px-5 py-2 text-right font-medium">Omzet</th>
                      <th className="px-5 py-2 text-right font-medium">Laba</th>
                      <th className="px-5 py-2 text-right font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 tabular-nums whitespace-nowrap">
                    {data.by_category.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">Belum ada penjualan.</td></tr>
                    ) : (
                      data.by_category.map((c) => (
                        <tr key={c.category}>
                          <td className="px-5 py-2.5 text-gray-900">{c.category}</td>
                          <td className="px-5 py-2.5 text-right text-gray-900">{formatRupiah(c.revenue)}</td>
                          <td className="px-5 py-2.5 text-right text-gray-900">{formatRupiah(c.gross_profit)}</td>
                          <td className="px-5 py-2.5 text-right text-gray-600">{formatPct(c.gross_margin_pct)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Per produk */}
          <div className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Per produk</h2>
              <input
                type="search"
                placeholder="Cari nama atau SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full sm:w-64 rounded-md border border-gray-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    {sortHeader('name', 'Produk', 'left')}
                    {sortHeader('quantity', 'Terjual')}
                    {sortHeader('revenue', 'Omzet')}
                    <th className="px-5 py-2 text-right font-medium uppercase">HPP</th>
                    {sortHeader('gross_profit', 'Laba Kotor')}
                    {sortHeader('gross_margin_pct', 'Margin')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 tabular-nums whitespace-nowrap">
                  {products.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Tidak ada data.</td></tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.product_id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5">
                          <div className="font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.sku} · {p.category}</div>
                        </td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{formatNumber(p.quantity)} {p.unit}</td>
                        <td className="px-5 py-2.5 text-right text-gray-900">{formatRupiah(p.revenue)}</td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{formatRupiah(p.cogs)}</td>
                        <td className={`px-5 py-2.5 text-right font-semibold ${p.gross_profit < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                          {formatRupiah(p.gross_profit)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-gray-600">{formatPct(p.gross_margin_pct)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
