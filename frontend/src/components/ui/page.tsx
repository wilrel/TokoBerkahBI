import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Kontainer konten halaman dengan lebar dan padding yang seragam. */
export function Page({ className, children, size = 'wide' }: { className?: string; children: ReactNode; size?: 'wide' | 'narrow' }) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8', size === 'wide' ? 'max-w-7xl' : 'max-w-4xl', className)}>
      {children}
    </div>
  );
}

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
};

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-sm text-ink-subtle">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
