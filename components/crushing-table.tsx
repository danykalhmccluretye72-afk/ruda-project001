import { ArrowRight } from 'lucide-react'
import { deleteCrushing } from '@/app/actions'
import { DeleteEntryButton } from '@/components/delete-entry-button'
import { LocalTime } from '@/components/local-time'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { getRecentCrushing } from '@/lib/queries'
import { formatGrade, formatTons } from '@/lib/utils'

type CrushingOp = Awaited<ReturnType<typeof getRecentCrushing>>[number]

export function CrushingTable({ ops }: { ops: CrushingOp[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал дробления</CardTitle>
        <CardDescription>Последние {ops.length} операций</CardDescription>
      </CardHeader>
      <CardContent>
        {ops.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Операций дробления пока нет.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Время</TableHead>
                <TableHead>Откуда</TableHead>
                <TableHead>Куда</TableHead>
                <TableHead className="text-right">Ковши</TableHead>
                <TableHead className="text-right">Тоннаж, т</TableHead>
                <TableHead className="text-right">Au, г/т</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ops.map((op) => (
                <TableRow key={op.id} className="align-top">
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">
                        <LocalTime value={op.occurredAt} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[op.shiftNo ? `смена ${op.shiftNo}` : null, op.loaderName].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ul className="flex flex-col gap-0.5">
                      {op.sources.map((s, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {s.buckets} ковш. · {formatTons(s.tonnage)} т
                          </span>
                        </li>
                      ))}
                    </ul>
                    {op.note ? <p className="mt-1 text-xs text-muted-foreground">{op.note}</p> : null}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium">
                      <ArrowRight className="size-3.5 text-primary" aria-hidden="true" />
                      {op.targetName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {op.buckets}
                    <span className="block text-xs text-muted-foreground">× {formatTons(op.bucketWeightT)} т</span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatTons(op.tonnage)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatGrade(op.grade)}</TableCell>
                  <TableCell>
                    <DeleteEntryButton id={op.id} action={deleteCrushing} />
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
