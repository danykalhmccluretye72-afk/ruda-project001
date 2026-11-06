import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BlendLine } from '@/lib/queries'
import { cn, formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

type PileInfo = { id: number; name: string; auGrade: number }

type Row = {
  id: number
  name: string
  planT: number
  planGrade: number
  planMetal: number
  factT: number
  factGrade: number
  factMetal: number
}

function buildRows(plan: Map<number, number>, fact: BlendLine[], piles: PileInfo[]): Row[] {
  const info = new Map(piles.map((p) => [p.id, p]))
  const factMap = new Map(fact.map((l) => [l.stockpileId, l]))
  const ids = new Set<number>([...plan.keys(), ...factMap.keys()])
  return [...ids]
    .map((id) => {
      const p = info.get(id)
      const f = factMap.get(id)
      const planT = plan.get(id) ?? 0
      const planGrade = p?.auGrade ?? 0
      const factT = f?.tonnage ?? 0
      const factMetal = f?.metalG ?? 0
      return {
        id,
        name: f?.stockpileName ?? p?.name ?? '—',
        planT,
        planGrade,
        planMetal: planT * planGrade,
        factT,
        factGrade: factT > 0 ? factMetal / factT : 0,
        factMetal,
      }
    })
    .filter((r) => r.planT > 0 || r.factT > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

const num = 'text-right font-mono tabular-nums whitespace-nowrap'
const share = (part: number, total: number) => (total > 0 ? formatPercent((part / total) * 100) : '—')

export function BlendDetailTable({
  title,
  subtitle,
  badge,
  highlight,
  showFact,
  plan,
  fact,
  piles,
}: {
  title: string
  subtitle?: string
  badge?: string
  highlight?: boolean
  showFact: boolean
  plan: Map<number, number>
  fact: BlendLine[]
  piles: PileInfo[]
}) {
  const rows = buildRows(plan, fact, piles)
  const planT = rows.reduce((s, r) => s + r.planT, 0)
  const planMetal = rows.reduce((s, r) => s + r.planMetal, 0)
  const factT = rows.reduce((s, r) => s + r.factT, 0)
  const factMetal = rows.reduce((s, r) => s + r.factMetal, 0)

  return (
    <Card className={cn(highlight && 'border-primary')}>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {badge ? <Badge>{badge}</Badge> : null}
        </div>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {showFact ? 'Нет плана и подачи' : 'План не задан'}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="align-bottom">
                  Штабель
                </TableHead>
                <TableHead colSpan={4} className="border-l border-border text-center">
                  План
                </TableHead>
                {showFact ? (
                  <>
                    <TableHead colSpan={4} className="border-l border-border text-center">
                      Факт
                    </TableHead>
                    <TableHead rowSpan={2} className="border-l border-border text-right align-bottom">
                      Вып.
                    </TableHead>
                  </>
                ) : null}
              </TableRow>
              <TableRow>
                <TableHead className="border-l border-border text-right">т</TableHead>
                <TableHead className="text-right">доля</TableHead>
                <TableHead className="text-right">Au, г/т</TableHead>
                <TableHead className="text-right">металл, г</TableHead>
                {showFact ? (
                  <>
                    <TableHead className="border-l border-border text-right">т</TableHead>
                    <TableHead className="text-right">доля</TableHead>
                    <TableHead className="text-right">Au, г/т</TableHead>
                    <TableHead className="text-right">металл, г</TableHead>
                  </>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-48 truncate font-medium" title={r.name}>
                    {r.name}
                  </TableCell>
                  <TableCell className={cn(num, 'border-l border-border')}>
                    {r.planT > 0 ? formatTons(r.planT) : '—'}
                  </TableCell>
                  <TableCell className={cn(num, 'text-muted-foreground')}>{share(r.planT, planT)}</TableCell>
                  <TableCell className={num}>{r.planT > 0 ? formatGrade(r.planGrade) : '—'}</TableCell>
                  <TableCell className={cn(num, 'text-muted-foreground')}>
                    {r.planT > 0 ? formatMetal(r.planMetal) : '—'}
                  </TableCell>
                  {showFact ? (
                    <>
                      <TableCell className={cn(num, 'border-l border-border font-semibold')}>
                        {r.factT > 0 ? formatTons(r.factT) : '—'}
                      </TableCell>
                      <TableCell className={cn(num, 'text-muted-foreground')}>{share(r.factT, factT)}</TableCell>
                      <TableCell className={num}>{r.factT > 0 ? formatGrade(r.factGrade) : '—'}</TableCell>
                      <TableCell className={cn(num, 'text-muted-foreground')}>
                        {r.factT > 0 ? formatMetal(r.factMetal) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          num,
                          'border-l border-border',
                          r.planT > 0 && r.factT >= r.planT ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {r.planT > 0 ? formatPercent((r.factT / r.planT) * 100) : '—'}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Итого</TableCell>
                <TableCell className={cn(num, 'border-l border-border font-semibold')}>{formatTons(planT)}</TableCell>
                <TableCell className={num}>{planT > 0 ? '100%' : '—'}</TableCell>
                <TableCell className={cn(num, 'font-semibold')}>
                  {planT > 0 ? formatGrade(planMetal / planT) : '—'}
                </TableCell>
                <TableCell className={num}>{formatMetal(planMetal)}</TableCell>
                {showFact ? (
                  <>
                    <TableCell className={cn(num, 'border-l border-border font-semibold')}>
                      {formatTons(factT)}
                    </TableCell>
                    <TableCell className={num}>{factT > 0 ? '100%' : '—'}</TableCell>
                    <TableCell className={cn(num, 'font-semibold')}>
                      {factT > 0 ? formatGrade(factMetal / factT) : '—'}
                    </TableCell>
                    <TableCell className={num}>{formatMetal(factMetal)}</TableCell>
                    <TableCell
                      className={cn(
                        num,
                        'border-l border-border font-semibold',
                        planT > 0 && factT >= planT && 'text-primary',
                      )}
                    >
                      {planT > 0 ? formatPercent((factT / planT) * 100) : '—'}
                    </TableCell>
                  </>
                ) : null}
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
