import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockpileBalance } from '@/lib/queries'
import { cn, formatTons } from '@/lib/utils'

export function BalanceTable({ balances }: { balances: StockpileBalance[] }) {
  const max = Math.max(1, ...balances.map((b) => b.balance))
  const totals = balances.reduce(
    (acc, b) => ({
      initial: acc.initial + b.initialTonnage,
      received: acc.received + b.received,
      fed: acc.fed + b.fed,
      balance: acc.balance + b.balance,
    }),
    { initial: 0, received: 0, fed: 0, balance: 0 },
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Движение руды по штабелям</CardTitle>
        <CardDescription>Накопительно с момента ввода исходных остатков, тонны</CardDescription>
      </CardHeader>
      <CardContent>
        {balances.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Штабели не заданы.{' '}
            <Link href="/settings" className="text-primary underline underline-offset-4">
              Добавьте их в настройках
            </Link>
            .
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Исходный</TableHead>
                <TableHead className="text-right">Поступление</TableHead>
                <TableHead className="text-right">Подача</TableHead>
                <TableHead className="text-right">Остаток</TableHead>
                <TableHead className="hidden w-48 md:table-cell">
                  <span className="sr-only">Заполненность</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b) => (
                <TableRow key={b.id} className={cn(!b.isActive && 'opacity-60')}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {b.name}
                      {!b.isActive ? <Badge variant="outline">в архиве</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatTons(b.initialTonnage)}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', b.received > 0 ? 'text-success' : 'text-muted-foreground')}>
                    {b.received > 0 ? '+' : ''}
                    {formatTons(b.received)}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', b.fed > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {b.fed > 0 ? '−' : ''}
                    {formatTons(b.fed)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono font-semibold tabular-nums',
                      b.balance < 0 && 'text-destructive',
                    )}
                  >
                    {formatTons(b.balance)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
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
                <TableCell className="text-right font-mono tabular-nums">{formatTons(totals.initial)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">+{formatTons(totals.received)}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">−{formatTons(totals.fed)}</TableCell>
                <TableCell className="text-right font-mono font-semibold tabular-nums">{formatTons(totals.balance)}</TableCell>
                <TableCell className="hidden md:table-cell" />
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
