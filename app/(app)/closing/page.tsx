import Link from 'next/link'
import { ClosureForm } from '@/components/closure-form'
import { PageHeader } from '@/components/page-header'
import { ShiftPicker } from '@/components/shift-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getRecentClosures, getShiftClosure, getShiftFeedReport, getStockpiles } from '@/lib/queries'
import { requireOperatorPage } from '@/lib/session'
import { formatShiftDate, getShift, parseShiftKey, shiftHref } from '@/lib/shift'
import { formatGrade, formatTons } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shift?: string }>
}) {
  await requireOperatorPage()
  const params = await searchParams
  const current = getShift(new Date())
  const selected = parseShiftKey(params.date, params.shift) ?? current

  const [feed, closure, piles, history] = await Promise.all([
    getShiftFeedReport(selected),
    getShiftClosure(selected),
    getStockpiles({ activeOnly: true }),
    getRecentClosures(20),
  ])

  return (
    <>
      <PageHeader
        title="Закрытие смены"
        description="Сверка подачи в переработку с фактом конвейерных весов и корректировка остатков штабелей."
      />
      <div className="mb-6">
        <ShiftPicker path="/closing" value={selected} current={current} />
      </div>

      <ClosureForm
        key={`${selected.date}-${selected.shift}-${closure?.updatedAt.getTime() ?? 0}`}
        shift={selected}
        feed={feed}
        closure={closure}
        stockpiles={piles}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Закрытые смены</CardTitle>
          <CardDescription>Последние 20 закрытий — нажмите на смену, чтобы отредактировать</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Закрытых смен пока нет.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Смена</TableHead>
                  <TableHead className="text-right">Подано, т</TableHead>
                  <TableHead className="text-right">Весы, т</TableHead>
                  <TableHead className="text-right">Разница, т</TableHead>
                  <TableHead className="text-right">Au шихты, г/т</TableHead>
                  <TableHead>Корректировка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const diff = h.scaleT - h.fedT
                  return (
                    <TableRow key={`${h.date}-${h.shift}`}>
                      <TableCell>
                        <Link
                          href={shiftHref('/closing', { date: h.date, shift: h.shift })}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {formatShiftDate(h.date)}, смена {h.shift}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatTons(h.fedT)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTons(h.scaleT)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {diff > 0 ? '+' : ''}
                        {formatTons(diff)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatGrade(h.blendGrade)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {diff > 0.0005
                          ? 'Досписание со штабелей'
                          : diff < -0.0005
                            ? `Излишек → ${h.targetStockpileName ?? '—'}`
                            : 'Без расхождения'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
