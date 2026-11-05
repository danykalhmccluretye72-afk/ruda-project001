import { Trash2 } from 'lucide-react'
import { deleteStockpileAdjustment } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockpileAdjustmentEntry } from '@/lib/queries'
import { cn, formatDateTime, formatTons } from '@/lib/utils'

export function SurveyJournal({ entries }: { entries: StockpileAdjustmentEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Маркшейдерские уточнения</CardTitle>
        <CardDescription>
          Корректировки остатков по замерам. Удаление записи возвращает учётный остаток.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Замеров ещё не было.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата и время</TableHead>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Изменение, т</TableHead>
                <TableHead>Основание</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono tabular-nums">{formatDateTime(e.occurredAt)}</TableCell>
                  <TableCell className="font-medium">{e.stockpileName}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      e.deltaT > 0 ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {`${e.deltaT > 0 ? '+' : '−'}${formatTons(Math.abs(e.deltaT))}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.note ?? '—'}</TableCell>
                  <TableCell>
                    <form action={deleteStockpileAdjustment} className="flex justify-end">
                      <input type="hidden" name="id" value={e.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Удалить уточнение ${e.stockpileName}`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
