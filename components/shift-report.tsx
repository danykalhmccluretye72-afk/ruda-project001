import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ShiftFeedReport, Stockpile } from '@/lib/queries'
import { formatShift, type ShiftKey } from '@/lib/shift'
import { cn, formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

type Props = {
  shift: ShiftKey
  report: ShiftFeedReport
  plan: Map<number, number>
  stockpiles: Stockpile[]
}

export function ShiftReport({ shift, report, plan, stockpiles }: Props) {
  const factById = new Map(report.byStockpile.map((l) => [l.stockpileId, l]))
  const ids = new Set<number>([...factById.keys(), ...plan.keys()])
  const rows = stockpiles
    .filter((s) => ids.has(s.id))
    .map((s) => {
      const fact = factById.get(s.id)
      const tonnage = fact?.tonnage ?? 0
      return {
        id: s.id,
        name: s.name,
        planned: plan.get(s.id) ?? 0,
        tonnage,
        buckets: fact?.buckets ?? 0,
        grade: fact && tonnage > 0 ? fact.metalG / tonnage : s.auGrade,
        metal: fact?.metalG ?? 0,
      }
    })

  const plannedT = rows.reduce((s, r) => s + r.planned, 0)
  const completion = plannedT > 0 ? (report.tonnage / plannedT) * 100 : 0

  const stats = [
    { label: 'Подано шихты', value: `${formatTons(report.tonnage)} т` },
    { label: 'Ковшей', value: String(report.buckets) },
    { label: 'Содержание Au', value: `${formatGrade(report.grade)} г/т` },
    { label: 'Металл в шихте', value: `${formatMetal(report.metalG)} г` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{formatShift(shift)}</CardTitle>
          <CardDescription>
            {plannedT > 0
              ? `План ${formatTons(plannedT)} т · выполнено ${formatPercent(completion)}`
              : 'План на смену не задан'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-md border border-border p-4">
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="font-mono text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
          {plannedT > 0 ? <Progress value={Math.min(100, completion)} aria-label="Выполнение плана" /> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Шихта по штабелям</CardTitle>
            <CardDescription>План и факт подачи за смену</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">За эту смену нет ни подачи, ни плана.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Штабель</TableHead>
                    <TableHead className="text-right">План, т</TableHead>
                    <TableHead className="text-right">Факт, т</TableHead>
                    <TableHead className="text-right">Откл., т</TableHead>
                    <TableHead className="text-right">Ковши</TableHead>
                    <TableHead className="text-right">Au, г/т</TableHead>
                    <TableHead className="text-right">Доля</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const diff = r.tonnage - r.planned
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {r.planned > 0 ? formatTons(r.planned) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(r.tonnage)}</TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono tabular-nums',
                            r.planned === 0 ? 'text-muted-foreground' : diff < 0 ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {r.planned > 0 ? `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${formatTons(Math.abs(diff))}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{r.buckets}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatGrade(r.grade)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {report.tonnage > 0 ? formatPercent((r.tonnage / report.tonnage) * 100) : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Итого</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatTons(plannedT)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(report.tonnage)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {plannedT > 0 ? formatTons(report.tonnage - plannedT) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{report.buckets}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatGrade(report.grade)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>По погрузчикам</CardTitle>
          </CardHeader>
          <CardContent>
            {report.byLoader.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Нет подачи.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {report.byLoader.map((l) => (
                  <li key={l.loaderName} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{l.loaderName}</span>
                      <span className="text-xs text-muted-foreground">{l.buckets} ковш.</span>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums">{formatTons(l.tonnage)} т</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
