'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, PackageCheck, ReceiptText } from 'lucide-react';
import { errorMessage, getDashboard, initAuth } from '@/lib/api';
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
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

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
  top_products: {
    product_id: number;
    name: string;
    sku: string;
    unit: string;
    quantity: number;
    revenue: number;
    gross_profit: number;
    gross_margin_pct: number;
  }[];
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

const longDate = (iso: string) => formatDateLabel(iso, { day: 'numeric', month: 'short', year: 'numeric' });

export default function DashboardPage() {
  const [preset, setPreset] = useState<PresetKey | null>('30d');
  const [range, setRange] = useState<DateRange>(() => presetRange('30d'));
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  // Range yang terakhir selesai dimuat; loading = range sekarang belum selesai.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

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
      .catch((e) => !cancelled && setError(errorMessage(e, 'Gagal memuat dashboard.')))
      .finally(() => !cancelled && setLoadedKey(key));
    return () => {
      cancelled = true;
    };
  }, [authed, range.start, range.end]);

  const loading = !error && loadedKey !== `${range.start}|${range.end}`;
  const initial = !data && loading;
  const s = data?.summary;
  const payTotal = data?.payment_methods.reduce((a, p) => a + p.amount, 0) ?? 0;

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        description={data ? `Toko Berkah Jaya · ${longDate(data.start_date)} – ${longDate(data.end_date)}` : 'Ringkasan penjualan dan stok toko'}
        actions={
          <DateRangeFilter
            value={range}
            preset={preset}
            onChange={(r, p) => {
              setRange(r);
              setPreset(p);
            }}
          />
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      <div className={`space-y-6 transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile loading={initial} label="Omzet" value={s && formatRupiah(s.revenue)} change={data?.change_pct.revenue} />
          <StatTile
            loading={initial}
            label="Laba kotor"
            value={s && formatRupiah(s.gross_profit)}
            change={data?.change_pct.gross_profit}
          />
          <StatTile
            loading={initial}
            label="Transaksi"
            value={s && formatNumber(s.transaction_count)}
            change={data?.change_pct.transaction_count}
          />
          <StatTile
            loading={initial}
            label="Rata-rata belanja"
            value={s && formatRupiah(s.avg_basket)}
            change={data?.change_pct.avg_basket}
          />
        </div>

        {initial ? (
          <Card className="p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 h-60 w-full" />
          </Card>
        ) : (
          data && <DailyBarChart data={data.daily} />
        )}

        {data && s && (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="overflow-hidden xl:col-span-2">
                <CardHeader
                  title="Produk terlaris"
                  description="Diurutkan berdasarkan omzet"
                  action={
                    <LinkButton href="/reports/profit-loss" variant="ghost" size="sm">
                      Laporan lengkap <ArrowRight />
                    </LinkButton>
                  }
                />
                {data.top_products.length === 0 ? (
                  <EmptyState icon={ReceiptText} title="Belum ada penjualan" description="Transaksi di periode ini akan muncul di sini." />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Produk</TH>
                        <TH align="right">Terjual</TH>
                        <TH align="right">Omzet</TH>
                        <TH align="right">Laba kotor</TH>
                        <TH align="right">Margin</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {data.top_products.map((p, i) => (
                        <TR key={p.product_id}>
                          <TD>
                            <div className="flex items-center gap-3">
                              <span className="num w-4 text-xs text-ink-subtle">{i + 1}</span>
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="text-xs text-ink-subtle">{p.sku}</div>
                              </div>
                            </div>
                          </TD>
                          <TD align="right" className="text-ink-muted">
                            {formatNumber(p.quantity)} {p.unit}
                          </TD>
                          <TD align="right">{formatRupiah(p.revenue)}</TD>
                          <TD align="right">{formatRupiah(p.gross_profit)}</TD>
                          <TD align="right" className="text-ink-muted">
                            {formatPct(p.gross_margin_pct)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Card>

              <Card>
                <CardHeader title="Metode pembayaran" description={`Margin kotor periode ini ${formatPct(s.gross_margin_pct)}`} />
                <div className="px-5 pb-5">
                  {data.payment_methods.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-subtle">Belum ada transaksi.</p>
                  ) : (
                    <ul className="space-y-4">
                      {data.payment_methods.map((p) => {
                        const share = payTotal ? (p.amount / payTotal) * 100 : 0;
                        return (
                          <li key={p.method}>
                            <div className="flex items-baseline justify-between text-sm">
                              <span className="font-medium text-ink">{paymentLabel(p.method)}</span>
                              <span className="num text-ink-muted">{formatPct(share)}</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                            </div>
                            <p className="num mt-1.5 text-xs text-ink-subtle">
                              {formatRupiah(p.amount)} · {formatNumber(p.transaction_count)} transaksi
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="overflow-hidden xl:col-span-2">
                <CardHeader
                  title="Perlu restock"
                  description={`${formatNumber(data.inventory.low_stock_count)} produk dengan stok ${data.inventory.low_stock_threshold} atau kurang`}
                  action={
                    <LinkButton href="/purchases/new" variant="secondary" size="sm">
                      Catat pembelian
                    </LinkButton>
                  }
                />
                {data.inventory.low_stock.length === 0 ? (
                  <EmptyState icon={PackageCheck} title="Semua stok aman" description="Tidak ada produk yang perlu di-restock." />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Produk</TH>
                        <TH align="right">Sisa stok</TH>
                        <TH align="right">Status</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {data.inventory.low_stock.map((p) => (
                        <TR key={p.product_id}>
                          <TD>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-ink-subtle">{p.sku}</div>
                          </TD>
                          <TD align="right">
                            {formatNumber(p.current_stock)} {p.unit}
                          </TD>
                          <TD align="right">
                            {p.current_stock <= 0 ? (
                              <Badge tone="danger" dot>
                                Habis
                              </Badge>
                            ) : (
                              <Badge tone="warning" dot>
                                Menipis
                              </Badge>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Card>

              <Card>
                <CardHeader title="Nilai persediaan" description="Kondisi stok saat ini" />
                <dl className="divide-y divide-line border-t border-line">
                  {[
                    ['Nilai modal', formatRupiah(data.inventory.stock_value_at_cost)],
                    ['Nilai jual', formatRupiah(data.inventory.stock_value_at_price)],
                    ['Potensi laba', formatRupiah(data.inventory.stock_value_at_price - data.inventory.stock_value_at_cost)],
                    ['Produk aktif', formatNumber(data.inventory.active_products)],
                    ['Tidak terjual periode ini', formatNumber(data.inventory.unsold_in_period_count)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-5 py-3 text-sm">
                      <dt className="text-ink-subtle">{k}</dt>
                      <dd className="num font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
