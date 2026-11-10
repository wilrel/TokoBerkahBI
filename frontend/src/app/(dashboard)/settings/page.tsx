'use client';

import { useEffect, useState } from 'react';
import { errorMessage, getWorkspaces } from '@/lib/api';
import type { Workspace } from '@/lib/types';
import { canManageTeam, roleLabel } from '@/lib/roles';
import { useAuth } from '@/components/auth';
import TeamSection from '@/components/TeamSection';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { Page, PageHeader } from '@/components/ui/page';

export default function SettingsPage() {
  const { membership, role, user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getWorkspaces();
        if (!cancelled) setWorkspace(list.find((w) => w.id === membership?.workspace_id) ?? null);
      } catch (e) {
        if (!cancelled) setError(errorMessage(e, 'Gagal memuat data toko.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [membership?.workspace_id]);

  const rows: [string, string | null | undefined][] = [
    ['Nama toko', workspace?.name],
    ['Alamat', workspace?.address],
    ['Telepon', workspace?.phone],
    ['Zona waktu', workspace?.timezone],
  ];

  return (
    <Page size="narrow">
      <PageHeader title="Pengaturan" description="Profil toko, akun Anda, dan anggota tim" />
      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="space-y-6">
        {canManageTeam(role) && <TeamSection />}

        <Card>
          <CardHeader title="Profil toko" description="Dipakai di laporan dan struk" />
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
          <CardHeader title="Akun Anda" />
          <dl className="divide-y divide-line border-t border-line">
            {[
              ['Nama', user?.name],
              ['Email', user?.email],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm text-ink-subtle">{label}</dt>
                <dd className="text-sm text-ink sm:col-span-2">{value || <span className="text-ink-subtle">Belum diisi</span>}</dd>
              </div>
            ))}
            <div className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm text-ink-subtle">Peran di toko ini</dt>
              <dd className="sm:col-span-2">{role && <Badge tone="info">{roleLabel(role)}</Badge>}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </Page>
  );
}
