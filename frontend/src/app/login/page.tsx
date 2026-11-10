'use client';

import Link from 'next/link';
import { useState } from 'react';
import { errorMessage, login } from '@/lib/api';
import { AuthCard, PasswordInput } from '@/components/AuthCard';
import { useAuth } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';

export default function LoginPage() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      // AppShell mengarahkan ke halaman awal sesuai peran setelah sesi siap.
      await refresh();
    } catch (err) {
      setError(errorMessage(err, 'Gagal masuk.'));
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Masuk ke Toko Berkah"
      description="Gunakan email dan password yang diberikan pemilik toko."
      footer={
        <>
          Pemilik toko dan belum punya akun?{' '}
          <Link href="/register" className="font-medium text-accent hover:text-accent-hover">
            Daftar gratis
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@email.com"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Masuk
        </Button>
      </form>
    </AuthCard>
  );
}
