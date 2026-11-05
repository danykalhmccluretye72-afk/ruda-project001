'use client'

import { ChevronLeft, ChevronRight, Printer } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { shiftDateOffset } from '@/lib/shift'

export function DayPicker({ path, value, today }: { path: string; value: string; today: string }) {
  const router = useRouter()
  const href = (date: string) => `${path}?date=${date}`

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Button asChild variant="outline" size="icon" aria-label="Предыдущие сутки">
        <Link href={href(shiftDateOffset(value, -1))}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-date" className="text-xs text-muted-foreground">
          Дата
        </Label>
        <Input
          id="report-date"
          type="date"
          className="w-40"
          value={value}
          onChange={(e) => e.target.value && router.push(href(e.target.value))}
        />
      </div>
      <Button asChild variant="outline" size="icon" aria-label="Следующие сутки">
        <Link href={href(shiftDateOffset(value, 1))}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      {value !== today ? (
        <Button asChild variant="ghost">
          <Link href={href(today)}>Сегодня</Link>
        </Button>
      ) : null}
    </div>
  )
}

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden="true" />
      Печать
    </Button>
  )
}
