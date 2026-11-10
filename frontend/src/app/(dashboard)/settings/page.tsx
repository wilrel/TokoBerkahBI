'use client';

import { useEffect, useState } from 'react';
import { errorMessage, getWorkspaces, initAuth } from '@/lib/api';
import type { Workspace } from '@/lib/types';
import { Card, CardHeader } from '@/components/ui/card';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initAuth();
        const list = await getWorkspaces();
        if (!cancelled) setWorkspace(list[0] ?? null);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, 'Gagal memuat data toko.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: [string, string | null | undefined][] = [
    ['Nama toko', workspace?.name],
    ['Alamat', workspace?.address],
    ['Telepon', workspace?.phone],
    ['Mata uang', workspace?.currency],
    ['Zona waktu', workspace?.timezone],
  ];

  return (
    <Page size="narrow">
      <PageHeader title="Pengaturan" description="Profil toko dan preferensi" />
      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Profil toko"
            description="Dipakai di laporan dan struk"
            action={<Badge>Hanya baca</Badge>}
          />
          <dl className="divide-y divide-line border-t border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm text-ink-subtle">{label}</dt>
                <dd className="text-sm text-ink sm:col-span-2">
                  {loading ? <Skeleton className="h-5 w-48" /> : value || <span className="text-ink-subtle">Belum diisi</span>}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Anggota tim" description="Atur siapa saja yang bisa mengakses toko dan perannya" />
          <p className="border-t border-line px-5 py-4 text-sm text-ink-subtle">
            Pengelolaan anggota tim (Owner, Admin, Manager, Kasir) akan tersedia di pembaruan berikutnya.
          </p>
        </Card>
      </div>
    </Page>
  );
}
