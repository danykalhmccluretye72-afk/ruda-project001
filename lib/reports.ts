import 'server-only'
import { and, asc, eq, gte, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { db } from './db'
import {
  crushingLines,
  crushingOps,
  kirankanAdjustments,
  kirankanReceipts,
  kirankanShipments,
  kirankanStockpiles,
  loaders,
  oreFeeds,
  oreReceipts,
  shiftClosureLines,
  shiftClosures,
  shiftPlans,
  stockpileAdjustments,
  stockpiles,
} from './db/schema'
import { getPeriodBalanceReport, kirankanTotals } from './queries'
import {
  DEFAULT_SORT,
  JOURNAL_TYPES,
  SITE_SCOPES,
  reportColumns,
  type ReportFilters,
  type ReportScope,
  type ReportSite,
  type ReportView,
} from './report-columns'
import { formatShiftDate, getShift, shiftBounds, shiftDateOffset, type ShiftNo } from './shift'

export type Row = Record<string, string | number | Date | null>

export type ReportPile = { id: number; name: string; status: Exclude<ReportScope, 'all'> }

export const STATUS_LABELS: Record<ReportPile['status'], string> = {
  active: 'Активный',
  archived: 'Архивный',
  historical: 'Исторический',
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_REPORT_DAYS = 366

/* ---------- Параметры ---------- */

export function parseReportFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const get = (k: string) => {
    const v = sp[k]
    return Array.isArray(v) ? v[0] : v
  }
  const site: ReportSite = get('site') === 'kirankan' ? 'kirankan' : 'pereval'
  const viewRaw = get('view')
  const view: ReportView = viewRaw === 'journal' || viewRaw === 'shifts' ? viewRaw : 'summary'
  const today = getShift(new Date()).date

  let to = DATE_RE.test(get('to') ?? '') ? (get('to') as string) : today
  let from = DATE_RE.test(get('from') ?? '') ? (get('from') as string) : shiftDateOffset(to, -6)
  if (from > to) [from, to] = [to, from]
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS > MAX_REPORT_DAYS - 1) from = shiftDateOffset(to, -(MAX_REPORT_DAYS - 1))

  const scopeRaw = get('scope') as ReportScope | undefined
  const scope: ReportScope = scopeRaw && SITE_SCOPES[site].includes(scopeRaw) ? scopeRaw : 'all'
  const pileNum = Number(get('pile'))
  const pile = Number.isInteger(pileNum) && pileNum > 0 ? pileNum : null
  const typeRaw = get('type') ?? 'all'
  const type = JOURNAL_TYPES[site].some((t) => t.value === typeRaw) ? typeRaw : 'all'

  const keys = reportColumns(site, view).map((c) => c.key)
  const sortRaw = get('sort') ?? ''
  const sort = keys.includes(sortRaw) ? sortRaw : DEFAULT_SORT[view].sort
  const dirRaw = get('dir')
  const dir = dirRaw === 'asc' || dirRaw === 'desc' ? dirRaw : DEFAULT_SORT[view].dir

  return { site, view, from, to, scope, pile, type, sort, dir }
}

export function periodBounds(from: string, to: string) {
  return { start: shiftBounds({ date: from, shift: 1 }).start, end: shiftBounds({ date: to, shift: 2 }).end }
}

/* ---------- Штабели ---------- */

export async function getReportPiles(site: ReportSite): Promise<ReportPile[]> {
  if (site === 'kirankan') {
    const rows = await db.select().from(kirankanStockpiles).orderBy(asc(kirankanStockpiles.name))
    return rows.map((r) => ({ id: r.id, name: r.name, status: r.isHistorical ? 'historical' : 'active' }))
  }
  const rows = await db.select().from(stockpiles).orderBy(asc(stockpiles.name))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.isHistorical ? 'historical' : r.isActive ? 'active' : 'archived',
  }))
}

/* ---------- Журнал ---------- */

type JournalRow = Row & {
  at: Date
  shiftDate: string
  shiftNo: number
  type: string
  stockpileId: number
  tonnage: number
}

const typeLabel = (site: ReportSite, type: string) => JOURNAL_TYPES[site].find((t) => t.value === type)?.label ?? type

function journalRow(
  site: ReportSite,
  names: Map<number, string>,
  e: {
    key: string
    at: Date
    shiftDate?: string | null
    shiftNo?: number | null
    type: string
    stockpileId: number
    counterpartId?: number | null
    tonnage: number
    buckets?: number | null
    auGrade?: number | null
    loader?: string | null
    truck?: string | null
    ticket?: string | null
    note?: string | null
  },
): JournalRow {
  const shift = e.shiftDate && e.shiftNo ? { date: e.shiftDate, shift: e.shiftNo as ShiftNo } : getShift(e.at)
  return {
    key: e.key,
    at: e.at,
    shiftDate: shift.date,
    shiftNo: shift.shift,
    shiftLabel: `${formatShiftDate(shift.date)} · см. ${shift.shift}`,
    type: e.type,
    typeLabel: typeLabel(site, e.type),
    stockpileId: e.stockpileId,
    stockpile: names.get(e.stockpileId) ?? '—',
    counterpart: e.counterpartId ? (names.get(e.counterpartId) ?? '—') : null,
    tonnage: e.tonnage,
    buckets: e.buckets ?? null,
    auGrade: e.auGrade ?? null,
    loader: e.loader ?? null,
    truck: e.truck ?? null,
    ticket: e.ticket ?? null,
    note: e.note ?? null,
  }
}

async function getPerevalJournal(ids: number[], names: Map<number, string>, start: Date, end: Date) {
  const allowed = new Set(ids)
  const [receipts, feeds, crushing, closures, adjustments] = await Promise.all([
    db
      .select()
      .from(oreReceipts)
      .where(and(gte(oreReceipts.occurredAt, start), lt(oreReceipts.occurredAt, end), inArray(oreReceipts.stockpileId, ids))),
    db
      .select({
        id: oreFeeds.id,
        at: oreFeeds.occurredAt,
        stockpileId: oreFeeds.stockpileId,
        buckets: oreFeeds.bucketCount,
        weight: oreFeeds.bucketWeightT,
        au: oreFeeds.auGrade,
        shiftDate: oreFeeds.shiftDate,
        shiftNo: oreFeeds.shiftNo,
        loader: sql<string | null>`coalesce(${loaders.name}, ${oreFeeds.loader})`,
        note: oreFeeds.note,
      })
      .from(oreFeeds)
      .leftJoin(loaders, eq(loaders.id, oreFeeds.loaderId))
      .where(and(gte(oreFeeds.occurredAt, start), lt(oreFeeds.occurredAt, end), inArray(oreFeeds.stockpileId, ids))),
    db
      .select({
        id: crushingLines.id,
        at: crushingOps.occurredAt,
        shiftDate: crushingOps.shiftDate,
        shiftNo: crushingOps.shiftNo,
        sourceId: crushingLines.sourceStockpileId,
        targetId: crushingOps.targetStockpileId,
        buckets: crushingLines.bucketCount,
        weight: crushingOps.bucketWeightT,
        au: crushingLines.auGrade,
        loader: sql<string | null>`coalesce(${loaders.name}, ${crushingOps.loader})`,
        note: crushingOps.note,
      })
      .from(crushingLines)
      .innerJoin(crushingOps, eq(crushingOps.id, crushingLines.opId))
      .leftJoin(loaders, eq(loaders.id, crushingOps.loaderId))
      .where(
        and(
          gte(crushingOps.occurredAt, start),
          lt(crushingOps.occurredAt, end),
          or(inArray(crushingLines.sourceStockpileId, ids), inArray(crushingOps.targetStockpileId, ids)),
        ),
      ),
    db
      .select({
        id: shiftClosureLines.id,
        at: shiftClosures.occurredAt,
        shiftDate: shiftClosures.shiftDate,
        shiftNo: shiftClosures.shiftNo,
        stockpileId: shiftClosureLines.stockpileId,
        delta: shiftClosureLines.deltaT,
        au: shiftClosureLines.auGrade,
        note: shiftClosures.note,
      })
      .from(shiftClosureLines)
      .innerJoin(shiftClosures, eq(shiftClosures.id, shiftClosureLines.closureId))
      .where(and(gte(shiftClosures.occurredAt, start), lt(shiftClosures.occurredAt, end), inArray(shiftClosureLines.stockpileId, ids))),
    db
      .select()
      .from(stockpileAdjustments)
      .where(
        and(
          gte(stockpileAdjustments.occurredAt, start),
          lt(stockpileAdjustments.occurredAt, end),
          inArray(stockpileAdjustments.stockpileId, ids),
        ),
      ),
  ])

  const rows: JournalRow[] = []
  for (const r of receipts)
    rows.push(
      journalRow('pereval', names, {
        key: `r${r.id}`,
        at: r.occurredAt,
        type: 'receipt',
        stockpileId: r.stockpileId,
        tonnage: Number(r.netWeightT),
        truck: r.truckNumber,
        ticket: r.ticketNumber,
        note: r.note,
      }),
    )
  for (const r of feeds)
    rows.push(
      journalRow('pereval', names, {
        key: `f${r.id}`,
        at: r.at,
        shiftDate: r.shiftDate,
        shiftNo: r.shiftNo,
        type: 'feed',
        stockpileId: r.stockpileId,
        tonnage: -r.buckets * Number(r.weight),
        buckets: r.buckets,
        auGrade: Number(r.au),
        loader: r.loader,
        note: r.note,
      }),
    )
  for (const r of crushing) {
    const tonnage = r.buckets * Number(r.weight)
    const base = { at: r.at, shiftDate: r.shiftDate, shiftNo: r.shiftNo, buckets: r.buckets, auGrade: Number(r.au), loader: r.loader, note: r.note }
    if (allowed.has(r.sourceId))
      rows.push(
        journalRow('pereval', names, { ...base, key: `co${r.id}`, type: 'crushing_out', stockpileId: r.sourceId, counterpartId: r.targetId, tonnage: -tonnage }),
      )
    if (allowed.has(r.targetId))
      rows.push(
        journalRow('pereval', names, { ...base, key: `ci${r.id}`, type: 'crushing_in', stockpileId: r.targetId, counterpartId: r.sourceId, tonnage }),
      )
  }
  for (const r of closures)
    rows.push(
      journalRow('pereval', names, {
        key: `c${r.id}`,
        at: r.at,
        shiftDate: r.shiftDate,
        shiftNo: r.shiftNo,
        type: 'closure',
        stockpileId: r.stockpileId,
        tonnage: -Number(r.delta),
        auGrade: Number(r.au),
        note: r.note,
      }),
    )
  for (const r of adjustments)
    rows.push(
      journalRow('pereval', names, {
        key: `a${r.id}`,
        at: r.occurredAt,
        type: 'adjustment',
        stockpileId: r.stockpileId,
        tonnage: Number(r.deltaT),
        note: r.note,
      }),
    )
  return rows
}

async function getKirankanJournalRows(ids: number[], names: Map<number, string>, start: Date, end: Date) {
  const [receipts, shipments, adjustments] = await Promise.all([
    db
      .select()
      .from(kirankanReceipts)
      .where(and(gte(kirankanReceipts.occurredAt, start), lt(kirankanReceipts.occurredAt, end), inArray(kirankanReceipts.stockpileId, ids))),
    db
      .select()
      .from(kirankanShipments)
      .where(and(gte(kirankanShipments.occurredAt, start), lt(kirankanShipments.occurredAt, end), inArray(kirankanShipments.stockpileId, ids))),
    db
      .select()
      .from(kirankanAdjustments)
      .where(
        and(gte(kirankanAdjustments.occurredAt, start), lt(kirankanAdjustments.occurredAt, end), inArray(kirankanAdjustments.stockpileId, ids)),
      ),
  ])
  return [
    ...receipts.map((r) =>
      journalRow('kirankan', names, {
        key: `r${r.id}`,
        at: r.occurredAt,
        type: 'receipt',
        stockpileId: r.stockpileId,
        tonnage: Number(r.netWeightT),
        truck: r.truckNumber,
        ticket: r.ticketNumber,
        note: r.note,
      }),
    ),
    ...shipments.map((r) =>
      journalRow('kirankan', names, {
        key: `s${r.id}`,
        at: r.occurredAt,
        type: 'shipment',
        stockpileId: r.stockpileId,
        tonnage: -Number(r.netWeightT),
        auGrade: Number(r.auGrade),
        truck: r.truckNumber,
        ticket: r.ticketNumber,
        note: r.note,
      }),
    ),
    ...adjustments.map((r) =>
      journalRow('kirankan', names, {
        key: `a${r.id}`,
        at: r.occurredAt,
        type: 'adjustment',
        stockpileId: r.stockpileId,
        tonnage: Number(r.deltaT),
        note: r.note,
      }),
    ),
  ]
}

/* ---------- Сводка ---------- */

async function getSummaryRows(site: ReportSite, piles: ReportPile[], start: Date, end: Date): Promise<Row[]> {
  const byId = new Map(piles.map((p) => [p.id, p]))
  if (site === 'pereval') {
    const rows = await getPeriodBalanceReport(start, end)
    return rows
      .filter((r) => byId.has(r.id))
      .map((r) => ({
        key: String(r.id),
        name: r.name,
        status: STATUS_LABELS[byId.get(r.id)!.status],
        opening: r.opening,
        received: r.received,
        crushedIn: r.crushedIn,
        crushedOut: r.crushedOut,
        out: r.fed,
        adjusted: r.adjusted,
        closing: r.closing,
        auGrade: r.auGrade,
        metal: Math.max(0, r.closing) * r.auGrade,
      }))
  }
  const [before, period, grades] = await Promise.all([
    kirankanTotals(undefined, start),
    kirankanTotals(start, end),
    db.select({ id: kirankanStockpiles.id, au: kirankanStockpiles.auGrade }).from(kirankanStockpiles),
  ])
  const gradeMap = new Map(grades.map((g) => [g.id, Number(g.au)]))
  const v = (m: Map<number, number>, id: number) => m.get(id) ?? 0
  return piles.map((p) => {
    const opening = v(before.received, p.id) - v(before.shipped, p.id) + v(before.adjusted, p.id)
    const received = v(period.received, p.id)
    const out = v(period.shipped, p.id)
    const adjusted = v(period.adjusted, p.id)
    const closing = opening + received - out + adjusted
    const auGrade = gradeMap.get(p.id) ?? 0
    return {
      key: String(p.id),
      name: p.name,
      status: STATUS_LABELS[p.status],
      opening,
      received,
      out,
      adjusted,
      closing,
      auGrade,
      metal: Math.max(0, closing) * auGrade,
    }
  })
}

/* ---------- По сменам ---------- */

async function getShiftRows(site: ReportSite, journal: JournalRow[], ids: number[], from: string, to: string): Promise<Row[]> {
  const map = new Map<string, Row & { feedT: number }>()
  const ensure = (date: string, shift: number) => {
    const k = `${date}-${shift}`
    let r = map.get(k)
    if (!r) {
      r =
        site === 'pereval'
          ? { key: k, shiftDate: date, shiftNo: shift, received: 0, crushedIn: 0, crushedOut: 0, planT: 0, fed: 0, pct: null, grade: null, metal: 0, adjusted: 0, ops: 0, feedT: 0 }
          : { key: k, shiftDate: date, shiftNo: shift, received: 0, shipped: 0, adjusted: 0, ops: 0, feedT: 0 }
      map.set(k, r)
    }
    return r
  }
  const add = (r: Row, key: string, v: number) => {
    r[key] = (r[key] as number) + v
  }

  for (const e of journal) {
    const r = ensure(e.shiftDate, e.shiftNo)
    add(r, 'ops', 1)
    switch (e.type) {
      case 'receipt':
        add(r, 'received', e.tonnage)
        break
      case 'shipment':
        add(r, 'shipped', -e.tonnage)
        break
      case 'crushing_in':
        add(r, 'crushedIn', e.tonnage)
        break
      case 'crushing_out':
        add(r, 'crushedOut', -e.tonnage)
        break
      case 'feed':
        add(r, 'fed', -e.tonnage)
        r.feedT += -e.tonnage
        add(r, 'metal', -e.tonnage * ((e.auGrade as number | null) ?? 0))
        break
      case 'closure':
        add(r, 'fed', -e.tonnage)
        break
      case 'adjustment':
        add(r, 'adjusted', e.tonnage)
        break
    }
  }

  if (site === 'pereval' && ids.length > 0) {
    const plans = await db
      .select({ date: shiftPlans.shiftDate, shift: shiftPlans.shiftNo, planned: sql<string>`sum(${shiftPlans.plannedT})` })
      .from(shiftPlans)
      .where(and(gte(shiftPlans.shiftDate, from), lte(shiftPlans.shiftDate, to), inArray(shiftPlans.stockpileId, ids)))
      .groupBy(shiftPlans.shiftDate, shiftPlans.shiftNo)
    for (const p of plans) ensure(p.date, p.shift).planT = Number(p.planned)
    for (const r of map.values()) {
      const plan = r.planT as number
      r.pct = plan > 0 ? ((r.fed as number) / plan) * 100 : null
      r.grade = r.feedT > 0 ? (r.metal as number) / r.feedT : null
    }
  }
  return [...map.values()]
}

/* ---------- Сортировка и итоги ---------- */

function compare(a: Row[string], b: Row[string]) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'ru', { numeric: true })
}

function sortRows(rows: Row[], sort: string, dir: 'asc' | 'desc') {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((x, y) => {
    let c = compare(x[sort], y[sort])
    if (c === 0 && sort === 'shiftDate') c = compare(x.shiftNo, y.shiftNo)
    if (c === 0 && x.at instanceof Date && y.at instanceof Date) c = x.at.getTime() - y.at.getTime()
    return c * sign
  })
}

function totals(site: ReportSite, view: ReportView, rows: Row[]): Row {
  const out: Row = {}
  for (const col of reportColumns(site, view)) {
    if (col.total) out[col.key] = rows.reduce((s, r) => s + ((r[col.key] as number | null) ?? 0), 0)
  }
  if (view === 'summary') {
    const positive = rows.reduce((s, r) => s + Math.max(0, r.closing as number), 0)
    out.auGrade = positive > 0 ? (out.metal as number) / positive : 0
  }
  if (view === 'shifts' && site === 'pereval') {
    const feedT = rows.reduce((s, r) => s + ((r.feedT as number) ?? 0), 0)
    out.grade = feedT > 0 ? (out.metal as number) / feedT : null
    out.pct = (out.planT as number) > 0 ? ((out.fed as number) / (out.planT as number)) * 100 : null
  }
  return out
}

/* ---------- Отчёт целиком ---------- */

export type ReportSection = { rows: Row[]; totals: Row }
export type BuiltReport = {
  filters: ReportFilters
  piles: ReportPile[]
  selectedPiles: ReportPile[]
  summary: ReportSection
  journal: ReportSection
  shifts: ReportSection
}

export async function buildReport(f: ReportFilters): Promise<BuiltReport> {
  const piles = await getReportPiles(f.site)
  const selectedPiles = piles.filter((p) => (f.scope === 'all' || p.status === f.scope) && (!f.pile || p.id === f.pile))
  const ids = selectedPiles.map((p) => p.id)
  const names = new Map(piles.map((p) => [p.id, p.name]))
  const { start, end } = periodBounds(f.from, f.to)

  const empty: ReportSection = { rows: [], totals: {} }
  if (ids.length === 0) return { filters: f, piles, selectedPiles, summary: empty, journal: empty, shifts: empty }

  const [summaryRows, journalAll] = await Promise.all([
    getSummaryRows(f.site, selectedPiles, start, end),
    f.site === 'pereval' ? getPerevalJournal(ids, names, start, end) : getKirankanJournalRows(ids, names, start, end),
  ])
  const shiftRows = await getShiftRows(f.site, journalAll, ids, f.from, f.to)
  const journalRows = f.type === 'all' ? journalAll : journalAll.filter((r) => r.type === f.type)

  const sortFor = (view: ReportView) => (view === f.view ? { sort: f.sort, dir: f.dir } : DEFAULT_SORT[view])
  const section = (view: ReportView, rows: Row[]): ReportSection => {
    const s = sortFor(view)
    return { rows: sortRows(rows, s.sort, s.dir), totals: totals(f.site, view, rows) }
  }

  return {
    filters: f,
    piles,
    selectedPiles,
    summary: section('summary', summaryRows),
    journal: section('journal', journalRows),
    shifts: section('shifts', shiftRows),
  }
}
