'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, LockKeyhole, Store } from 'lucide-react';
import { createWorkspace, errorMessage } from '@/lib/api';
import { canAccess, homeFor } from '@/lib/roles';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/components/auth';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Alert, EmptyState } from '@/components/ui/feedback';

const PUBLIC_PATHS = ['/login', '/register'];

function FullScreenLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="size-5 animate-spin text-ink-subtle" aria-label="Memuat" />
    </div>
  );
}

/** Akun yang belum tergabung di toko mana pun: buat toko sendiri atau tunggu diundang. */
function NoStore() {
  const { user, refresh, logout } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createWorkspace(name.trim());
      await refresh();
    } catch (err) {
      setError(errorMessage(err, 'Gagal membuat toko.'));
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6">
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-line bg-zinc-50">
          <Store className="size-5 text-ink-subtle" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Belum ada toko</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          Akun {user?.email} belum tergabung di toko mana pun. Jika Anda karyawan, minta pemilik toko menambahkan email ini. Jika Anda pemilik,
          buat toko Anda di bawah.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Nama toko" htmlFor="store">
            <Input id="store" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Toko Berkah Jaya" />
          </Field>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={logout}>
              Keluar
            </Button>
            <Button type="submit" loading={saving}>
              Buat toko
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { status, membership, role } = useAuth();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  // Kasir yang membuka beranda langsung diarahkan ke halaman Kasir.
  const redirectTo =
    !isPublic && status === 'anonymous'
      ? '/login'
      : isPublic && status === 'ready'
        ? homeFor(role)
        : status === 'ready' && pathname === '/' && role === 'CASHIER'
          ? homeFor(role)
          : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (isPublic) {
    return <main className="flex-1 overflow-y-auto">{status === 'ready' ? <FullScreenLoader /> : children}</main>;
  }
  if (status !== 'ready' || redirectTo) return <FullScreenLoader />;
  if (!membership) return <NoStore />;

  return (
    <>
      <Sidebar />
      <main key={membership.workspace_id} className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        {canAccess(role, pathname) ? (
          children
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <Card className="w-full max-w-md">
              <EmptyState
                icon={LockKeyhole}
                title="Halaman ini tidak tersedia untuk peran Anda"
                description="Minta Owner atau Admin toko jika Anda butuh akses."
                action={<LinkButton href={homeFor(role)}>Kembali</LinkButton>}
              />
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
