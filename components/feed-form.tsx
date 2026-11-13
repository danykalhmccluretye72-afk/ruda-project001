'use client'

import Link from 'next/link'
import { useActionState, useCallback, useState } from 'react'
import { addFeed, type ActionState } from '@/app/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActionToast, withIsoDate } from '@/hooks/use-action-toast'
import type { Loader, Stockpile } from '@/lib/queries'
import { formatShift, fromKhvInputValue, getShift, toKhvInputValue } from '@/lib/shift'
import { formatGrade, formatMetal, formatTons } from '@/lib/utils'

export function FeedForm({ stockpiles, loaders }: { stockpiles: Stockpile[]; loaders: Loader[] }) {
  const [stockpileId, setStockpileId] = useState(stockpiles[0] ? String(stockpiles[0].id) : '')
  const [loaderId, setLoaderId] = useState(loaders[0] ? String(loaders[0].id) : '')
  const [buckets, setBuckets] = useState('')
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => toKhvInputValue(new Date()))
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => addFeed(prev, withIsoDate(formData)),
    null,
  )
  const reset = useCallback(() => {
    setBuckets('')
    setNote('')
    setNow(toKhvInputValue(new Date()))
  }, [])
  useActionToast(state, reset)

  const pile = stockpiles.find((s) => String(s.id) === stockpileId)
  const loader = loaders.find((l) => String(l.id) === loaderId)
  const count = Number(buckets)
  const bucketWeight = loader?.bucketWeightT ?? 0
  const tonnage = Number.isInteger(count) && count > 0 ? count * bucketWeight : 0
  const grade = pile?.auGrade ?? 0
  const parsedTime = now ? fromKhvInputValue(now) : null
  const shift = parsedTime && !Number.isNaN(parsedTime.getTime()) ? getShift(parsedTime) : null

  if (stockpiles.length === 0 || loaders.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Новая подача</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {stockpiles.length === 0 ? 'Нет активных штабелей. ' : 'Нет активных погрузчиков. '}
            <Link href="/settings" className="text-primary underline underline-offset-4">
              Добавьте в настройках
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Новая подача</CardTitle>
        <CardDescription>Данные погрузчика, время по Хабаровску</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="feed-loader">Погрузчик</Label>
            <Select name="loaderId" value={loaderId} onValueChange={setLoaderId} required>
              <SelectTrigger id="feed-loader" className="w-full">
                <SelectValue placeholder="Выберите погрузчик" />
              </SelectTrigger>
              <SelectContent>
                {loaders.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name} · {formatTons(l.bucketWeightT)} т
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="feed-stockpile">Штабель</Label>
            <Select name="stockpileId" value={stockpileId} onValueChange={setStockpileId} required>
              <SelectTrigger id="feed-stockpile" className="w-full">
                <SelectValue placeholder="Выберите штабель" />
              </SelectTrigger>
              <SelectContent>
                {stockpiles.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} · {formatGrade(s.auGrade)} г/т
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="feed-buckets">Количество ковшей</Label>
            <Input
              id="feed-buckets"
              name="bucketCount"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              max="10000"
              required
              className="font-mono"
              value={buckets}
              onChange={(e) => setBuckets(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="feed-time">Дата и время</Label>
            <Input
              id="feed-time"
              name="occurredAtLocal"
              type="datetime-local"
              value={now}
              onChange={(e) => setNow(e.target.value)}
              required
            />
            {shift ? (
              <Badge variant="secondary" className="w-fit">
                {formatShift(shift)}
              </Badge>
            ) : null}
          </div>

          <dl className="flex flex-col gap-1 rounded-md border border-border bg-muted/50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Вес ковша</dt>
              <dd className="font-mono tabular-nums">{formatTons(bucketWeight)} т</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Содержание Au</dt>
              <dd className="font-mono tabular-nums">{formatGrade(grade)} г/т</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Металл</dt>
              <dd className="font-mono tabular-nums">{formatMetal(tonnage * grade)} г</dd>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
              <dt className="text-muted-foreground">Тоннаж подачи</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums text-primary" aria-live="polite">
                {formatTons(tonnage)} т
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <Label htmlFor="feed-note">Примечание</Label>
            <Input id="feed-note" name="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Сохранение…' : 'Записать подачу'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
