'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { saveBatchShiftPlan, saveShiftPlan, type ActionState } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useActionToast } from '@/hooks/use-action-toast'
import { MAX_BATCH_DAYS, formatShift, shiftDateOffset, shiftsInRange, type ShiftKey, type ShiftNo } from '@/lib/shift'
import { cn, formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

type Row = { id: number; name: string; balance: number; auGrade: number; planned: number; fed: number }
type LoaderOption = { id: number; name: string; bucketWeightT: number }
type Mode = 'tons' | 'ratio'

function toNumber(value: string) {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function ShortageWarning({ title, items }: { title: string; items: { name: string; deficit: number }[] }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
      <p className="font-medium text-destructive">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((i) => (
          <li key={i.name} className="flex items-baseline justify-between gap-2">
            <span>{i.name}</span>
            <span className="font-mono tabular-nums text-destructive">−{formatTons(i.deficit)} т</span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Планирование не блокируется — руда может поступить до начала смены.
      </p>
    </div>
  )
}

export function PlanForm({ shift, rows, loaders }: { shift: ShiftKey; rows: Row[]; loaders: LoaderOption[] }) {
  const initialTotal = rows.reduce((s, r) => s + r.planned, 0)
  const [mode, setMode] = useState<Mode>('tons')
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.planned > 0 ? String(r.planned) : ''])),
  )
  const [shares, setShares] = useState<Record<number, string>>({})
  const [targetTotal, setTargetTotal] = useState(initialTotal > 0 ? String(round1(initialTotal)) : '')
  const [loaderId, setLoaderId] = useState(loaders[0] ? String(loaders[0].id) : '')

  const [batchFrom, setBatchFrom] = useState(shift.date)
  const [batchTo, setBatchTo] = useState(shiftDateOffset(shift.date, 6))
  const [batchShifts, setBatchShifts] = useState<ShiftNo[]>([1, 2])

  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveShiftPlan, null)
  const [batchState, batchAction, batchPending] = useActionState<ActionState, FormData>(saveBatchShiftPlan, null)
  useActionToast(state)
  useActionToast(batchState)

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Нет активных штабелей.{' '}
          <Link href="/settings" className="text-primary underline underline-offset-4">
            Добавьте их в настройках
          </Link>
          .
        </CardContent>
      </Card>
    )
  }

  const shareSum = rows.reduce((s, r) => s + toNumber(shares[r.id] ?? ''), 0)
  const target = toNumber(targetTotal)

  function plannedFor(id: number) {
    if (mode === 'tons') return toNumber(values[id] ?? '')
    if (shareSum <= 0) return 0
    return (target * toNumber(shares[id] ?? '')) / shareSum
  }

  function switchMode(next: Mode) {
    if (next === mode) return
    if (next === 'ratio') {
      const total = rows.reduce((s, r) => s + toNumber(values[r.id] ?? ''), 0)
      setShares(
        Object.fromEntries(
          rows.map((r) => {
            const t = toNumber(values[r.id] ?? '')
            return [r.id, total > 0 && t > 0 ? String(round1((t / total) * 100)) : '']
          }),
        ),
      )
      if (total > 0) setTargetTotal(String(round1(total)))
    } else {
      setValues(
        Object.fromEntries(
          rows.map((r) => {
            const t = plannedFor(r.id)
            return [r.id, t > 0 ? String(round1(t)) : '']
          }),
        ),
      )
    }
    setMode(next)
  }

  const bucketWeight = loaders.find((l) => String(l.id) === loaderId)?.bucketWeightT ?? 0
  const computed = rows.map((r) => {
    const planned = plannedFor(r.id)
    return { ...r, plannedNum: planned, metal: planned * r.auGrade, over: planned > Math.max(0, r.balance) + 1e-9 }
  })
  const totalT = computed.reduce((s, r) => s + r.plannedNum, 0)
  const totalMetal = computed.reduce((s, r) => s + r.metal, 0)
  const totalFed = computed.reduce((s, r) => s + r.fed, 0)
  const blendGrade = totalT > 0 ? totalMetal / totalT : 0
  const totalBuckets = bucketWeight > 0 ? Math.ceil(totalT / bucketWeight) : 0
  const hasOver = computed.some((r) => r.over)

  const batchCount = shiftsInRange(batchFrom, batchTo, batchShifts).length
  const batchMaxTo = batchFrom ? shiftDateOffset(batchFrom, MAX_BATCH_DAYS - 1) : undefined
  const batchOver = computed.filter((r) => r.plannedNum > 0 && r.plannedNum * batchCount > Math.max(0, r.balance) + 1e-9)

  function toggleBatchShift(no: ShiftNo, checked: boolean) {
    setBatchShifts((prev) => (checked ? [...new Set([...prev, no])] : prev.filter((s) => s !== no)))
  }

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <input type="hidden" name="shiftDate" value={shift.date} />
      <input type="hidden" name="shiftNo" value={shift.shift} />
      {computed.map((r) => (
        <input key={r.id} type="hidden" name={`plan_${r.id}`} value={r.plannedNum > 0 ? r.plannedNum.toFixed(3) : ''} />
      ))}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle>План на {formatShift(shift)}</CardTitle>
            <CardDescription>
              {mode === 'tons'
                ? 'Тоннаж, который планируется подать из каждого штабеля'
                : 'Задайте общий тоннаж и пропорции — тоннаж по штабелям рассчитается автоматически'}
            </CardDescription>
          </div>
          <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
            <TabsList aria-label="Способ планирования">
              <TabsTrigger value="tons">Тоннаж</TabsTrigger>
              <TabsTrigger value="ratio">Пропорции</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mode === 'ratio' ? (
            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2">
                <Label htmlFor="plan-target">Общий тоннаж шихты на смену, т</Label>
                <Input
                  id="plan-target"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  className="w-44 text-right font-mono"
                  value={targetTotal}
                  onChange={(e) => setTargetTotal(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Сумма долей:{' '}
                <span className="font-mono tabular-nums text-foreground">{formatTons(shareSum)}</span>
                {shareSum > 0 && Math.abs(shareSum - 100) > 0.01 ? ' · доли будут нормированы к 100%' : ''}
              </p>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Остаток, т</TableHead>
                <TableHead className="text-right">Au, г/т</TableHead>
                {mode === 'ratio' ? <TableHead className="w-32 text-right">Доля</TableHead> : null}
                <TableHead className={cn('text-right', mode === 'tons' && 'w-36')}>План, т</TableHead>
                <TableHead className="text-right">Ковши</TableHead>
                {mode === 'tons' ? <TableHead className="text-right">Доля</TableHead> : null}
                <TableHead className="text-right">Факт, т</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computed.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', r.balance < 0 && 'text-destructive')}>
                    {formatTons(r.balance)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatGrade(r.auGrade)}</TableCell>
                  {mode === 'ratio' ? (
                    <TableCell className="text-right">
                      <Label htmlFor={`share-${r.id}`} className="sr-only">
                        Доля {r.name}
                      </Label>
                      <Input
                        id={`share-${r.id}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        className="ml-auto w-24 text-right font-mono"
                        value={shares[r.id] ?? ''}
                        onChange={(e) => setShares((v) => ({ ...v, [r.id]: e.target.value }))}
                      />
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right">
                    {mode === 'tons' ? (
                      <>
                        <Label htmlFor={`plan-${r.id}`} className="sr-only">
                          План для {r.name}, т
                        </Label>
                        <Input
                          id={`plan-${r.id}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.1"
                          placeholder="0"
                          aria-invalid={r.over || undefined}
                          className="ml-auto w-32 text-right font-mono"
                          value={values[r.id] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                        />
                      </>
                    ) : (
                      <span className={cn('font-mono tabular-nums', r.over && 'text-destructive')}>
                        {r.plannedNum > 0 ? formatTons(r.plannedNum) : '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {bucketWeight > 0 && r.plannedNum > 0 ? Math.ceil(r.plannedNum / bucketWeight) : '—'}
                  </TableCell>
                  {mode === 'tons' ? (
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {totalT > 0 && r.plannedNum > 0 ? formatPercent((r.plannedNum / totalT) * 100) : '—'}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-right font-mono tabular-nums">{r.fed > 0 ? formatTons(r.fed) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold" colSpan={mode === 'ratio' ? 4 : 3}>
                  Итого шихта
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(totalT)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{totalBuckets || '—'}</TableCell>
                {mode === 'tons' ? <TableCell /> : null}
                <TableCell className="text-right font-mono tabular-nums">{formatTons(totalFed)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {hasOver ? (
            <ShortageWarning
              title="Недостаточно руды на складе для плана смены"
              items={computed
                .filter((r) => r.over)
                .map((r) => ({ name: r.name, deficit: r.plannedNum - Math.max(0, r.balance) }))}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="flex h-fit flex-col gap-6 xl:sticky xl:top-6">
        <Card>
          <CardHeader>
            <CardTitle>Планируемая шихта</CardTitle>
            <CardDescription>Средневзвешенные показатели на смену</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-muted-foreground">Тоннаж</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums text-primary">{formatTons(totalT)} т</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-muted-foreground">Содержание Au</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums">{formatGrade(blendGrade)} г/т</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-muted-foreground">Металл</dt>
                <dd className="font-mono tabular-nums">{formatMetal(totalMetal)} г</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-muted-foreground">Ковшей</dt>
                <dd className="font-mono tabular-nums">{totalBuckets || '—'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm text-muted-foreground">Подано по факту</dt>
                <dd className="font-mono tabular-nums">
                  {formatTons(totalFed)} т{totalT > 0 ? ` · ${formatPercent((totalFed / totalT) * 100)}` : ''}
                </dd>
              </div>
            </dl>
            {loaders.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Label htmlFor="plan-loader" className="text-xs text-muted-foreground">
                  Расчёт ковшей по погрузчику
                </Label>
                <Select value={loaderId} onValueChange={setLoaderId}>
                  <SelectTrigger id="plan-loader" className="w-full">
                    <SelectValue />
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
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Сохранение…' : 'Сохранить план на смену'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Пакетное планирование</CardTitle>
            <CardDescription>Применить текущий план к каждой смене периода</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch-from" className="text-xs text-muted-foreground">
                  С даты
                </Label>
                <Input
                  id="batch-from"
                  name="batchFrom"
                  type="date"
                  value={batchFrom}
                  onChange={(e) => setBatchFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="batch-to" className="text-xs text-muted-foreground">
                  По дату
                </Label>
                <Input
                  id="batch-to"
                  name="batchTo"
                  type="date"
                  min={batchFrom || undefined}
                  max={batchMaxTo}
                  value={batchTo}
                  onChange={(e) => setBatchTo(e.target.value)}
                />
              </div>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs text-muted-foreground">Смены</legend>
              {([1, 2] as ShiftNo[]).map((no) => (
                <label key={no} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="batchShift"
                    value={no}
                    checked={batchShifts.includes(no)}
                    onChange={(e) => toggleBatchShift(no, e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Смена {no} ({no === 1 ? '19:00–07:00' : '07:00–19:00'})
                </label>
              ))}
            </fieldset>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="batchOverwrite" className="mt-0.5 size-4 accent-primary" />
              <span>
                Перезаписать существующие планы
                <span className="block text-xs text-muted-foreground">Иначе смены с планом будут пропущены</span>
              </span>
            </label>
            <dl className="flex flex-col gap-2 border-t border-border pt-4 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Смен в периоде</dt>
                <dd className="font-mono tabular-nums">{batchCount}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">Тоннаж за период</dt>
                <dd className="font-mono font-semibold tabular-nums">{formatTons(totalT * batchCount)} т</dd>
              </div>
            </dl>
            {batchOver.length > 0 ? (
              <ShortageWarning
                title="Суммарный план за период превышает остаток"
                items={batchOver.map((r) => ({
                  name: r.name,
                  deficit: r.plannedNum * batchCount - Math.max(0, r.balance),
                }))}
              />
            ) : null}
            <Button
              type="submit"
              variant="secondary"
              formAction={batchAction}
              disabled={batchPending || batchCount === 0 || totalT <= 0}
            >
              {batchPending ? 'Применение…' : `Применить на ${batchCount} смен`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
