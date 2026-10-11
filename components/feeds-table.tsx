import { deleteFeed } from '@/app/actions'
import { DeleteEntryButton } from '@/components/delete-entry-button'
import { LocalTime } from '@/components/local-time'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { getRecentFeeds } from '@/lib/queries'
import { formatTons } from '@/lib/utils'

type Feed = Awaited<ReturnType<typeof getRecentFeeds>>[number]

export function FeedsTable({ feeds }: { feeds: Feed[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал подачи</CardTitle>
        <CardDescription>Последние {feeds.length} записей</CardDescription>
      </CardHeader>
      <CardContent>
        {feeds.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Подач пока нет.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Время</TableHead>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Ковши × вес</TableHead>
                <TableHead className="text-right">Тоннаж, т</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeds.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <LocalTime value={f.occurredAt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{f.stockpileName ?? '—'}</span>
                      {f.loader || f.note ? (
                        <span className="text-xs text-muted-foreground">
                          {[f.loader, f.note].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right font-mono tabular-nums text-muted-foreground">
                    {f.bucketCount} × {formatTons(f.bucketWeightT)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-destructive">
                    −{formatTons(f.tonnage)}
                  </TableCell>
                  <TableCell>
                    <DeleteEntryButton id={f.id} action={deleteFeed} />
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
