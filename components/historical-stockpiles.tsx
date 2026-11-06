'use client'

import { Undo2 } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { restoreStockpileFromHistory } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockpileBalance } from '@/lib/queries'
import { formatGrade, formatTons } from '@/lib/utils'

function RestoreButton({ stockpile, canEdit }: { stockpile: StockpileBalance; canEdit: boolean }) {
  const [pending, startTransition] = useTransition()
  if (!canEdit) return null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await restoreStockpileFromHistory(stockpile.id)
          if (result?.ok) toast.success(result.message)
          else if (result) toast.error(result.message)
        })
      }
    >
      <Undo2 className="size-4" aria-hidden="true" />
      {pending ? 'Возврат…' : 'Вернуть в оборот'}
    </Button>
  )
}

export function HistoricalStockpiles({ stockpiles, canEdit }: { stockpiles: StockpileBalance[]; canEdit: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Отработанные штабели</CardTitle>
        <CardDescription>
          Штабели с нулевым остатком. Они не показываются в остатках, формах ввода и планировании, но их движение
          сохраняется в отчётах за прошлые периоды.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stockpiles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Исторических штабелей нет. Перенести штабель можно в «Настройках».
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Исходный остаток, т</TableHead>
                <TableHead className="text-right">Поступило всего, т</TableHead>
                <TableHead className="text-right">Подано всего, т</TableHead>
                <TableHead className="text-right">Остаток, т</TableHead>
                <TableHead className="text-right">Au, г/т</TableHead>
                <TableHead className="w-44">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockpiles.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatTons(s.initialTonnage)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatTons(s.received + s.crushedIn + Math.max(s.adjusted, 0))}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatTons(s.fed + s.crushedOut + Math.max(-s.adjusted, 0))}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatTons(s.balance)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatGrade(s.auGrade)}</TableCell>
                  <TableCell className="text-right">
                    <RestoreButton stockpile={s} canEdit={canEdit} />
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
