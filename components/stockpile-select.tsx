'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Stockpile } from '@/lib/queries'

export function StockpileSelect({ id, stockpiles }: { id: string; stockpiles: Stockpile[] }) {
  return (
    <Select name="stockpileId" defaultValue={stockpiles[0] ? String(stockpiles[0].id) : undefined} required>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Выберите штабель" />
      </SelectTrigger>
      <SelectContent>
        {stockpiles.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
