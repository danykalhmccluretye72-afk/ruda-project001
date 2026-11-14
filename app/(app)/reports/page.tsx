import { Download } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { ReportFilters } from '@/components/report-filters'
import { ReportTable } from '@/components/report-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_SORT, SCOPE_LABELS, SITE_LABELS, VIEW_DESCRIPTIONS, VIEW_LABELS, reportQuery, type ReportView } from '@/lib/report-columns'
import { buildReport, getReportPiles, parseReportFilters } from '@/lib/reports'
import { requireOperatorPage } from '@/lib/session'
import { formatShiftDate, getShift } from '@/lib/shift'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const UI_LIMIT = 1000
const VIEWS: ReportView[] = ['summary', 'journal', 'shifts']

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireOperatorPage()
  const filters = parseReportFilters(await searchParams)
  const today = getShift(new Date()).date
  const [report, perevalPiles, kirankanPiles] = await Promise.all([
    buildReport(filters),
    getReportPiles('pereval'),
    getReportPiles('kirankan'),
  ])
  const section = report[filters.view]
  const pileName = filters.pile ? report.piles.find((p) => p.id === filters.pile)?.name : null
  const exportHref = `/api/reports/export?${reportQuery(filters)}`

  return (
    <>
      <PageHeader
        title="Отчёты"
        description="Выборки по активным, архивным и историческим штабелям за любой период с сортировкой и выгрузкой в Excel."
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <ReportFilters filters={filters} piles={{ pereval: perevalPiles, kirankan: kirankanPiles }} today={today} />
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Вид отчёта" className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`/reports?${reportQuery(filters, { view: v, ...DEFAULT_SORT[v] })}`}
              aria-current={filters.view === v ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                filters.view === v && 'bg-background text-foreground shadow-sm',
              )}
            >
              {VIEW_LABELS[v]}
            </Link>
          ))}
        </nav>
        <Button asChild>
          <a href={exportHref} download>
            <Download className="size-4" aria-hidden="true" />
            Выгрузить в Excel (.xlsx)
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {VIEW_LABELS[filters.view]} — {SITE_LABELS[filters.site]}
          </CardTitle>
          <CardDescription className="text-pretty">
            {formatShiftDate(filters.from)} — {formatShiftDate(filters.to)} · {SCOPE_LABELS[filters.scope]}
            {pileName ? ` · ${pileName}` : ''} · {section.rows.length} строк. {VIEW_DESCRIPTIONS[filters.view]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {section.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {report.selectedPiles.length === 0 ? 'Под выбранные условия не попал ни один штабель.' : 'За выбранный период данных нет.'}
            </p>
          ) : (
            <>
              <ReportTable filters={filters} section={section} limit={UI_LIMIT} />
              {section.rows.length > UI_LIMIT ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Показаны первые {UI_LIMIT} из {section.rows.length} строк. Полная выборка — в выгрузке Excel.
                </p>
              ) : null}
            </>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Период: с 19:00 дня перед {formatShiftDate(filters.from)} (начало смены 1) до 19:00 {formatShiftDate(filters.to)}{' '}
            (конец смены 2), время Хабаровска. Маркшейдерский замер показан отдельно и не входит в поступление и подачу. В
            Excel-файле — все три вида отчёта отдельными листами с фильтрами и итогами.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
