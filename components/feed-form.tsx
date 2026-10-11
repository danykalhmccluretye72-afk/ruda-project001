'use client'

import Link from 'next/link'
import { useActionState, useCallback, useState } from 'react'
import { addFeed, type ActionState } from '@/app/actions'
import { StockpileSelect } from '@/components/stockpile-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toLocalInputValue, useActionToast, withIsoDate } from '@/hooks/use-action-toast'
import type { Stockpile } from '@/lib/queries'
import { formatTons } from '@/lib/utils'

export function FeedForm({ stockpiles, bucketWeight }: { stockpiles: Stockpile[]; bucketWeight: number }) {
  const [buckets, setBuckets] = useState('')
  const [loader, setLoader] = useState('')
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => toLocalInputValue(new Date()))
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => addFeed(prev, withIsoDate(formData)),
    null,
  )
  const reset = useCallback(() => {
    setBuckets('')
    setNote('')
    setNow(toLocalInputValue(new Date()))
  }, [])
  useActionToast(state, reset)

  const count = Number(buckets)
  const tonnage = Number.isInteger(count) && count > 0 ? count * bucketWeight : 0

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Новая подача</CardTitle>
        <CardDescription>Данные погрузчика</CardDescription>
      </CardHeader>
      <CardContent>
        {stockpiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных штабелей. Добавьте их в настройках.</p>
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-stockpile">Штабель</Label>
              <StockpileSelect id="feed-stockpile" stockpiles={stockpiles} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-buckets">Количество ковшей</Label>
              <Input
                id="feed-buckets"
                name="bucketCount"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                max="10000"
                required
                className="font-mono"
                value={buckets}
                onChange={(e) => setBuckets(e.target.value)}
              />
            </div>
            <div className="rounded-md border border-border bg-muted/50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Вес ковша</span>
                <span className="font-mono tabular-nums">{formatTons(bucketWeight)} т</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Тоннаж подачи</span>
                <span className="font-mono text-lg font-semibold tabular-nums text-primary" aria-live="polite">
                  {formatTons(tonnage)} т
                </span>
              </div>
              <Link href="/settings" className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-4">
                Изменить вес ковша
              </Link>
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-loader">Погрузчик / смена</Label>
              <Input
                id="feed-loader"
                name="loader"
                maxLength={100}
                placeholder="CAT 988, смена 1"
                value={loader}
                onChange={(e) => setLoader(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="feed-note">Примечание</Label>
              <Input id="feed-note" name="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Сохранение…' : 'Записать подачу'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
