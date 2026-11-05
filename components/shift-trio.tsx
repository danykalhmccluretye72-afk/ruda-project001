import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ShiftFeedReport, StockpileBalance } from '@/lib/queries'
import { formatShift, shiftHref, type ShiftKey } from '@/lib/shift'
import { cn, formatGrade, formatPercent, formatTons } from '@/lib/utils'

export type ShiftColumn = {
  key: ShiftKey
  kind: 'prev' | 'current' | 'next'
  plan: Map<number, number>
  report: ShiftFeedReport | null
}

const kindLabel = { prev: 'Прошлая смена', current: 'Текущая смена', next: 'Будущая смена' } as const

type Row = { id: number; name: string; plan: number; fact: number; grade: number }

function buildRows(column: ShiftColumn, names: Map<number, { name: string; grade: number }>): Row[] {
  const ids = new Set<number>([...column.plan.keys(), ...(column.report?.byStockpile.map((l) => l.stockpileId) ?? [])])
  return [...ids]
    .map((id) => {
      const line = column.report?.byStockpile.find((l) => l.stockpileId === id)
      const info = names.get(id)
      return {
        id,
        name: line?.stockpileName ?? info?.name ?? '—',
        plan: column.plan.get(id) ?? 0,
        fact: line?.tonnage ?? 0,
        grade: line && line.tonnage > 0 ? line.metalG / line.tonnage : (info?.grade ?? 0),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

export function ShiftTrio({ columns, balances }: { columns: ShiftColumn[]; balances: StockpileBalance[] }) {
  const names = new Map(balances.map((b) => [b.id, { name: b.name, grade: b.auGrade }]))

  return (
    <section aria-labelledby="shift-trio-title" className="mb-6 flex flex-col gap-3">
      <h2 id="shift-trio-title" className="text-base font-semibold">
        Шихта по сменам
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => {
          const rows = buildRows(col, names)
          const planT = rows.reduce((s, r) => s + r.plan, 0)
          const factT = rows.reduce((s, r) => s + r.fact, 0)
          const showFact = col.kind !== 'next'
          const grade = showFact
            ? (col.report?.grade ?? 0)
            : planT > 0
              ? rows.reduce((s, r) => s + r.plan * r.grade, 0) / planT
              : 0

          return (
            <Card key={col.kind} className={cn(col.kind === 'current' && 'border-primary')}>
              <CardHeader className="gap-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{kindLabel[col.kind]}</CardTitle>
                  {col.kind === 'current' ? <Badge>сейчас</Badge> : null}
                </div>
                <Link
                  href={shiftHref(col.kind === 'next' ? '/planning' : '/shifts', col.key)}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  {formatShift(col.key)}
                </Link>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">План, т</dt>
                    <dd className="font-mono text-sm font-semibold tabular-nums">{formatTons(planT)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Факт, т</dt>
                    <dd className="font-mono text-sm font-semibold tabular-nums">{showFact ? formatTons(factT) : '—'}
                      {showFact && planT > 0 ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {formatPercent((factT / planT) * 100)}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Au, г/т</dt>
                    <dd className="font-mono text-sm font-semibold tabular-nums">{formatGrade(grade)}</dd>
                  </div>
                </dl>
                {rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {col.kind === 'next' ? 'План не задан' : 'Подачи не было'}
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border text-sm">
                    {rows.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="truncate">{r.name}</span>
                        <span className="shrink-0 font-mono text-xs tabular-nums">
                          {showFact ? (
                            <>
                              <span className="font-semibold">{formatTons(r.fact)}</span>
                              <span className="text-muted-foreground"> / {formatTons(r.plan)}</span>
                              <span
                                className={cn(
                                  'ml-2 inline-block min-w-12 text-right',
                                  r.plan > 0 && r.fact >= r.plan ? 'text-primary' : 'text-muted-foreground',
                                )}
                              >
                                {r.plan > 0 ? formatPercent((r.fact / r.plan) * 100) : '—'}
                              </span>
                            </>
                          ) : (
                            <span className="font-semibold">{formatTons(r.plan)}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
