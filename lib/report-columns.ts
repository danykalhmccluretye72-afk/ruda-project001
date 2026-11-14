export type ReportSite = 'pereval' | 'kirankan'
export type ReportView = 'summary' | 'journal' | 'shifts'
export type ReportScope = 'all' | 'active' | 'archived' | 'historical'
export type SortDir = 'asc' | 'desc'

export type ReportFilters = {
  site: ReportSite
  view: ReportView
  from: string
  to: string
  scope: ReportScope
  pile: number | null
  type: string
  sort: string
  dir: SortDir
}

export type ColumnKind = 'text' | 'tons' | 'signed' | 'grade' | 'metal' | 'datetime' | 'date' | 'pct' | 'buckets' | 'int'

export type ReportColumn = { key: string; label: string; kind: ColumnKind; total?: boolean; width?: number }

export const SITE_LABELS: Record<ReportSite, string> = { pereval: 'Перевальное', kirankan: 'Киранкан' }

export const VIEW_LABELS: Record<ReportView, string> = {
  summary: 'Сводка по штабелям',
  journal: 'Журнал операций',
  shifts: 'По сменам',
}

export const VIEW_DESCRIPTIONS: Record<ReportView, string> = {
  summary: 'Остаток на начало и конец периода, движение и маркшейдерские корректировки по каждому штабелю.',
  journal: 'Каждая операция за период: поступления, подача, дробление, корректировки.',
  shifts: 'Итоги движения по каждой смене периода.',
}

export const SCOPE_LABELS: Record<ReportScope, string> = {
  all: 'Все штабели',
  active: 'Активные',
  archived: 'Архивные',
  historical: 'Исторические',
}

export const SITE_SCOPES: Record<ReportSite, ReportScope[]> = {
  pereval: ['all', 'active', 'archived', 'historical'],
  kirankan: ['all', 'active', 'historical'],
}

export const JOURNAL_TYPES: Record<ReportSite, { value: string; label: string }[]> = {
  pereval: [
    { value: 'receipt', label: 'Поступление' },
    { value: 'feed', label: 'Подача' },
    { value: 'crushing_in', label: 'Дробление — приход' },
    { value: 'crushing_out', label: 'Дробление — расход' },
    { value: 'closure', label: 'Закрытие смены — корр. подачи' },
    { value: 'adjustment', label: 'Маркшейдерский замер' },
  ],
  kirankan: [
    { value: 'receipt', label: 'Поступление' },
    { value: 'shipment', label: 'Отгрузка' },
    { value: 'adjustment', label: 'Маркшейдерский замер' },
  ],
}

export function reportColumns(site: ReportSite, view: ReportView): ReportColumn[] {
  if (view === 'summary') {
    return site === 'pereval'
      ? [
          { key: 'name', label: 'Штабель', kind: 'text', width: 22 },
          { key: 'status', label: 'Статус', kind: 'text', width: 13 },
          { key: 'opening', label: 'На начало, т', kind: 'tons', total: true },
          { key: 'received', label: 'Поступление, т', kind: 'tons', total: true },
          { key: 'crushedIn', label: 'Дробл. приход, т', kind: 'tons', total: true },
          { key: 'crushedOut', label: 'Дробл. расход, т', kind: 'tons', total: true },
          { key: 'out', label: 'Подача, т', kind: 'tons', total: true },
          { key: 'adjusted', label: 'Маркш. замер, т', kind: 'signed', total: true },
          { key: 'closing', label: 'На конец, т', kind: 'tons', total: true },
          { key: 'auGrade', label: 'Au, г/т', kind: 'grade' },
          { key: 'metal', label: 'Металл на конец, г', kind: 'metal', total: true },
        ]
      : [
          { key: 'name', label: 'Штабель', kind: 'text', width: 22 },
          { key: 'status', label: 'Статус', kind: 'text', width: 13 },
          { key: 'opening', label: 'На начало, т', kind: 'tons', total: true },
          { key: 'received', label: 'Поступление, т', kind: 'tons', total: true },
          { key: 'out', label: 'Отгрузка, т', kind: 'tons', total: true },
          { key: 'adjusted', label: 'Маркш. замер, т', kind: 'signed', total: true },
          { key: 'closing', label: 'На конец, т', kind: 'tons', total: true },
          { key: 'auGrade', label: 'Au, г/т', kind: 'grade' },
          { key: 'metal', label: 'Металл на конец, г', kind: 'metal', total: true },
        ]
  }
  if (view === 'journal') {
    return site === 'pereval'
      ? [
          { key: 'at', label: 'Дата и время', kind: 'datetime', width: 17 },
          { key: 'shiftLabel', label: 'Смена', kind: 'text', width: 16 },
          { key: 'typeLabel', label: 'Операция', kind: 'text', width: 24 },
          { key: 'stockpile', label: 'Штабель', kind: 'text', width: 20 },
          { key: 'counterpart', label: 'Связанный штабель', kind: 'text', width: 20 },
          { key: 'tonnage', label: 'Масса, т (±)', kind: 'signed', total: true },
          { key: 'buckets', label: 'Ковшей', kind: 'buckets', total: true },
          { key: 'auGrade', label: 'Au, г/т', kind: 'grade' },
          { key: 'loader', label: 'Погрузчик', kind: 'text', width: 16 },
          { key: 'truck', label: 'Самосвал', kind: 'text', width: 12 },
          { key: 'ticket', label: 'Талон', kind: 'text', width: 12 },
          { key: 'note', label: 'Примечание', kind: 'text', width: 30 },
        ]
      : [
          { key: 'at', label: 'Дата и время', kind: 'datetime', width: 17 },
          { key: 'shiftLabel', label: 'Смена', kind: 'text', width: 16 },
          { key: 'typeLabel', label: 'Операция', kind: 'text', width: 22 },
          { key: 'stockpile', label: 'Штабель', kind: 'text', width: 20 },
          { key: 'tonnage', label: 'Масса, т (±)', kind: 'signed', total: true },
          { key: 'auGrade', label: 'Au, г/т', kind: 'grade' },
          { key: 'truck', label: 'Самосвал', kind: 'text', width: 12 },
          { key: 'ticket', label: 'Талон', kind: 'text', width: 12 },
          { key: 'note', label: 'Примечание', kind: 'text', width: 30 },
        ]
  }
  return site === 'pereval'
    ? [
        { key: 'shiftDate', label: 'Дата', kind: 'date', width: 12 },
        { key: 'shiftNo', label: 'Смена', kind: 'int' },
        { key: 'received', label: 'Поступление, т', kind: 'tons', total: true },
        { key: 'crushedIn', label: 'Дробл. приход, т', kind: 'tons', total: true },
        { key: 'crushedOut', label: 'Дробл. расход, т', kind: 'tons', total: true },
        { key: 'planT', label: 'План подачи, т', kind: 'tons', total: true },
        { key: 'fed', label: 'Подача, т', kind: 'tons', total: true },
        { key: 'pct', label: '% плана', kind: 'pct' },
        { key: 'grade', label: 'Au подачи, г/т', kind: 'grade' },
        { key: 'metal', label: 'Металл подачи, г', kind: 'metal', total: true },
        { key: 'adjusted', label: 'Маркш. замер, т', kind: 'signed', total: true },
        { key: 'ops', label: 'Операций', kind: 'int', total: true },
      ]
    : [
        { key: 'shiftDate', label: 'Дата', kind: 'date', width: 12 },
        { key: 'shiftNo', label: 'Смена', kind: 'int' },
        { key: 'received', label: 'Поступление, т', kind: 'tons', total: true },
        { key: 'shipped', label: 'Отгрузка, т', kind: 'tons', total: true },
        { key: 'adjusted', label: 'Маркш. замер, т', kind: 'signed', total: true },
        { key: 'ops', label: 'Операций', kind: 'int', total: true },
      ]
}

export const DEFAULT_SORT: Record<ReportView, { sort: string; dir: SortDir }> = {
  summary: { sort: 'name', dir: 'asc' },
  journal: { sort: 'at', dir: 'desc' },
  shifts: { sort: 'shiftDate', dir: 'desc' },
}

export function reportQuery(f: ReportFilters, patch: Partial<ReportFilters> = {}) {
  const next = { ...f, ...patch }
  const params = new URLSearchParams({
    site: next.site,
    view: next.view,
    from: next.from,
    to: next.to,
    scope: next.scope,
    sort: next.sort,
    dir: next.dir,
  })
  if (next.pile) params.set('pile', String(next.pile))
  if (next.type !== 'all') params.set('type', next.type)
  return params.toString()
}
