'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileUp, Plus } from 'lucide-react';
import { errorMessage, getImports, initAuth } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import type { ImportJob } from '@/lib/types';
import { Badge, type Tone } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

const STATUS: Record<ImportJob['status'], { label: string; tone: Tone }> = {
  PENDING: { label: 'Menunggu', tone: 'neutral' },
  VALIDATING: { label: 'Divalidasi', tone: 'info' },
  CONFIRMED: { label: 'Dikonfirmasi', tone: 'info' },
  PROCESSING: { label: 'Diproses', tone: 'info' },
  COMPLETED: { label: 'Selesai', tone: 'success' },
  FAILED: { label: 'Gagal', tone: 'danger' },
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ImportsPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        const data = await getImports();
        if (!cancelled) setJobs(data);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, 'Gagal memuat riwayat import.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page>
      <PageHeader
        title="Import data"
        description="Masukkan riwayat penjualan dari file CSV atau Excel"
        actions={
          <LinkButton href="/imports/new">
            <Plus /> Import baru
          </LinkButton>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={FileUp}
            title="Belum ada import"
            description="Unggah file transaksi dari aplikasi kasir lama atau catatan Excel Anda."
            action={
              <LinkButton href="/imports/new">
                <Plus /> Import baru
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <THead className="border-t-0">
              <tr>
                <TH>File</TH>
                <TH>Diunggah</TH>
                <TH>Status</TH>
                <TH align="right">Baris diimpor</TH>
                <TH align="right">Error</TH>
              </tr>
            </THead>
            <TBody>
              {jobs.map((job) => (
                <TR key={job.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                      <span className="max-w-xs truncate font-medium">{job.filename}</span>
                    </div>
                  </TD>
                  <TD className="num text-ink-muted">{formatDateTime(job.created_at)}</TD>
                  <TD>
                    <Badge tone={STATUS[job.status]?.tone ?? 'neutral'} dot>
                      {STATUS[job.status]?.label ?? job.status}
                    </Badge>
                  </TD>
                  <TD align="right">
                    {formatNumber(job.imported_rows)} <span className="text-ink-subtle">/ {formatNumber(job.total_rows)}</span>
                  </TD>
                  <TD align="right" className={job.error_rows > 0 ? 'text-red-700' : 'text-ink-subtle'}>
                    {formatNumber(job.error_rows)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </Page>
  );
}
