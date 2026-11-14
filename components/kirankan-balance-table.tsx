import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { KirankanBalance } from '@/lib/queries'
import { cn, formatGrade, formatMetal, formatTons } from '@/lib/utils'

function signed(value: number) {
  if (value > 0) return `+${formatTons(value)}`
  if (value < 0) return `−${formatTons(-value)}`
  return formatTons(0)
}

function tone(value: number) {
  return value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : 'text-muted-foreground'
}

export function KirankanBalanceTable({
  balances,
  canManage,
  showSurvey,
}: {
  balances: KirankanBalance[]
  canManage: boolean
  showSurvey: boolean
}) {
  const max = Math.max(1, ...balances.map((b) => b.balance))
  const totals = balances.reduce(
    (acc, b) => ({
      received: acc.received + b.received,
      shipped: acc.shipped + b.shipped,
      adjusted: acc.adjusted + b.adjusted,
      balance: acc.balance + b.balance,
      positive: acc.positive + Math.max(0, b.balance),
      metal: acc.metal + Math.max(0, b.balance) * b.auGrade,
    }),
    { received: 0, shipped: 0, adjusted: 0, balance: 0, positive: 0, metal: 0 },
  )

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Остатки руды Киранкан</CardTitle>
        <CardDescription>Текущий остаток и движение за текущую смену, тонны</CardDescription>
      </CardHeader>
      <CardContent>
        {balances.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Штабели Киранкана не заданы.
            {canManage ? (
              <>
                {' '}
                <Link href="/kirankan" className="text-primary underline underline-offset-4">
                  Создайте их во вкладке Киранкан
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Остаток</TableHead>
                <TableHead className="text-right">Au, г/т</TableHead>
                <TableHead className="text-right">Металл, г</TableHead>
                <TableHead className="text-right">Поступление</TableHead>
                {showSurvey ? <TableHead className="text-right">Корректировка</TableHead> : null}
                <TableHead className="text-right">Отгрузка на Перевальное</TableHead>
                <TableHead className="hidden w-40 lg:table-cell">
                  <span className="sr-only">Заполненность</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell
                    className={cn('text-right font-mono font-semibold tabular-nums', b.balance < 0 && 'text-destructive')}
                  >
                    {formatTons(b.balance)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatGrade(b.auGrade)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {formatMetal(Math.max(0, b.balance) * b.auGrade)}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', tone(b.received))}>
                    {signed(b.received)}
                  </TableCell>
                  {showSurvey ? (
                    <TableCell className={cn('text-right font-mono tabular-nums', tone(b.adjusted))}>
                      {signed(b.adjusted)}
                    </TableCell>
                  ) : null}
                  <TableCell className={cn('text-right font-mono tabular-nums', tone(-b.shipped))}>
                    {signed(-b.shipped)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(0, (b.balance / max) * 100)}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Итого</TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">
                  {formatTons(totals.balance)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatGrade(totals.positive > 0 ? totals.metal / totals.positive : 0)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{formatMetal(totals.metal)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{signed(totals.received)}</TableCell>
                {showSurvey ? (
                  <TableCell className="text-right font-mono tabular-nums">{signed(totals.adjusted)}</TableCell>
                ) : null}
                <TableCell className="text-right font-mono tabular-nums">{signed(-totals.shipped)}</TableCell>
                <TableCell className="hidden lg:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
