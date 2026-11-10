'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Plus } from 'lucide-react';
import { errorMessage, getPurchases, initAuth } from '@/lib/api';
import { formatNumber, formatRupiah } from '@/lib/format';
import type { Purchase } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        const data = await getPurchases();
        if (!cancelled) setPurchases(data);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, 'Gagal memuat riwayat pembelian.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(() => purchases.reduce((a, p) => a + p.total_amount, 0), [purchases]);

  return (
    <Page>
      <PageHeader
        title="Pembelian"
        description={
          loading ? 'Riwayat barang masuk dari supplier' : `${formatNumber(purchases.length)} pembelian · total ${formatRupiah(total)}`
        }
        actions={
          <LinkButton href="/purchases/new">
            <Plus /> Catat pembelian
          </LinkButton>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={ArrowDownToLine}
            title="Belum ada pembelian"
            description="Catat barang masuk dari supplier agar stok dan HPP selalu akurat."
            action={
              <LinkButton href="/purchases/new">
                <Plus /> Catat pembelian
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <THead className="border-t-0">
              <tr>
                <TH>Tanggal</TH>
                <TH>Supplier</TH>
                <TH>Barang</TH>
                <TH align="right">Total</TH>
              </tr>
            </THead>
            <TBody>
              {purchases.map((p) => {
                const names = p.items.map((i) => i.product?.name).filter(Boolean) as string[];
                return (
                  <TR key={p.id}>
                    <TD className="num text-ink-muted">{formatDateTime(p.timestamp)}</TD>
                    <TD className="font-medium">{p.supplier_name || <span className="font-normal text-ink-subtle">Tanpa nama</span>}</TD>
                    <TD className="max-w-xs">
                      <div className="truncate text-ink-muted" title={names.join(', ')}>
                        {names.length ? names.join(', ') : `${p.items.length} barang`}
                      </div>
                      <div className="text-xs text-ink-subtle">{formatNumber(p.items.length)} jenis barang</div>
                    </TD>
                    <TD align="right" className="font-medium">
                      {formatRupiah(p.total_amount)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </Page>
  );
}
