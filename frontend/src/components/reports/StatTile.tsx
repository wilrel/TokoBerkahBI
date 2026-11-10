import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatPct } from '@/lib/format';

type Props = {
  label: string;
  value: string;
  /** Persentase perubahan vs periode sebelumnya. null = tidak ada pembanding. */
  change?: number | null;
  hint?: string;
};

export default function StatTile({ label, value, change, hint }: Props) {
  const hasChange = change !== undefined;
  const up = change != null && change > 0;
  const down = change != null && change < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 min-h-4">
        {hasChange && (
          <span
            className={`inline-flex items-center font-medium ${
              up ? 'text-emerald-700' : down ? 'text-red-700' : 'text-gray-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {change == null ? 'Tidak ada pembanding' : `${up ? '+' : ''}${formatPct(change)}`}
          </span>
        )}
        {hasChange && change != null && <span>vs periode sebelumnya</span>}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
