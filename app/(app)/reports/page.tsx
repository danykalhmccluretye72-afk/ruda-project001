import { Download } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { ShiftPicker } from '@/components/shift-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getShiftBalanceReport } from '@/lib/queries'
import { requireOperatorPage } from '@/lib/session'
import { formatShift, getShift, parseShiftKey } from '@/lib/shift'
import { formatGrade, formatMetal, formatTons } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string; shift?: string }> }) {
  await requireOperatorPage()
  const params = await searchParams
  const current = getShift(new Date())
  const selected = parseShiftKey(params.date, params.shift) ?? current
  const rows = (await getShiftBalanceReport(selected)).filter(
    (r) => r.isActive || r.opening !== 0 || r.closing !== 0,
  )

  const total = rows.reduce(
    (acc, r) => ({
      opening: acc.opening + r.opening,
      received: acc.received + r.received,
      crushedIn: acc.crushedIn + r.crushedIn,
      crushedOut: acc.crushedOut + r.crushedOut,
      fed: acc.fed + r.fed,
      closing: acc.closing + r.closing,
      metal: acc.metal + r.closing * r.auGrade,
    }),
    { opening: 0, received: 0, crushedIn: 0, crushedOut: 0, fed: 0, closing: 0, metal: 0 },
  )
  const csvHref = `/api/reports/balance?date=${selected.date}&shift=${selected.shift}`
  const dash = (v: number) => (Math.abs(v) < 0.005 ? '—' : formatTons(v))

  return (
    <>
      <PageHeader title="Отчёты" description="Остаток по штабелям на конец любой смены с движением за смену." />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <ShiftPicker path="/reports" value={selected} current={current} />
        <Button asChild>
          <a href={csvHref} download>
            <Download className="size-4" aria-hidden="true" />
            Выгрузить в Excel (CSV)
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Остатки на конец смены</CardTitle>
          <CardDescription>{formatShift(selected)}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Штабелей нет.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Штабель</TableHead>
                  <TableHead className="text-right">На начало, т</TableHead>
                  <TableHead className="text-right">Поступление</TableHead>
                  <TableHead className="text-right">Дробл. приход</TableHead>
                  <TableHead className="text-right">Дробл. расход</TableHead>
                  <TableHead className="text-right">Подача</TableHead>
                  <TableHead className="text-right">На конец, т</TableHead>
                  <TableHead className="text-right">Au, г/т</TableHead>
                  <TableHead className="text-right">Металл, г</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      {!r.isActive ? <span className="ml-2 text-xs text-muted-foreground">архив</span> : null}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {formatTons(r.opening)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{dash(r.received)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{dash(r.crushedIn)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{dash(r.crushedOut)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{dash(r.fed)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(r.closing)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatGrade(r.auGrade)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatMetal(r.closing * r.auGrade)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Итого</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatTons(total.opening)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{dash(total.received)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{dash(total.crushedIn)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{dash(total.crushedOut)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{dash(total.fed)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(total.closing)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatGrade(total.closing > 0 ? total.metal / total.closing : 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatMetal(total.metal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
