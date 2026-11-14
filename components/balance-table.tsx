import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockpileBalance } from '@/lib/queries'
import { cn, formatGrade, formatTons } from '@/lib/utils'

function signed(value: number) {
  if (value > 0) return `+${formatTons(value)}`
  if (value < 0) return `−${formatTons(-value)}`
  return formatTons(0)
}

function sumBalances(rows: StockpileBalance[]) {
  return rows.reduce(
    (acc, b) => ({
      received: acc.received + b.received,
      crushed: acc.crushed + b.crushedIn - b.crushedOut,
      fed: acc.fed + b.fed,
      balance: acc.balance + b.balance,
      positive: acc.positive + Math.max(0, b.balance),
      metal: acc.metal + Math.max(0, b.balance) * b.auGrade,
      adjusted: acc.adjusted + b.adjusted,
    }),
    { received: 0, crushed: 0, fed: 0, balance: 0, positive: 0, metal: 0, adjusted: 0 },
  )
}

function TotalsCells({ totals, showSurvey }: { totals: ReturnType<typeof sumBalances>; showSurvey: boolean }) {
  return (
    <>
      <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(totals.balance)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {formatGrade(totals.positive > 0 ? totals.metal / totals.positive : 0)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{signed(totals.received)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{signed(totals.crushed)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{signed(-totals.fed)}</TableCell>
      {showSurvey ? <TableCell className="text-right font-mono tabular-nums">{signed(totals.adjusted)}</TableCell> : null}
      <TableCell className="hidden lg:table-cell" />
    </>
  )
}

export function BalanceTable({
  balances,
  canEdit,
  showSurvey,
}: {
  balances: StockpileBalance[]
  canEdit: boolean
  showSurvey: boolean
}) {
  const max = Math.max(1, ...balances.map((b) => b.balance))
  const totals = sumBalances(balances)
  const groups = [
    { key: 'active', title: 'Активные штабели', rows: balances.filter((b) => b.isActive) },
    { key: 'archived', title: 'Архивные штабели', rows: balances.filter((b) => !b.isActive) },
  ].filter((g) => g.rows.length > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Остатки по штабелям Перевальное</CardTitle>
        <CardDescription>
          Текущий остаток и движение за текущую смену, тонны.
          {showSurvey ? ' Маркшейдерский замер — накопленная корректировка, на подачу не влияет.' : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {balances.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Штабели не заданы.
            {canEdit ? (
              <>
                {' '}
                <Link href="/settings" className="text-primary underline underline-offset-4">
                  Добавьте их в настройках
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
                <TableHead className="text-right">Поступление</TableHead>
                <TableHead className="text-right">Дробление</TableHead>
                <TableHead className="text-right">Подача</TableHead>
                {showSurvey ? (
                  <TableHead className="text-right">
                    <abbr
                      title="Маркшейдерский замер: накопленная корректировка массы, не входит в поступление и подачу"
                      className="no-underline"
                    >
                      Маркш. замер
                    </abbr>
                  </TableHead>
                ) : null}
                <TableHead className="hidden w-40 lg:table-cell">
                  <span className="sr-only">Заполненность</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            {groups.map((group) => (
            <TableBody key={group.key} className="[&_tr:last-child]:border-b">
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={showSurvey ? 8 : 7} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </TableCell>
              </TableRow>
              {group.rows.map((b) => {
                const crushed = b.crushedIn - b.crushedOut
                return (
                  <TableRow key={b.id} className={cn(!b.isActive && 'opacity-60')}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {b.name}
                        {!b.isActive ? <Badge variant="outline">в архиве</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-mono font-semibold tabular-nums', b.balance < 0 && 'text-destructive')}
                    >
                      {formatTons(b.balance)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatGrade(b.auGrade)}</TableCell>
                    <TableCell
                      className={cn('text-right font-mono tabular-nums', b.received > 0 ? 'text-success' : 'text-muted-foreground')}
                    >
                      {signed(b.received)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular-nums',
                        crushed > 0 ? 'text-success' : crushed < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {signed(crushed)}
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-mono tabular-nums', b.fed > 0 ? 'text-destructive' : 'text-muted-foreground')}
                    >
                      {signed(-b.fed)}
                    </TableCell>
                    {showSurvey ? (
                      <TableCell
                        className={cn(
                          'text-right font-mono tabular-nums',
                          b.adjusted > 0 ? 'text-success' : b.adjusted < 0 ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {signed(b.adjusted)}
                      </TableCell>
                    ) : null}
                    <TableCell className="hidden lg:table-cell">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(0, (b.balance / max) * 100)}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-semibold">
                  Итого {group.key === 'active' ? 'по активным' : 'по архивным'}
                </TableCell>
                <TotalsCells totals={sumBalances(group.rows)} showSurvey={showSurvey} />
              </TableRow>
            </TableBody>
            ))}
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Итого общее</TableCell>
                <TotalsCells totals={totals} showSurvey={showSurvey} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
        {balances.some((b) => b.balance < 0) ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            Отрицательный остаток: проверьте вес ковша и данные поступления.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
