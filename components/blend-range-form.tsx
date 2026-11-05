'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { shiftHours } from '@/lib/shift'

export type RangeShifts = 'all' | '1' | '2'

export function blendRangeHref(from: string, to: string, s: RangeShifts) {
  return `/shifts?view=sum&from=${from}&to=${to}&s=${s}`
}

export function BlendRangeForm({ from, to, shifts }: { from: string; to: string; shifts: RangeShifts }) {
  const router = useRouter()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  const [s, setS] = useState<RangeShifts>(shifts)
  const invalid = !f || !t || f > t

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalid) router.push(blendRangeHref(f, t, s))
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="range-from" className="text-xs text-muted-foreground">
          С даты
        </Label>
        <Input id="range-from" type="date" className="w-40" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="range-to" className="text-xs text-muted-foreground">
          По дату
        </Label>
        <Input id="range-to" type="date" className="w-40" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="range-shifts" className="text-xs text-muted-foreground">
          Смены
        </Label>
        <Select value={s} onValueChange={(v) => setS(v as RangeShifts)}>
          <SelectTrigger id="range-shifts" className="w-auto min-w-60 whitespace-nowrap">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Обе смены</SelectItem>
            <SelectItem value="1">Только смена 1 · {shiftHours(1)}</SelectItem>
            <SelectItem value="2">Только смена 2 · {shiftHours(2)}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={invalid}>
        Сформировать
      </Button>
      {f && t && f > t ? <p className="w-full text-xs text-destructive">Дата начала позже даты окончания</p> : null}
    </form>
  )
}
