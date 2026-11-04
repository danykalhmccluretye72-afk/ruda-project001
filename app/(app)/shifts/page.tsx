import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { ShiftPicker } from '@/components/shift-picker'
import { ShiftReport } from '@/components/shift-report'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getShiftFeedReport, getShiftHistory, getShiftPlan, getStockpiles } from '@/lib/queries'
import { formatShiftDate, getShift, parseShiftKey, shiftHours, shiftHref } from '@/lib/shift'
import { formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

import { requireOperatorPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ date?: string; shift?: string }> }) {
  await requireOperatorPage()
  const params = await searchParams
  const current = getShift(new Date())
  const selected = parseShiftKey(params.date, params.shift) ?? current

  const [report, plan, piles, history] = await Promise.all([
    getShiftFeedReport(selected),
    getShiftPlan(selected),
    getStockpiles(),
    getShiftHistory(14),
  ])

  return (
    <>
      <PageHeader
        title="Шихта по сменам"
        description="Поданная в переработку руда за смену: тоннаж, ковши, средневзвешенное содержание и металл."
      />
      <div className="mb-6">
        <ShiftPicker path="/shifts" value={selected} current={current} />
      </div>
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
