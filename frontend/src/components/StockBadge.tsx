import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/format';

export const LOW_STOCK = 5;

/** Stok dengan status: habis (merah), menipis (kuning), aman (netral). */
export function StockBadge({ stock, unit }: { stock: number; unit: string }) {
  if (stock <= 0)
    return (
      <Badge tone="danger" dot>
        Habis
      </Badge>
    );
  return (
    <Badge tone={stock <= LOW_STOCK ? 'warning' : 'neutral'} dot={stock <= LOW_STOCK}>
      <span className="num">
        {formatNumber(stock)} {unit}
      </span>
    </Badge>
  );
}
