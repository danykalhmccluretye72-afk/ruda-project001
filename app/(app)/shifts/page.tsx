import Link from 'next/link'
import { BlendDetailTable } from '@/components/blend-detail-table'
import { BlendRangeForm, blendRangeHref, type RangeShifts } from '@/components/blend-range-form'
import { PageHeader } from '@/components/page-header'
import { ShiftPicker } from '@/components/shift-picker'
import { ShiftReport } from '@/components/shift-report'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getBlendRange, getShiftFeedReport, getShiftHistory, getShiftPlan, getStockpiles } from '@/lib/queries'
import {
  formatShift,
  formatShiftDate,
  getShift,
  MAX_BATCH_DAYS,
  nextShift,
  parseShiftKey,
  prevShift,
  shiftDateOffset,
  shiftHours,
  shiftHref,
  type ShiftKey,
  type ShiftNo,
} from '@/lib/shift'
import { cn, formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

import { requireOperatorPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const compareShift = (a: ShiftKey, b: ShiftKey) => (a.date === b.date ? a.shift - b.shift : a.date < b.date ? -1 : 1)

type Params = { date?: string; shift?: string; view?: string; from?: string; to?: string; s?: string }

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOperatorPage()
  const params = await searchParams
  const current = getShift(new Date())
  const selected = parseShiftKey(params.date, params.shift) ?? current
  const view = params.view === 'sum' ? 'sum' : 'trio'

  let to = params.to && dateRe.test(params.to) ? params.to : current.date
  let from = params.from && dateRe.test(params.from) ? params.from : shiftDateOffset(to, -6)
  if (from > to) [from, to] = [to, from]
  if (from < shiftDateOffset(to, -(MAX_BATCH_DAYS - 1))) from = shiftDateOffset(to, -(MAX_BATCH_DAYS - 1))
  const rangeShifts: RangeShifts = params.s === '1' || params.s === '2' ? params.s : 'all'
  const shiftNos: ShiftNo[] = rangeShifts === 'all' ? [1, 2] : [rangeShifts === '1' ? 1 : 2]

  const prev = prevShift(selected)
  const next = nextShift(selected)
  const trioKeys = [prev, selected, next]

  const [report, plan, piles, history, trio, range] = await Promise.all([
    getShiftFeedReport(selected),
    getShiftPlan(selected),
    getStockpiles(),
    getShiftHistory(14),
    view === 'trio'
      ? Promise.all(trioKeys.map(async (k) => ({ key: k, plan: await getShiftPlan(k), report: await getShiftFeedReport(k) })))
      : Promise.resolve([]),
    view === 'sum' ? getBlendRange(from, to, shiftNos) : Promise.resolve(null),
  ])

  const trioLabels = ['Прошлая смена', 'Выбранная смена', 'Следующая смена']
  const rangeLabel =
    rangeShifts === 'all' ? 'обе смены' : `смена ${rangeShifts} · ${shiftHours(rangeShifts === '1' ? 1 : 2)}`

  return (
    <>
      <PageHeader
        title="Шихта по сменам"
        description="План и факт подачи в переработку по штабелям: тоннаж, доли, содержание Au и металл."
      />

      <nav aria-label="Режим отображения" className="mb-4 inline-flex rounded-md border border-border p-1">
        <Link
          href={shiftHref('/shifts', selected)}
          aria-current={view === 'trio' ? 'page' : undefined}
          className={cn(
            'rounded px-3 py-1.5 text-sm',
            view === 'trio' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          По сменам
        </Link>
        <Link
          href={blendRangeHref(from, to, rangeShifts)}
          aria-current={view === 'sum' ? 'page' : undefined}
          className={cn(
            'rounded px-3 py-1.5 text-sm',
            view === 'sum' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Сводная за период
        </Link>
      </nav>

      {view === 'trio' ? (
        <>
          <div className="mb-6">
            <ShiftPicker path="/shifts" value={selected} current={current} />
          </div>
          <section aria-label="Шихта: прошлая, выбранная и следующая смена" className="mb-6 flex flex-col gap-4">
            {trio.map((t, i) => {
              const cmp = compareShift(t.key, current)
              const isNow = cmp === 0
              return (
                <BlendDetailTable
                  key={`${t.key.date}-${t.key.shift}`}
                  title={trioLabels[i]}
                  subtitle={formatShift(t.key)}
                  badge={isNow ? 'текущая' : cmp > 0 ? 'будущая' : undefined}
                  highlight={i === 1}
                  showFact={cmp <= 0}
                  plan={t.plan}
                  fact={t.report.byStockpile}
                  piles={piles}
                />
              )
            })}
          </section>
        </>
      ) : (
        <>
          <div className="mb-6">
            <BlendRangeForm from={from} to={to} shifts={rangeShifts} />
          </div>
          {range ? (
            <div className="mb-6">
              <BlendDetailTable
                title="Сводная шихта за период"
                subtitle={`${formatShiftDate(from)} – ${formatShiftDate(to)}, ${rangeLabel}`}
                highlight
                showFact
                plan={range.plan}
                fact={range.fact}
                piles={piles}
              />
            </div>
          ) : null}
        </>
      )}

      <ShiftReport shift={selected} report={report} plan={plan} stockpiles={piles} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Последние смены</CardTitle>
          <CardDescription>Факт подачи против плана</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Данных о подаче пока нет.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Смена</TableHead>
                  <TableHead className="text-right">Ковши</TableHead>
                  <TableHead className="text-right">Факт, т</TableHead>
                  <TableHead className="text-right">План, т</TableHead>
                  <TableHead className="text-right">Вып.</TableHead>
                  <TableHead className="text-right">Au, г/т</TableHead>
                  <TableHead className="text-right">Металл, г</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={`${h.date}-${h.shift}`}>
                    <TableCell>
                      <Link
                        href={shiftHref('/shifts', h)}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {formatShiftDate(h.date)} · см. {h.shift}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{shiftHours(h.shift)}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{h.buckets}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(h.tonnage)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {h.plannedT > 0 ? formatTons(h.plannedT) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {h.plannedT > 0 ? formatPercent((h.tonnage / h.plannedT) * 100) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatGrade(h.grade)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatMetal(h.metalG)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
