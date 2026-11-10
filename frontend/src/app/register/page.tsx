'use client';

import Link from 'next/link';
import { useState } from 'react';
import { errorMessage, register } from '@/lib/api';
import { AuthCard, PasswordInput } from '@/components/AuthCard';
import { useAuth } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';

export default function RegisterPage() {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: '', store_name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ ...form, name: form.name.trim(), store_name: form.store_name.trim() });
      await refresh();
    } catch (err) {
      setError(errorMessage(err, 'Gagal mendaftar.'));
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Daftarkan toko Anda"
      description="Satu menit untuk mulai. Anda otomatis menjadi pemilik (Owner) toko."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Nama Anda" htmlFor="name">
          <Input id="name" autoComplete="name" required autoFocus value={form.name} onChange={set('name')} placeholder="Sari Wulandari" />
        </Field>
        <Field label="Nama toko" htmlFor="store">
          <Input id="store" autoComplete="organization" required value={form.store_name} onChange={set('store_name')} placeholder="Toko Berkah Jaya" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={set('email')}
            placeholder="nama@email.com"
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="Minimal 6 karakter.">
          <PasswordInput id="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={set('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Buat akun dan toko
        </Button>
      </form>
    </AuthCard>
  );
}
