import { ArrowUpFromLine, CalendarClock, Gem, Layers } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { ShiftFeedReport, StockpileBalance } from '@/lib/queries'
import { formatShift, shiftHref, type ShiftKey } from '@/lib/shift'
import { formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

type Props = {
  balances: StockpileBalance[]
  shift: ShiftKey
  report: ShiftFeedReport
  plan: Map<number, number>
}

export function BalanceSummary({ balances, shift, report, plan }: Props) {
  const active = balances.filter((b) => b.isActive)
  const stock = active.reduce((s, b) => s + Math.max(0, b.balance), 0)
  const stockMetal = active.reduce((s, b) => s + Math.max(0, b.balance) * b.auGrade, 0)
  const stockGrade = stock > 0 ? stockMetal / stock : 0

  const gradeById = new Map(balances.map((b) => [b.id, b.auGrade]))
  let planT = 0
  let planMetal = 0
  for (const [id, t] of plan) {
    planT += t
    planMetal += t * (gradeById.get(id) ?? 0)
  }
  const planGrade = planT > 0 ? planMetal / planT : 0
  const completion = planT > 0 ? (report.tonnage / planT) * 100 : 0

  return (
    <section aria-label="Сводка" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="py-0">
        <CardContent className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Остаток на складе</p>
            <Layers className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">{formatTons(stock)} т</p>
          <p className="text-xs text-muted-foreground">
            ср. {formatGrade(stockGrade)} г/т · {active.length} штаб.
          </p>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Металл на складе</p>
            <Gem className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">{formatMetal(stockMetal)} г</p>
          <p className="text-xs text-muted-foreground">по текущему содержанию штабелей</p>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Подано за текущую смену</p>
            <ArrowUpFromLine className="size-4 text-destructive" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">{formatTons(report.tonnage)} т</p>
          <p className="text-xs text-muted-foreground">
            {formatGrade(report.grade)} г/т · {report.buckets} ковш.
            {planT > 0 ? ` · ${formatPercent(completion)} плана` : ''}
          </p>
          {planT > 0 ? <Progress value={Math.min(100, completion)} aria-label="Выполнение плана смены" /> : null}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">План шихты на смену</p>
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">{formatTons(planT)} т</p>
          <p className="text-xs text-muted-foreground">
            {planT > 0 ? `${formatGrade(planGrade)} г/т · ` : 'не задан · '}
            <Link href={shiftHref('/planning', shift)} className="text-primary underline underline-offset-4">
              {formatShift(shift)}
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
