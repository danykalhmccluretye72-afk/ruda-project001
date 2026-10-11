'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { saveShiftPlan, type ActionState } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useActionToast } from '@/hooks/use-action-toast'
import { formatShift, type ShiftKey } from '@/lib/shift'
import { cn, formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

type Row = { id: number; name: string; balance: number; auGrade: number; planned: number; fed: number }
type LoaderOption = { id: number; name: string; bucketWeightT: number }

function toNumber(value: string) {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function PlanForm({ shift, rows, loaders }: { shift: ShiftKey; rows: Row[]; loaders: LoaderOption[] }) {
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.planned > 0 ? String(r.planned) : ''])),
  )
  const [loaderId, setLoaderId] = useState(loaders[0] ? String(loaders[0].id) : '')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveShiftPlan, null)
  useActionToast(state)

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

  const bucketWeight = loaders.find((l) => String(l.id) === loaderId)?.bucketWeightT ?? 0
  const computed = rows.map((r) => {
    const planned = toNumber(values[r.id] ?? '')
    return { ...r, plannedNum: planned, metal: planned * r.auGrade, over: planned > Math.max(0, r.balance) + 1e-9 }
  })
  const totalT = computed.reduce((s, r) => s + r.plannedNum, 0)
  const totalMetal = computed.reduce((s, r) => s + r.metal, 0)
  const totalFed = computed.reduce((s, r) => s + r.fed, 0)
  const blendGrade = totalT > 0 ? totalMetal / totalT : 0
  const totalBuckets = bucketWeight > 0 ? Math.ceil(totalT / bucketWeight) : 0
  const hasOver = computed.some((r) => r.over)

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <input type="hidden" name="shiftDate" value={shift.date} />
      <input type="hidden" name="shiftNo" value={shift.shift} />

      <Card>
        <CardHeader>
          <CardTitle>План на {formatShift(shift)}</CardTitle>
          <CardDescription>Тоннаж, который планируется подать из каждого штабеля</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Остаток, т</TableHead>
                <TableHead className="text-right">Au, г/т</TableHead>
                <TableHead className="w-36 text-right">План, т</TableHead>
                <TableHead className="text-right">Ковши</TableHead>
                <TableHead className="text-right">Доля</TableHead>
                <TableHead className="text-right">Факт, т</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computed.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell
                    className={cn('text-right font-mono tabular-nums', r.balance < 0 && 'text-destructive')}
                  >
                    {formatTons(r.balance)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatGrade(r.auGrade)}</TableCell>
                  <TableCell className="text-right">
                    <Label htmlFor={`plan-${r.id}`} className="sr-only">
                      План для {r.name}, т
                    </Label>
                    <Input
                      id={`plan-${r.id}`}
                      name={`plan_${r.id}`}
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
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {bucketWeight > 0 && r.plannedNum > 0 ? Math.ceil(r.plannedNum / bucketWeight) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {totalT > 0 && r.plannedNum > 0 ? formatPercent((r.plannedNum / totalT) * 100) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.fed > 0 ? formatTons(r.fed) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold" colSpan={3}>
                  Итого шихта
                </TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(totalT)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{totalBuckets || '—'}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono tabular-nums">{formatTons(totalFed)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {hasOver ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              План по некоторым штабелям превышает текущий остаток.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="h-fit xl:sticky xl:top-6">
        <CardHeader>
          <CardTitle>Планируемая шихта</CardTitle>
          <CardDescription>Средневзвешенные показатели</CardDescription>
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
            {pending ? 'Сохранение…' : 'Сохранить план'}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
