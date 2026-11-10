'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { control } from '@/components/ui/field';
import { cn } from '@/lib/cn';

/** Kerangka halaman masuk/daftar: logo, judul, dan kartu form di tengah layar. */
export function AuthCard({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold tracking-tight text-white shadow-sm">TB</div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-subtle">{description}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">{children}</div>
        <p className="mt-6 text-center text-sm text-ink-subtle">{footer}</p>
      </div>
    </div>
  );
}

/** Input password dengan tombol tampilkan/sembunyikan. */
export function PasswordInput(props: ComponentProps<'input'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={cn(control, 'h-9 pr-10 pl-3', props.className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-subtle hover:text-ink"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
