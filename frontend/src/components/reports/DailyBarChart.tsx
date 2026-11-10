'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { formatDateLabel, formatNumber, formatRupiah, formatRupiahShort } from '@/lib/format';

export type DailyPoint = {
  date: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  transaction_count: number;
};

type Metric = 'revenue' | 'gross_profit';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'revenue', label: 'Omzet' },
  { key: 'gross_profit', label: 'Laba Kotor' },
];

// Satu seri -> satu hue (indigo-600, lolos validator kontras & chroma).
const BAR_COLOR = '#4f46e5';
const HEIGHT = 260;
const PAD = { top: 12, right: 8, bottom: 28, left: 56 };
const GAP = 2;

/** Batas sumbu "bulat" supaya gridline mudah dibaca. */
function niceMax(v: number) {
  if (v <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Bar dengan ujung data membulat 4px, pangkal rata di baseline. */
function barPath(x: number, y0: number, y1: number, w: number) {
  const h = Math.abs(y1 - y0);
  const r = Math.min(4, w / 2, h);
  if (h < 0.5) return '';
  if (y1 < y0) {
    // ke atas
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  // ke bawah (nilai negatif)
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

export default function DailyBarChart({ data }: { data: DailyPoint[] }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const { yMin, yMax, ticks } = useMemo(() => {
    const vals = data.map((d) => d[metric]);
    const hi = niceMax(Math.max(0, ...vals));
    const lo = -niceMax(-Math.min(0, ...vals));
    const max = hi === 0 && lo === 0 ? 1 : hi;
    const span = max - lo;
    const t = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * span);
    return { yMin: lo, yMax: max, ticks: t };
  }, [data, metric]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? innerW / data.length : innerW;
  const barW = Math.max(1, Math.min(48, band - GAP));
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * innerH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56))));
  const hovered = hover != null ? data[hover] : null;
  const metricLabel = METRICS.find((m) => m.key === metric)!.label;
  const total = data.reduce((a, d) => a + d[metric], 0);

  return (
    <Card className="p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{metricLabel} harian</h2>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Total <span className="num font-medium text-ink">{formatRupiah(total)}</span> dalam {data.length} hari
          </p>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex h-8 items-center rounded-lg bg-zinc-100 p-0.5" role="group" aria-label="Metrik">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={`h-7 rounded-md px-2.5 text-xs transition-colors ${metric === m.key ? 'bg-white font-medium text-ink shadow-[var(--shadow-card)]' : 'text-ink-muted hover:text-ink'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="inline-flex h-8 items-center rounded-lg bg-zinc-100 p-0.5" role="group" aria-label="Tampilan">
            {(['chart', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`h-7 rounded-md px-2.5 text-xs transition-colors ${view === v ? 'bg-white font-medium text-ink shadow-[var(--shadow-card)]' : 'text-ink-muted hover:text-ink'}`}
              >
                {v === 'chart' ? 'Grafik' : 'Tabel'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'table' ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 border-b border-line bg-surface text-xs text-ink-subtle">
              <tr>
                <th className="py-2 text-left font-medium">Tanggal</th>
                <th className="py-2 text-right font-medium">Omzet</th>
                <th className="py-2 text-right font-medium">HPP</th>
                <th className="py-2 text-right font-medium">Laba Kotor</th>
                <th className="py-2 text-right font-medium">Transaksi</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-line whitespace-nowrap">
              {data.map((d) => (
                <tr key={d.date}>
                  <td className="py-2 text-ink-muted">{formatDateLabel(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="py-2 text-right text-ink">{formatRupiah(d.revenue)}</td>
                  <td className="py-2 text-right text-ink-subtle">{formatRupiah(d.cogs)}</td>
                  <td className="py-2 text-right text-ink">{formatRupiah(d.gross_profit)}</td>
                  <td className="py-2 text-right text-ink-subtle">{formatNumber(d.transaction_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="relative" onPointerLeave={() => setHover(null)}>
          <svg width={width} height={HEIGHT} role="img" aria-label={`Grafik batang ${metricLabel.toLowerCase()} per hari`}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? '#d4d4d8' : '#f0f0f2'}
                  strokeWidth={1}
                />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500" fontSize={11}>
                  {formatRupiahShort(t)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x = PAD.left + i * band + (band - barW) / 2;
              const v = d[metric];
              return (
                <g key={d.date}>
                  <path
                    d={barPath(x, y(0), y(v), barW)}
                    fill={BAR_COLOR}
                    opacity={hover == null || hover === i ? 1 : 0.45}
                  />
                  {/* Area hover selebar kolom, lebih besar dari batangnya */}
                  <rect
                    x={PAD.left + i * band}
                    y={PAD.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${formatDateLabel(d.date)}: ${metricLabel} ${formatRupiah(v)}`}
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="outline-none"
                  />
                  {i % labelEvery === 0 && (
                    <text
                      x={PAD.left + i * band + band / 2}
                      y={HEIGHT - 8}
                      textAnchor="middle"
                      className="fill-zinc-500"
                      fontSize={11}
                    >
                      {formatDateLabel(d.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {hovered && hover != null && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-[var(--shadow-pop)]"
              style={{
                left: Math.min(Math.max(PAD.left + hover * band + band / 2 - 90, 0), width - 180),
                top: 0,
                width: 180,
              }}
            >
              <p className="font-medium text-ink mb-1">
                {formatDateLabel(hovered.date, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <dl className="space-y-0.5 tabular-nums">
                {[
                  ['Omzet', formatRupiah(hovered.revenue)],
                  ['HPP', formatRupiah(hovered.cogs)],
                  ['Laba kotor', formatRupiah(hovered.gross_profit)],
                  ['Transaksi', formatNumber(hovered.transaction_count)],
                ].map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-ink-subtle">{k}</dt>
                    <dd className="font-semibold text-ink">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
