'use client';

import { PRESETS, PresetKey, DateRange, presetRange } from '@/lib/format';
import { cn } from '@/lib/cn';

type Props = {
  value: DateRange;
  preset: PresetKey | null;
  onChange: (range: DateRange, preset: PresetKey | null) => void;
};

const dateInput =
  'h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink shadow-sm num ' +
  'hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15';

export default function DateRangeFilter({ value, preset, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-9 items-center rounded-lg bg-zinc-100 p-0.5" role="group" aria-label="Pilih periode">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(presetRange(p.key), p.key)}
            aria-pressed={preset === p.key}
            className={cn(
              'h-8 rounded-md px-2.5 text-sm whitespace-nowrap transition-colors',
              preset === p.key ? 'bg-white font-medium text-ink shadow-[var(--shadow-card)]' : 'text-ink-muted hover:text-ink',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label="Tanggal mulai"
          value={value.start}
          max={value.end}
          onChange={(e) => e.target.value && onChange({ ...value, start: e.target.value }, null)}
          className={dateInput}
        />
        <span className="text-ink-subtle" aria-hidden="true">
          –
        </span>
        <input
          type="date"
          aria-label="Tanggal akhir"
          value={value.end}
          min={value.start}
          onChange={(e) => e.target.value && onChange({ ...value, end: e.target.value }, null)}
          className={dateInput}
        />
      </div>
    </div>
  );
}
