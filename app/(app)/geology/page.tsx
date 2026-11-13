import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getBalances, getKirankanBalances } from '@/lib/queries'
import { requireViewerPage } from '@/lib/session'
import { getShift } from '@/lib/shift'
import { formatTons } from '@/lib/utils'

export const metadata: Metadata = { title: 'Геология' }
export const dynamic = 'force-dynamic'

type Row = { id: number; name: string; balance: number; auGrade: number }

function GradeTable({ title, rows }: { title: string; rows: Row[] }) {
  const tons = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const metal = rows.reduce((s, r) => s + Math.max(0, r.balance) * r.auGrade, 0)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Штабель</TableHead>
              <TableHead className="text-right">Остаток, т</TableHead>
              <TableHead className="text-right">Au, г/т</TableHead>
              <TableHead className="text-right">Металл, кг</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Нет штабелей
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{formatTons(r.balance)}</TableCell>
                  <TableCell className="text-right font-mono">{r.auGrade.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">{((Math.max(0, r.balance) * r.auGrade) / 1000).toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Итого</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatTons(tons)}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{tons > 0 ? (metal / tons).toFixed(2) : '—'}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{(metal / 1000).toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </section>
  )
}

export default async function GeologyPage() {
  await requireViewerPage()
  const [perevalnoe, kirankan] = await Promise.all([getBalances(), getKirankanBalances(getShift(new Date()))])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Геология"
        description="Содержание золота и запасы металла в штабелях по текущим остаткам."
      />
      <GradeTable
        title="Перевальное"
        rows={perevalnoe.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name, balance: p.balance, auGrade: p.auGrade }))}
      />
      <GradeTable
        title="Киранкан"
        rows={kirankan.map((p) => ({ id: p.id, name: p.name, balance: p.balance, auGrade: p.auGrade }))}
      />
    </div>
  )
}
