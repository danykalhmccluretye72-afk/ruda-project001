'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { nextShift, prevShift, shiftHours, shiftHref, type ShiftKey } from '@/lib/shift'

export function ShiftPicker({ path, value, current }: { path: string; value: ShiftKey; current: ShiftKey }) {
  const router = useRouter()
  const go = (key: ShiftKey) => router.push(shiftHref(path, key))
  const isCurrent = value.date === current.date && value.shift === current.shift

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Button asChild variant="outline" size="icon" aria-label="Предыдущая смена">
        <Link href={shiftHref(path, prevShift(value))}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shift-date" className="text-xs text-muted-foreground">
          Дата смены
        </Label>
        <Input
          id="shift-date"
          type="date"
          className="w-40"
          value={value.date}
          onChange={(e) => e.target.value && go({ date: e.target.value, shift: value.shift })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shift-no" className="text-xs text-muted-foreground">
          Смена
        </Label>
        <Select value={String(value.shift)} onValueChange={(v) => go({ date: value.date, shift: v === '1' ? 1 : 2 })}>
          <SelectTrigger id="shift-no" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Смена 1 · {shiftHours(1)}</SelectItem>
            <SelectItem value="2">Смена 2 · {shiftHours(2)}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button asChild variant="outline" size="icon" aria-label="Следующая смена">
        <Link href={shiftHref(path, nextShift(value))}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      {!isCurrent ? (
        <Button asChild variant="ghost">
          <Link href={shiftHref(path, current)}>Текущая смена</Link>
        </Button>
      ) : null}
    </div>
  )
}
