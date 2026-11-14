import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { reportColumns, reportQuery, type ColumnKind, type ReportColumn, type ReportFilters } from '@/lib/report-columns'
import type { ReportSection, Row } from '@/lib/reports'
import { formatShiftDate } from '@/lib/shift'
import { cn, formatDateTime, formatGrade, formatMetal, formatPercent, formatTons } from '@/lib/utils'

const NUMERIC: ColumnKind[] = ['tons', 'signed', 'grade', 'metal', 'pct', 'buckets', 'int']

function Value({ col, value }: { col: ReportColumn; value: Row[string] | undefined }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>
  switch (col.kind) {
    case 'tons':
    case 'buckets':
      return Math.abs(value as number) < 0.05 ? <span className="text-muted-foreground">—</span> : <>{formatTons(value as number)}</>
    case 'signed': {
      const v = value as number
      if (Math.abs(v) < 0.05) return <span className="text-muted-foreground">—</span>
      return <span className={v > 0 ? 'text-success' : 'text-destructive'}>{v > 0 ? `+${formatTons(v)}` : `−${formatTons(-v)}`}</span>
    }
    case 'grade':
      return <>{formatGrade(value as number)}</>
    case 'metal':
      return <>{formatMetal(value as number)}</>
    case 'pct':
      return <>{formatPercent(value as number)}</>
    case 'datetime':
      return <span className="whitespace-nowrap">{formatDateTime(value as Date)}</span>
    case 'date':
      return <span className="whitespace-nowrap">{formatShiftDate(value as string)}</span>
    default:
      return <>{String(value)}</>
  }
}

export function ReportTable({ filters, section, limit }: { filters: ReportFilters; section: ReportSection; limit?: number }) {
  const columns = reportColumns(filters.site, filters.view)
  const rows = limit ? section.rows.slice(0, limit) : section.rows

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c) => {
            const active = filters.sort === c.key
            const nextDir = active && filters.dir === 'asc' ? 'desc' : active ? 'asc' : NUMERIC.includes(c.kind) || c.kind === 'datetime' ? 'desc' : 'asc'
            const Icon = !active ? ArrowUpDown : filters.dir === 'asc' ? ArrowUp : ArrowDown
            return (
              <TableHead
                key={c.key}
                className={cn(NUMERIC.includes(c.kind) && 'text-right')}
                aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <Link
                  href={`/reports?${reportQuery(filters, { sort: c.key, dir: nextDir })}`}
                  scroll={false}
                  className={cn(
                    'inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground',
                    active && 'text-foreground',
                    NUMERIC.includes(c.kind) && 'flex-row-reverse',
                  )}
                >
                  {c.label}
                  <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden="true" />
                </Link>
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={String(r.key)}>
            {columns.map((c, i) => (
              <TableCell
                key={c.key}
                className={cn(
                  NUMERIC.includes(c.kind) && 'text-right font-mono tabular-nums',
                  i === 0 && 'font-medium',
                  c.key === 'note' && 'max-w-64 truncate',
                )}
                title={c.key === 'note' && r.note ? String(r.note) : undefined}
              >
                <Value col={c} value={r[c.key]} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          {columns.map((c, i) => (
            <TableCell key={c.key} className={cn('font-semibold', NUMERIC.includes(c.kind) && 'text-right font-mono tabular-nums')}>
              {i === 0 ? 'Итого' : c.key in section.totals ? <Value col={c} value={section.totals[c.key]} /> : null}
            </TableCell>
          ))}
        </TableRow>
      </TableFooter>
    </Table>
  )
}
