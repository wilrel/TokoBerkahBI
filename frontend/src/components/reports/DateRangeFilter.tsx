'use client';

import { PRESETS, PresetKey, DateRange, presetRange } from '@/lib/format';

type Props = {
  value: DateRange;
  preset: PresetKey | null;
  onChange: (range: DateRange, preset: PresetKey | null) => void;
};

export default function DateRangeFilter({ value, preset, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5" role="group" aria-label="Pilih periode">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(presetRange(p.key), p.key)}
            aria-pressed={preset === p.key}
            className={`px-3 py-1.5 text-sm rounded transition ${
              preset === p.key ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <input
          type="date"
          aria-label="Tanggal mulai"
          value={value.start}
          max={value.end}
          onChange={(e) => e.target.value && onChange({ ...value, start: e.target.value }, null)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-gray-900"
        />
        <span>–</span>
        <input
          type="date"
          aria-label="Tanggal akhir"
          value={value.end}
          min={value.start}
          onChange={(e) => e.target.value && onChange({ ...value, end: e.target.value }, null)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-gray-900"
        />
      </div>
    </div>
  );
}
