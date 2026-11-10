import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';
import { formatPct } from '@/lib/format';
import { cn } from '@/lib/cn';

type Props = {
  label: string;
  value: ReactNode;
  /** Persentase perubahan vs periode sebelumnya. null = tidak ada pembanding. */
  change?: number | null;
  footnote?: ReactNode;
  loading?: boolean;
};

export default function StatTile({ label, value, change, footnote, loading }: Props) {
  const up = change != null && change > 0;
  const down = change != null && change < 0;

  return (
    <Card className="p-5">
      <p className="text-sm text-ink-subtle">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-7 w-36" />
          <Skeleton className="mt-3 h-4 w-28" />
        </>
      ) : (
        <>
          <p className="num mt-2 text-[26px] leading-8 font-semibold tracking-tight text-ink">{value}</p>
          <div className="mt-2 flex min-h-5 items-center gap-2 text-xs text-ink-subtle">
            {change !== undefined &&
              (change == null ? (
                <span>Belum ada data pembanding</span>
              ) : (
                <>
                  <span
                    className={cn(
                      'num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
                      up && 'bg-emerald-50 text-emerald-700',
                      down && 'bg-red-50 text-red-700',
                      !up && !down && 'bg-zinc-100 text-ink-muted',
                    )}
                  >
                    {up && <ArrowUpRight className="size-3" aria-hidden="true" />}
                    {down && <ArrowDownRight className="size-3" aria-hidden="true" />}
                    {up ? '+' : ''}
                    {formatPct(change)}
                  </span>
                  <span>dari periode sebelumnya</span>
                </>
              ))}
            {footnote}
          </div>
        </>
      )}
    </Card>
  );
}
