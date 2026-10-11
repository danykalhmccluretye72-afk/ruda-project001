import { deleteReceipt } from '@/app/actions'
import { DeleteEntryButton } from '@/components/delete-entry-button'
import { LocalTime } from '@/components/local-time'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { getRecentReceipts } from '@/lib/queries'
import { formatTons } from '@/lib/utils'

type Receipt = Awaited<ReturnType<typeof getRecentReceipts>>[number]

export function ReceiptsTable({ receipts }: { receipts: Receipt[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал поступления</CardTitle>
        <CardDescription>Последние {receipts.length} записей</CardDescription>
      </CardHeader>
      <CardContent>
        {receipts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Поступлений пока нет.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Время</TableHead>
                <TableHead>Штабель</TableHead>
                <TableHead>Машина / талон</TableHead>
                <TableHead className="text-right">Нетто, т</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <LocalTime value={r.occurredAt} />
                  </TableCell>
                  <TableCell className="font-medium">{r.stockpileName ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{r.truckNumber ?? '—'}</span>
                      {r.ticketNumber || r.note ? (
                        <span className="text-xs text-muted-foreground">
                          {[r.ticketNumber && `№ ${r.ticketNumber}`, r.note].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-success">
                    +{formatTons(r.netWeightT)}
                  </TableCell>
                  <TableCell>
                    <DeleteEntryButton id={r.id} action={deleteReceipt} />
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
