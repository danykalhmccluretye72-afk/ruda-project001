import { Download } from 'lucide-react'
import { ArchiveToggle, DayPicker, PrintButton } from '@/components/day-picker'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildDailyReport, percent, type FeedTotals } from '@/lib/daily-report'
import { requireUser } from '@/lib/session'
import { formatShiftDate, getShift, parseShiftKey, shiftHours } from '@/lib/shift'
import { cn, formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const num = 'text-right font-mono tabular-nums'
const dash = (v: number) => (Math.abs(v) < 0.005 ? '—' : formatTons(v))

function Flow({ value }: { value: number }) {
  if (Math.abs(value) < 0.005) return <span className="text-muted-foreground">—</span>
  return value > 0 ? (
    <span className="text-success">+{formatTons(value)}</span>
  ) : (
    <span className="text-destructive">−{formatTons(-value)}</span>
  )
}

function Pct({ fact, plan }: { fact: number; plan: number }) {
  const p = percent(fact, plan)
  if (p === null) return <span className="text-muted-foreground">—</span>
  return <span className={cn(p < 95 ? 'text-destructive' : p > 105 ? 'text-primary' : 'text-success')}>{formatPercent(p)}</span>
}

function FeedCells({ t, strong }: { t: FeedTotals; strong?: boolean }) {
  return (
    <>
      <TableCell className={cn(num, 'text-muted-foreground')}>{dash(t.planT)}</TableCell>
      <TableCell className={cn(num, strong && 'font-semibold')}>{dash(t.factT)}</TableCell>
      <TableCell className={num}>
        <Pct fact={t.factT} plan={t.planT} />
      </TableCell>
    </>
  )
}

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; archive?: string }>
}) {
  await requireUser()
  const params = await searchParams
  const today = getShift(new Date()).date
  const date = parseShiftKey(params.date, '1')?.date ?? today
  const hideArchive = params.archive === '0'
  const query = hideArchive ? '&archive=0' : ''
  const report = await buildDailyReport(date, { hideArchive })
  const { s1, s2, day } = report.shifts

  const bal = report.balanceRows.reduce(
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

  const summary: { label: string; hint: string; t: FeedTotals }[] = [
    { label: 'Смена 1', hint: shiftHours(1), t: s1 },
    { label: 'Смена 2', hint: shiftHours(2), t: s2 },
    { label: 'Сутки', hint: formatShiftDate(date), t: day },
  ]

  return (
    <>
      <PageHeader
        title={`Суточный отчёт за ${formatShiftDate(date)}`}
        description="Сутки = смена 1 (19:00 предыдущего дня – 07:00) + смена 2 (07:00 – 19:00), время Хабаровска."
      />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <DayPicker path="/daily" value={date} today={today} query={query} />
        <div className="flex flex-wrap items-center gap-2">
          <ArchiveToggle path="/daily" date={date} hideArchive={hideArchive} />
          <PrintButton />
          <Button asChild>
            <a href={`/api/reports/daily?date=${date}${query}`} download>
              <Download className="size-4" aria-hidden="true" />
              Выгрузить в Excel (CSV)
            </a>
          </Button>
        </div>
      </div>

      <section aria-label="Итоги подачи" className="mb-6 grid gap-4 sm:grid-cols-3">
        {summary.map(({ label, hint, t }) => (
          <Card key={label} className={cn(label === 'Сутки' && 'border-primary/50')}>
            <CardHeader className="pb-2">
              <CardDescription>
                {label} · {hint}
              </CardDescription>
              <CardTitle className="flex items-baseline gap-2 font-mono text-2xl tabular-nums">
                {formatTons(t.factT)}
                <span className="text-sm font-normal text-muted-foreground">/ {formatTons(t.planT)} т</span>
                <span className="ml-auto text-base">
                  <Pct fact={t.factT} plan={t.planT} />
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex gap-6 text-sm text-muted-foreground">
              <span>
                Au <span className="font-mono text-foreground tabular-nums">{formatGrade(t.grade)}</span> г/т
              </span>
              <span>
                Металл <span className="font-mono text-foreground tabular-nums">{formatMetal(t.metalG)}</span> г
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Подача в переработку по штабелям</CardTitle>
          <CardDescription>План / факт по сменам и за сутки, т</CardDescription>
        </CardHeader>
        <CardContent>
          {report.feedRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">За сутки нет плана и подачи.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Штабель</TableHead>
                  <TableHead colSpan={3} className="border-l text-center">
                    Смена 1
                  </TableHead>
                  <TableHead colSpan={3} className="border-l text-center">
                    Смена 2
                  </TableHead>
                  <TableHead colSpan={5} className="border-l text-center">
                    Сутки
                  </TableHead>
                </TableRow>
                <TableRow>
                  {[1, 2, 3].map((g) => (
                    <SubHead key={g} />
                  ))}
                  <TableHead className="text-right">Au, г/т</TableHead>
                  <TableHead className="text-right">Металл, г</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.feedRows.map((r) => (
                  <TableRow key={r.stockpileId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <FeedCells t={r.s1} />
                    <FeedCells t={r.s2} />
                    <FeedCells t={r.day} strong />
                    <TableCell className={num}>{r.day.factT > 0 ? formatGrade(r.day.grade) : '—'}</TableCell>
                    <TableCell className={num}>{r.day.factT > 0 ? formatMetal(r.day.metalG) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Итого</TableCell>
                  <FeedCells t={s1} />
                  <FeedCells t={s2} />
                  <FeedCells t={day} strong />
                  <TableCell className={num}>{formatGrade(day.grade)}</TableCell>
                  <TableCell className={num}>{formatMetal(day.metalG)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Движение остатков за сутки — Перевальное</CardTitle>
          <CardDescription>
            На начало смены 1 и на конец смены 2 за {formatShiftDate(date)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.balanceRows.length === 0 ? (
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
                {report.balanceRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      {!r.isActive ? <span className="ml-2 text-xs text-muted-foreground">архив</span> : null}
                    </TableCell>
                    <TableCell className={cn(num, 'text-muted-foreground')}>{formatTons(r.opening)}</TableCell>
                    <TableCell className={num}>
                      <Flow value={r.received} />
                    </TableCell>
                    <TableCell className={num}>
                      <Flow value={r.crushedIn} />
                    </TableCell>
                    <TableCell className={num}>
                      <Flow value={-r.crushedOut} />
                    </TableCell>
                    <TableCell className={num}>
                      <Flow value={-r.fed} />
                    </TableCell>
                    <TableCell className={cn(num, 'font-semibold')}>{formatTons(r.closing)}</TableCell>
                    <TableCell className={num}>{formatGrade(r.auGrade)}</TableCell>
                    <TableCell className={num}>{formatMetal(r.closing * r.auGrade)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Итого</TableCell>
                  <TableCell className={num}>{formatTons(bal.opening)}</TableCell>
                  <TableCell className={num}>
                    <Flow value={bal.received} />
                  </TableCell>
                  <TableCell className={num}>
                    <Flow value={bal.crushedIn} />
                  </TableCell>
                  <TableCell className={num}>
                    <Flow value={-bal.crushedOut} />
                  </TableCell>
                  <TableCell className={num}>
                    <Flow value={-bal.fed} />
                  </TableCell>
                  <TableCell className={cn(num, 'font-semibold')}>{formatTons(bal.closing)}</TableCell>
                  <TableCell className={num}>{formatGrade(bal.closing > 0 ? bal.metal / bal.closing : 0)}</TableCell>
                  <TableCell className={num}>{formatMetal(bal.metal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function SubHead() {
  return (
    <>
      <TableHead className="border-l text-right">План</TableHead>
      <TableHead className="text-right">Факт</TableHead>
      <TableHead className="text-right">%</TableHead>
    </>
  )
}
