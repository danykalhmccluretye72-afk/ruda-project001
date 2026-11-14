import 'server-only'
import ExcelJS from 'exceljs'
import {
  JOURNAL_TYPES,
  SCOPE_LABELS,
  SITE_LABELS,
  VIEW_LABELS,
  reportColumns,
  type ColumnKind,
  type ReportView,
} from './report-columns'
import type { BuiltReport, Row } from './reports'
import { KHV_OFFSET_MS, formatShiftDate } from './shift'

const FORMATS: Partial<Record<ColumnKind, string>> = {
  tons: '#,##0.0',
  signed: '+#,##0.0;-#,##0.0;0.0',
  grade: '0.00',
  metal: '#,##0',
  datetime: 'dd.mm.yyyy hh:mm',
  date: 'dd.mm.yyyy',
  pct: '0%',
  buckets: '#,##0.0',
  int: '0',
}

/** Excel не хранит часовой пояс — сдвигаем на Хабаровск, чтобы в ячейке было местное время. */
const khv = (d: Date) => new Date(d.getTime() + KHV_OFFSET_MS)

function cellValue(kind: ColumnKind, v: Row[string] | undefined) {
  if (v === null || v === undefined) return null
  if (kind === 'datetime' && v instanceof Date) return khv(v)
  if (kind === 'date' && typeof v === 'string') return new Date(`${v}T00:00:00Z`)
  if (kind === 'pct' && typeof v === 'number') return v / 100
  return v
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E2D0' } }
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EFE4' } }

function addSheet(wb: ExcelJS.Workbook, report: BuiltReport, view: ReportView) {
  const { site } = report.filters
  const section = report[view]
  const columns = reportColumns(site, view)
  const ws = wb.addWorksheet(VIEW_LABELS[view], { views: [{ state: 'frozen', ySplit: 1 }] })

  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width ?? Math.max(12, c.label.length + 2),
    style: FORMATS[c.kind] ? { numFmt: FORMATS[c.kind] } : {},
  }))
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.fill = HEADER_FILL
  header.alignment = { vertical: 'middle', wrapText: true }
  header.height = 30

  for (const r of section.rows) {
    ws.addRow(Object.fromEntries(columns.map((c) => [c.key, cellValue(c.kind, r[c.key])])))
  }
  if (section.rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: section.rows.length + 1, column: columns.length } }
    const total = ws.addRow(
      Object.fromEntries(
        columns.map((c, i) => [c.key, i === 0 ? 'Итого' : c.key in section.totals ? cellValue(c.kind, section.totals[c.key]) : null]),
      ),
    )
    total.font = { bold: true }
    total.fill = TOTAL_FILL
  } else {
    ws.addRow([view === 'journal' ? 'Операций за период нет' : 'Нет данных за период'])
  }
}

export async function buildReportWorkbook(report: BuiltReport) {
  const f = report.filters
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Учёт руды'
  wb.created = new Date()

  const params = wb.addWorksheet('Параметры')
  params.columns = [
    { key: 'k', width: 24 },
    { key: 'v', width: 60 },
  ]
  const pileName = f.pile ? (report.piles.find((p) => p.id === f.pile)?.name ?? '—') : 'Все'
  const typeName = f.type === 'all' ? 'Все' : (JOURNAL_TYPES[f.site].find((t) => t.value === f.type)?.label ?? f.type)
  const rows: [string, string][] = [
    ['Участок', SITE_LABELS[f.site]],
    ['Период', `${formatShiftDate(f.from)} — ${formatShiftDate(f.to)}`],
    ['Границы периода', `с 19:00 ${formatShiftDate(f.from)} (смена 1) по 19:00 ${formatShiftDate(f.to)} (конец смены 2), время Хабаровска`],
    ['Вид штабелей', SCOPE_LABELS[f.scope]],
    ['Штабель', pileName],
    ['Тип операций (журнал)', typeName],
    ['Штабелей в выборке', String(report.selectedPiles.length)],
    ['Сформирован', new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Vladivostok' }).format(new Date())],
    ['Примечание', 'Маркшейдерский замер — отдельная корректировка массы, не входит в поступление и подачу.'],
  ]
  const title = params.addRow([`Отчёт по штабелям — ${SITE_LABELS[f.site]}`])
  title.font = { bold: true, size: 14 }
  params.addRow([])
  for (const [k, v] of rows) params.addRow([k, v]).getCell(1).font = { bold: true }

  const order: ReportView[] = [f.view, ...(['summary', 'journal', 'shifts'] as ReportView[]).filter((v) => v !== f.view)]
  for (const view of order) addSheet(wb, report, view)

  return wb.xlsx.writeBuffer()
}
