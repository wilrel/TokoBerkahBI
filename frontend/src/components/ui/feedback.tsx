import { AlertCircle, Info } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type EmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 text-center', className ?? 'py-14')}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-surface shadow-sm">
        <Icon className="size-5 text-ink-subtle" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-subtle">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-zinc-200/70', className)} aria-hidden="true" />;
}

export function Alert({ tone = 'danger', children, className }: { tone?: 'danger' | 'info'; children: ReactNode; className?: string }) {
  const Icon = tone === 'danger' ? AlertCircle : Info;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
        tone === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : 'border-line bg-zinc-50 text-ink-muted',
        className,
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone === 'danger' ? 'text-red-600' : 'text-ink-subtle')} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
