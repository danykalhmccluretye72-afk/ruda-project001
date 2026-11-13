'use client'

import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { useActionState, useCallback, useRef, useState } from 'react'
import { addCrushing, type ActionState } from '@/app/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useActionToast, withIsoDate } from '@/hooks/use-action-toast'
import type { Loader, Stockpile } from '@/lib/queries'
import { formatShift, fromKhvInputValue, getShift, toKhvInputValue } from '@/lib/shift'
import { formatGrade, formatTons } from '@/lib/utils'

type SourceLine = { key: number; sourceId: string; buckets: string }

export function CrushingForm({ stockpiles, loaders }: { stockpiles: Stockpile[]; loaders: Loader[] }) {
  const nextKey = useRef(1)
  const [targetId, setTargetId] = useState('')
  const [loaderId, setLoaderId] = useState(loaders[0] ? String(loaders[0].id) : '')
  const [lines, setLines] = useState<SourceLine[]>([{ key: 0, sourceId: '', buckets: '' }])
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => toKhvInputValue(new Date()))
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => addCrushing(prev, withIsoDate(formData)),
    null,
  )
  const reset = useCallback(() => {
    setLines([{ key: nextKey.current++, sourceId: '', buckets: '' }])
    setNote('')
    setNow(toKhvInputValue(new Date()))
  }, [])
  useActionToast(state, reset)

  const loader = loaders.find((l) => String(l.id) === loaderId)
  const bucketWeight = loader?.bucketWeightT ?? 0
  const totals = lines.reduce(
    (acc, l) => {
      const count = Number(l.buckets)
      if (!Number.isInteger(count) || count <= 0) return acc
      const tonnage = count * bucketWeight
      const grade = stockpiles.find((s) => String(s.id) === l.sourceId)?.auGrade ?? 0
      return { buckets: acc.buckets + count, tonnage: acc.tonnage + tonnage, metal: acc.metal + tonnage * grade }
    },
    { buckets: 0, tonnage: 0, metal: 0 },
  )
  const parsedTime = now ? fromKhvInputValue(now) : null
  const shift = parsedTime && !Number.isNaN(parsedTime.getTime()) ? getShift(parsedTime) : null
  const usedSources = new Set(lines.map((l) => l.sourceId))

  function updateLine(key: number, patch: Partial<SourceLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  if (stockpiles.length < 2 || loaders.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Новое дробление</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {loaders.length === 0 ? 'Нет активных погрузчиков. ' : 'Нужно минимум два активных штабеля. '}
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
        <CardTitle>Новое дробление</CardTitle>
        <CardDescription>Перемещение из одного или нескольких штабелей в другой, учёт ковшами</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="crush-loader">Погрузчик</Label>
            <Select name="loaderId" value={loaderId} onValueChange={setLoaderId}>
              <SelectTrigger id="crush-loader" className="w-full">
                <SelectValue placeholder="Выберите погрузчик" />
              </SelectTrigger>
              <SelectContent>
                {loaders.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name} · {formatTons(l.bucketWeightT)} т/ковш
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Откуда (исходные штабели)</legend>
            {lines.map((line, index) => (
              <div key={line.key} className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Label htmlFor={`crush-src-${line.key}`} className="sr-only">
                    Исходный штабель {index + 1}
                  </Label>
                  <Select
                    name="sourceId"
                    value={line.sourceId}
                    onValueChange={(v) => updateLine(line.key, { sourceId: v })}
                  >
                    <SelectTrigger id={`crush-src-${line.key}`} className="w-full">
                      <SelectValue placeholder="Штабель" />
                    </SelectTrigger>
                    <SelectContent>
                      {stockpiles
                        .filter(
                          (s) =>
                            String(s.id) !== targetId &&
                            (String(s.id) === line.sourceId || !usedSources.has(String(s.id))),
                        )
                        .map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} · {formatGrade(s.auGrade)} г/т
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-24 flex-col gap-1">
                  <Label htmlFor={`crush-b-${line.key}`} className="sr-only">
                    Ковшей из штабеля {index + 1}
                  </Label>
                  <Input
                    id={`crush-b-${line.key}`}
                    name="buckets"
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    step="0.1"
                    placeholder="Ковши"
                    value={line.buckets}
                    onChange={(e) => updateLine(line.key, { buckets: e.target.value })}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={lines.length === 1}
                  onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  aria-label={`Убрать штабель ${index + 1}`}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={lines.length >= stockpiles.length - 1}
              onClick={() => setLines((prev) => [...prev, { key: nextKey.current++, sourceId: '', buckets: '' }])}
            >
              <Plus className="size-4" aria-hidden="true" />
              Добавить штабель
            </Button>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="crush-target">Куда (целевой штабель)</Label>
            <Select name="targetStockpileId" value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id="crush-target" className="w-full">
                <SelectValue placeholder="Выберите штабель" />
              </SelectTrigger>
              <SelectContent>
                {stockpiles
                  .filter((s) => !usedSources.has(String(s.id)))
                  .map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="crush-time">Время (Хабаровск)</Label>
            <Input
              id="crush-time"
              name="occurredAt"
              type="datetime-local"
              value={now}
              onChange={(e) => setNow(e.target.value)}
              required
            />
            {shift ? (
              <p className="text-xs text-muted-foreground">
                Запишется в: <span className="text-foreground">{formatShift(shift)}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="crush-note">Примечание</Label>
            <Input id="crush-note" name="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Итого:</span>
            <span className="font-medium tabular-nums">{Math.round(totals.buckets * 10) / 10} ковш.</span>
            <span className="text-muted-foreground">=</span>
            <span className="font-semibold tabular-nums">{formatTons(totals.tonnage)} т</span>
            {totals.tonnage > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                Au {formatGrade(totals.metal / totals.tonnage)} г/т
              </Badge>
            ) : null}
          </div>

          <Button type="submit" disabled={pending || !targetId}>
            {pending ? 'Сохранение…' : 'Записать дробление'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
