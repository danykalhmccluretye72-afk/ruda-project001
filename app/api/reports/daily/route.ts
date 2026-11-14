import { buildDailyReport, percent, type FeedTotals } from '@/lib/daily-report'
import { getSession } from '@/lib/session'
import { formatShiftDate, parseShiftKey } from '@/lib/shift'

export const dynamic = 'force-dynamic'

const num = (value: number, digits = 2) => value.toFixed(digits).replace('.', ',')
const cell = (value: string) => `"${value.replace(/"/g, '""')}"`
const pct = (t: FeedTotals) => {
  const p = percent(t.factT, t.planT)
  return p === null ? '' : num(p, 1)
}
const feed = (t: FeedTotals) => [num(t.planT), num(t.factT), pct(t)]

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.user) return new Response('Требуется вход', { status: 401 })

  const search = new URL(request.url).searchParams
  const date = parseShiftKey(search.get('date') ?? undefined, '1')?.date
  if (!date) return new Response('Неверная дата', { status: 400 })

  const report = await buildDailyReport(date, { hideArchive: search.get('archive') === '0' })
  const { s1, s2, day } = report.shifts
  const lines: string[] = [cell(`Суточный отчёт за ${formatShiftDate(date)}, время Хабаровска`), '']

  lines.push(cell('Подача в переработку по штабелям'))
  lines.push(
    [
      'Штабель',
      'См.1 план, т',
      'См.1 факт, т',
      'См.1 %',
      'См.2 план, т',
      'См.2 факт, т',
      'См.2 %',
      'Сутки план, т',
      'Сутки факт, т',
      'Сутки %',
      'Au, г/т',
      'Металл, г',
    ]
      .map(cell)
      .join(';'),
  )
  for (const r of report.feedRows) {
    lines.push(
      [cell(r.name), ...feed(r.s1), ...feed(r.s2), ...feed(r.day), num(r.day.grade, 3), num(r.day.metalG, 1)].join(';'),
    )
  }
  lines.push([cell('Итого'), ...feed(s1), ...feed(s2), ...feed(day), num(day.grade, 3), num(day.metalG, 1)].join(';'))

  lines.push('', cell('Движение остатков за сутки — Перевальное'))
  lines.push(
    ['Штабель', 'Au, г/т', 'На начало, т', 'Поступление, т', 'Дробление приход, т', 'Дробление расход, т', 'Подача, т', 'Маркш. замер, т', 'На конец, т', 'Металл на конец, г']
      .map(cell)
      .join(';'),
  )
  const t = { opening: 0, received: 0, crushedIn: 0, crushedOut: 0, fed: 0, adjusted: 0, closing: 0, metal: 0 }
  for (const r of report.balanceRows) {
    const metal = r.closing * r.auGrade
    t.opening += r.opening
    t.received += r.received
    t.crushedIn += r.crushedIn
    t.crushedOut += r.crushedOut
    t.fed += r.fed
    t.adjusted += r.adjusted
    t.closing += r.closing
    t.metal += metal
    lines.push(
      [cell(r.name), num(r.auGrade, 3), num(r.opening), num(r.received), num(r.crushedIn), num(r.crushedOut), num(r.fed), num(r.adjusted), num(r.closing), num(metal, 1)].join(';'),
    )
  }
  lines.push(
    [
      cell('Итого'),
      num(t.closing > 0 ? t.metal / t.closing : 0, 3),
      num(t.opening),
      num(t.received),
      num(t.crushedIn),
      num(t.crushedOut),
      num(t.fed),
      num(t.adjusted),
      num(t.closing),
      num(t.metal, 1),
    ].join(';'),
  )

  // BOM + ';' so Excel with Russian locale opens the file correctly.
  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sutochny_otchet_${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
