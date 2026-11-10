'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Boxes } from 'lucide-react';
import { getDashboard, initAuth } from '@/lib/api';
import {
  DateRange,
  PresetKey,
  formatDateLabel,
  formatNumber,
  formatPct,
  formatRupiah,
  paymentLabel,
  presetRange,
} from '@/lib/format';
import DateRangeFilter from '@/components/reports/DateRangeFilter';
import StatTile from '@/components/reports/StatTile';
import DailyBarChart, { DailyPoint } from '@/components/reports/DailyBarChart';

type Summary = {
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  transaction_count: number;
  items_sold: number;
  avg_basket: number;
};

type Dashboard = {
  start_date: string;
  end_date: string;
  summary: Summary;
  change_pct: Record<'revenue' | 'gross_profit' | 'transaction_count' | 'avg_basket', number | null>;
  daily: DailyPoint[];
  payment_methods: { method: string; amount: number; transaction_count: number }[];
  top_products: { product_id: number; name: string; unit: string; quantity: number; revenue: number; gross_profit: number; gross_margin_pct: number }[];
  inventory: {
    active_products: number;
    stock_value_at_cost: number;
    stock_value_at_price: number;
    low_stock_threshold: number;
    low_stock_count: number;
    low_stock: { product_id: number; sku: string; name: string; unit: string; current_stock: number }[];
    unsold_in_period_count: number;
  };
};

const card = 'bg-white rounded-lg shadow border border-gray-200';

export default function DashboardPage() {
  const [preset, setPreset] = useState<PresetKey | null>('30d');
  const [range, setRange] = useState<DateRange>(() => presetRange('30d'));
  const [data, setData] = useState<Dashboard | null>(null);
  // Range yang terakhir selesai dimuat; loading = range sekarang belum selesai.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    initAuth().then((ok) => (ok ? setAuthed(true) : setError('Tidak bisa login ke server API. Pastikan backend berjalan.')));
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    const key = `${range.start}|${range.end}`;
    getDashboard(range.start, range.end)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e?.response?.data?.detail ?? 'Gagal memuat dashboard.'))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
  }, [authed, range.start, range.end]);

  const s = data?.summary;
  const payTotal = data?.payment_methods.reduce((a, p) => a + p.amount, 0) ?? 0;

  const loading = !error && loadedKey !== `${range.start}|${range.end}`;

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data
              ? `${formatDateLabel(data.start_date, { day: 'numeric', month: 'long', year: 'numeric' })} – ${formatDateLabel(data.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'Ringkasan penjualan dan stok toko.'}
          </p>
        </div>
        <DateRangeFilter
          value={range}
          preset={preset}
          onChange={(r, p) => {
            setRange(r);
            setPreset(p);
          }}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {!data && loading ? (
        <div className="text-gray-500 text-sm">Memuat…</div>
      ) : data && s ? (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatTile label="Omzet" value={formatRupiah(s.revenue)} change={data.change_pct.revenue} />
            <StatTile
              label={`Laba Kotor · margin ${formatPct(s.gross_margin_pct)}`}
              value={formatRupiah(s.gross_profit)}
              change={data.change_pct.gross_profit}
            />
            <StatTile label="Jumlah Transaksi" value={formatNumber(s.transaction_count)} change={data.change_pct.transaction_count} />
            <StatTile label="Rata-rata Belanja" value={formatRupiah(s.avg_basket)} change={data.change_pct.avg_basket} />
          </div>

          <DailyBarChart data={data.daily} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Produk terlaris */}
            <div className={`${card} xl:col-span-2 overflow-hidden`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h2 className="text-base font-semibold text-gray-900">Produk terlaris</h2>
                <Link href="/reports/profit-loss" className="text-sm text-indigo-600 hover:text-indigo-700 inline-flex items-center">
                  Laporan laba rugi <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium">Produk</th>
                      <th className="px-5 py-2 text-right font-medium">Terjual</th>
                      <th className="px-5 py-2 text-right font-medium">Omzet</th>
                      <th className="px-5 py-2 text-right font-medium">Laba Kotor</th>
                      <th className="px-5 py-2 text-right font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 tabular-nums whitespace-nowrap">
                    {data.top_products.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-gray-500">Belum ada penjualan di periode ini.</td>
                      </tr>
                    ) : (
                      data.top_products.map((p) => (
                        <tr key={p.product_id}>
                          <td className="px-5 py-2.5 font-medium text-gray-900">{p.name}</td>
                          <td className="px-5 py-2.5 text-right text-gray-600">{formatNumber(p.quantity)} {p.unit}</td>
                          <td className="px-5 py-2.5 text-right text-gray-900">{formatRupiah(p.revenue)}</td>
                          <td className="px-5 py-2.5 text-right text-gray-900">{formatRupiah(p.gross_profit)}</td>
                          <td className="px-5 py-2.5 text-right text-gray-600">{formatPct(p.gross_margin_pct)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Metode pembayaran */}
            <div className={`${card} p-5`}>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Metode pembayaran</h2>
              {data.payment_methods.length === 0 ? (
                <p className="text-sm text-gray-500">Belum ada transaksi.</p>
              ) : (
                <ul className="space-y-3">
                  {data.payment_methods.map((p) => {
                    const share = payTotal ? (p.amount / payTotal) * 100 : 0;
                    return (
                      <li key={p.method}>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">{paymentLabel(p.method)}</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{formatPct(share)}</span>
                        </div>
                        <div className="mt-1 h-2 rounded bg-gray-100" aria-hidden="true">
                          <div className="h-2 rounded bg-indigo-600" style={{ width: `${share}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 tabular-nums">
                          {formatRupiah(p.amount)} · {formatNumber(p.transaction_count)} transaksi
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Nilai stok */}
            <div className={`${card} p-5 space-y-4`}>
              <h2 className="text-base font-semibold text-gray-900 flex items-center">
                <Boxes className="w-5 h-5 mr-2 text-gray-400" aria-hidden="true" /> Stok saat ini
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nilai stok (harga modal)</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">{formatRupiah(data.inventory.stock_value_at_cost)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nilai stok (harga jual)</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">{formatRupiah(data.inventory.stock_value_at_price)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Produk aktif</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">{formatNumber(data.inventory.active_products)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Tidak terjual di periode ini</dt>
                  <dd className="font-semibold text-gray-900 tabular-nums">{formatNumber(data.inventory.unsold_in_period_count)}</dd>
                </div>
              </dl>
            </div>

            {/* Stok menipis */}
            <div className={`${card} xl:col-span-2 overflow-hidden`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h2 className="text-base font-semibold text-gray-900 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" aria-hidden="true" />
                  Stok menipis
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({formatNumber(data.inventory.low_stock_count)} produk, stok ≤ {data.inventory.low_stock_threshold})
                  </span>
                </h2>
                <Link href="/purchases/new" className="text-sm text-indigo-600 hover:text-indigo-700 inline-flex items-center">
                  Restock <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              {data.inventory.low_stock.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500">Semua stok aman.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.inventory.low_stock.map((p) => (
                    <li key={p.product_id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                      <span>
                        <span className="font-medium text-gray-900">{p.name}</span>
                        <span className="ml-2 text-xs text-gray-500">{p.sku}</span>
                      </span>
                      <span className={`font-semibold tabular-nums ${p.current_stock <= 0 ? 'text-red-700' : 'text-amber-700'}`}>
                        {p.current_stock <= 0 ? 'Habis' : `${formatNumber(p.current_stock)} ${p.unit}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
