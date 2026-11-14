import { SITE_LABELS } from '@/lib/report-columns'
import { buildReportWorkbook } from '@/lib/report-excel'
import { buildReport, parseReportFilters } from '@/lib/reports'
import { canEdit, normalizeRole } from '@/lib/roles'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.user) return new Response('Требуется вход', { status: 401 })
  if (!canEdit(normalizeRole(session.user.role))) return new Response('Недостаточно прав', { status: 403 })

  const url = new URL(request.url)
  const filters = parseReportFilters(Object.fromEntries(url.searchParams))
  const report = await buildReport(filters)
  const buffer = await buildReportWorkbook(report)

  const name = `Отчёт_${SITE_LABELS[filters.site]}_${filters.from}_${filters.to}.xlsx`
  const ascii = `report_${filters.site}_${filters.from}_${filters.to}.xlsx`
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
