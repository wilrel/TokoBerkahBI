export const formatRupiah = (value: number) =>
  `Rp ${Math.round(value).toLocaleString('id-ID')}`;

/** Ringkas untuk sumbu grafik: 1,2 jt / 350 rb. */
export const formatRupiahShort = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return `${Math.round(value)}`;
};

export const formatPct = (value: number) =>
  `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

export const formatNumber = (value: number) => value.toLocaleString('id-ID');

/** YYYY-MM-DD dalam waktu lokal browser (bukan UTC). */
export const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDateLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', opts);

export type DateRange = { start: string; end: string };

export type PresetKey = 'today' | '7d' | '30d' | 'month' | 'lastMonth';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hari ini' },
  { key: '7d', label: '7 hari' },
  { key: '30d', label: '30 hari' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'lastMonth', label: 'Bulan lalu' },
];

export const presetRange = (key: PresetKey, now = new Date()): DateRange => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  switch (key) {
    case 'today':
      return { start: toISODate(today), end: toISODate(today) };
    case '7d':
      return { start: toISODate(daysAgo(6)), end: toISODate(today) };
    case '30d':
      return { start: toISODate(daysAgo(29)), end: toISODate(today) };
    case 'month':
      return { start: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), end: toISODate(today) };
    case 'lastMonth':
      return {
        start: toISODate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        end: toISODate(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
  }
};

export const paymentLabel = (method: string) =>
  ({ CASH: 'Tunai', QRIS: 'QRIS', TRANSFER: 'Transfer', DEBIT: 'Debit', CREDIT: 'Kredit' } as Record<string, string>)[method] ?? method;
