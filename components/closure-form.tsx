'use client'

import { useActionState, useState } from 'react'
import type { ActionState } from '@/app/actions'
import { deleteShiftClosure, saveShiftClosure } from '@/app/closure-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useActionToast } from '@/hooks/use-action-toast'
import type { ShiftClosure, ShiftFeedReport, Stockpile } from '@/lib/queries'
import type { ShiftKey } from '@/lib/shift'
import { formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

const EPS = 0.0005

export function ClosureForm({
  shift,
  feed,
  closure,
  stockpiles,
}: {
  shift: ShiftKey
  feed: ShiftFeedReport
  closure: ShiftClosure | null
  stockpiles: Stockpile[]
}) {
  const [scale, setScale] = useState(closure ? String(closure.scaleT) : '')
  const [target, setTarget] = useState(
    closure?.targetStockpileId ? String(closure.targetStockpileId) : stockpiles[0] ? String(stockpiles[0].id) : '',
  )
  const [note, setNote] = useState(closure?.note ?? '')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveShiftClosure, null)
  useActionToast(state)

  const fed = feed.tonnage
  const scaleT = scale === '' ? null : Number(scale.replace(',', '.'))
  const valid = scaleT !== null && Number.isFinite(scaleT) && scaleT >= 0
  const diff = valid ? Math.round((scaleT - fed) * 1000) / 1000 : 0
  const shortage = valid && diff > EPS
  const surplus = valid && diff < -EPS
  const feedChanged = closure !== null && Math.abs(closure.fedT - fed) > EPS
  const targetPile = stockpiles.find((s) => String(s.id) === target)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Факт подачи за смену</CardTitle>
          <CardDescription>Зафиксированная подача по ковшам — основа для пропорции досписания</CardDescription>
        </CardHeader>
        <CardContent>
          {feed.byStockpile.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">За смену подачи не зафиксировано.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Штабель</TableHead>
                  <TableHead className="text-right">Подано, т</TableHead>
                  <TableHead className="text-right">Доля</TableHead>
                  <TableHead className="text-right">Au, г/т</TableHead>
                  <TableHead className="text-right">Металл, г</TableHead>
                  {shortage ? <TableHead className="text-right">Досписание, т</TableHead> : null}
                  {shortage ? <TableHead className="text-right">Металл досп., г</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {feed.byStockpile.map((l) => {
                  const share = fed > 0 ? l.tonnage / fed : 0
                  const grade = l.tonnage > 0 ? l.metalG / l.tonnage : 0
                  const extra = diff * share
                  return (
                    <TableRow key={l.stockpileId}>
                      <TableCell className="font-medium">{l.stockpileName}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTons(l.tonnage)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(share)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatGrade(grade)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMetal(l.metalG)}</TableCell>
                      {shortage ? (
                        <TableCell className="text-right tabular-nums text-destructive">{formatTons(extra)}</TableCell>
                      ) : null}
                      {shortage ? (
                        <TableCell className="text-right tabular-nums">{formatMetal(extra * grade)}</TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Итого</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTons(fed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(fed > 0 ? 1 : 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatGrade(feed.grade)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetal(feed.metalG)}</TableCell>
                  {shortage ? <TableCell className="text-right tabular-nums">{formatTons(diff)}</TableCell> : null}
                  {shortage ? (
                    <TableCell className="text-right tabular-nums">{formatMetal(diff * feed.grade)}</TableCell>
                  ) : null}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Факт переработки по конвейерным весам</CardTitle>
            {closure ? <Badge variant="secondary">Смена закрыта</Badge> : <Badge variant="outline">Не закрыта</Badge>}
          </div>
          <CardDescription>
            Недостача подачи досписывается со штабелей по фактической пропорции. Излишек подачи уходит в выбранный
            штабель со средневзвешенным содержанием шихты.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {feedChanged ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              Подача за смену изменилась после закрытия ({formatTons(closure.fedT)} т → {formatTons(fed)} т).
              Сохраните закрытие повторно, чтобы пересчитать корректировку.
            </p>
          ) : null}

          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="date" value={shift.date} />
            <input type="hidden" name="shift" value={shift.shift} />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="scaleT">Факт по весам, т</Label>
                <Input
                  id="scaleT"
                  name="scaleT"
                  inputMode="decimal"
                  required
                  value={scale}
                  onChange={(e) => setScale(e.target.value)}
                  placeholder="0,000"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium leading-none">Подано по ковшам, т</span>
                <p className="flex h-9 items-center tabular-nums">{formatTons(fed)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium leading-none">Разница (весы − ��одача), т</span>
                <p
                  className={
                    shortage
                      ? 'flex h-9 items-center font-semibold tabular-nums text-destructive'
                      : surplus
                        ? 'flex h-9 items-center font-semibold tabular-nums text-primary'
                        : 'flex h-9 items-center tabular-nums'
                  }
                >
                  {valid ? `${diff > 0 ? '+' : ''}${formatTons(diff)}` : '—'}
                </p>
              </div>
            </div>

            {shortage ? (
              <p className="text-sm text-muted-foreground">
                Недостача подачи: {formatTons(diff)} т будет досписано со штабелей пропорционально подаче (см. таблицу
                выше).
              </p>
            ) : null}

            {surplus ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2 sm:col-span-1">
                  <Label htmlFor="targetStockpileId">Целевой штабель для излишка</Label>
                  <Select name="targetStockpileId" value={target} onValueChange={setTarget} required>
                    <SelectTrigger id="targetStockpileId" className="w-full">
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
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Масса в штабель, т</span>
                  <p className="flex h-9 items-center tabular-nums">{formatTons(-diff)}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Au, г/т · металл, г</span>
                  <p className="flex h-9 items-center tabular-nums">
                    {formatGrade(feed.grade)} · {formatMetal(-diff * feed.grade)}
                  </p>
                </div>
                {targetPile ? (
                  <p className="text-sm text-muted-foreground sm:col-span-3">
                    {formatTons(-diff)} т вернутся в «{targetPile.name}» и будут вычтены из «подано» за смену.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="note">Примечание</Label>
              <Input id="note" name="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={pending || !valid}>
                {pending ? 'Сохранение…' : closure ? 'Пересчитать и сохранить' : 'Закрыть смену'}
              </Button>
            </div>
          </form>

          {closure ? (
            <form action={deleteShiftClosure}>
              <input type="hidden" name="date" value={shift.date} />
              <input type="hidden" name="shift" value={shift.shift} />
              <Button type="submit" variant="outline">
                Отменить закрытие
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {closure && closure.lines.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Проведённая корректировка</CardTitle>
            <CardDescription>Учтена в остатках на конец смены</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Штабель</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead className="text-right">Масса, т</TableHead>
                  <TableHead className="text-right">Au, г/т</TableHead>
                  <TableHead className="text-right">Металл, г</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closure.lines.map((l) => (
                  <TableRow key={l.stockpileId}>
                    <TableCell className="font-medium">{l.stockpileName}</TableCell>
                    <TableCell>{l.deltaT > 0 ? 'Досписание' : 'Возврат излишка'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTons(Math.abs(l.deltaT))}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatGrade(l.auGrade)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMetal(Math.abs(l.deltaT) * l.auGrade)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
