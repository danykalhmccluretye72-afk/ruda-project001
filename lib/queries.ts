import 'server-only'
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
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
  stockpiles,
} from './db/schema'
import { shiftBounds, type ShiftKey, type ShiftNo } from './shift'

export type Stockpile = {
  id: number
  name: string
  initialTonnage: number
  auGrade: number
  isActive: boolean
}

export async function getStockpiles(options: { activeOnly?: boolean } = {}): Promise<Stockpile[]> {
  const rows = await db
    .select()
    .from(stockpiles)
    .where(options.activeOnly ? eq(stockpiles.isActive, true) : undefined)
    .orderBy(asc(stockpiles.name))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    initialTonnage: Number(r.initialTonnage),
    auGrade: Number(r.auGrade),
    isActive: r.isActive,
  }))
}

export type Loader = { id: number; name: string; bucketWeightT: number; isActive: boolean }

export async function getLoaders(options: { activeOnly?: boolean } = {}): Promise<Loader[]> {
  const rows = await db
    .select()
    .from(loaders)
    .where(options.activeOnly ? eq(loaders.isActive, true) : undefined)
    .orderBy(asc(loaders.name))
  return rows.map((r) => ({ id: r.id, name: r.name, bucketWeightT: Number(r.bucketWeightT), isActive: r.isActive }))
}

export type StockpileBalance = Stockpile & {
  received: number
  fed: number
  crushedIn: number
  crushedOut: number
  balance: number
}

const crushLineTonnage = sql<string>`coalesce(sum(${crushingLines.bucketCount} * ${crushingOps.bucketWeightT}), 0)`

/** Остатки по штабелям. `until` — учитывать только движения строго раньше этого момента. */
export async function getBalances(until?: Date): Promise<StockpileBalance[]> {
  const [piles, receiptTotals, feedTotals, crushInTotals, crushOutTotals, closureTotals] = await Promise.all([
    getStockpiles(),
    db
      .select({ stockpileId: oreReceipts.stockpileId, total: sql<string>`coalesce(sum(${oreReceipts.netWeightT}), 0)` })
      .from(oreReceipts)
      .where(until ? lt(oreReceipts.occurredAt, until) : undefined)
      .groupBy(oreReceipts.stockpileId),
    db
      .select({
        stockpileId: oreFeeds.stockpileId,
        total: sql<string>`coalesce(sum(${oreFeeds.bucketCount} * ${oreFeeds.bucketWeightT}), 0)`,
      })
      .from(oreFeeds)
      .where(until ? lt(oreFeeds.occurredAt, until) : undefined)
      .groupBy(oreFeeds.stockpileId),
    db
      .select({ stockpileId: crushingOps.targetStockpileId, total: crushLineTonnage })
      .from(crushingLines)
      .innerJoin(crushingOps, eq(crushingOps.id, crushingLines.opId))
      .where(until ? lt(crushingOps.occurredAt, until) : undefined)
      .groupBy(crushingOps.targetStockpileId),
    db
      .select({ stockpileId: crushingLines.sourceStockpileId, total: crushLineTonnage })
      .from(crushingLines)
      .innerJoin(crushingOps, eq(crushingOps.id, crushingLines.opId))
      .where(until ? lt(crushingOps.occurredAt, until) : undefined)
      .groupBy(crushingLines.sourceStockpileId),
    db
      .select({
        stockpileId: shiftClosureLines.stockpileId,
        total: sql<string>`coalesce(sum(${shiftClosureLines.deltaT}), 0)`,
      })
      .from(shiftClosureLines)
      .innerJoin(shiftClosures, eq(shiftClosures.id, shiftClosureLines.closureId))
      .where(until ? lt(shiftClosures.occurredAt, until) : undefined)
      .groupBy(shiftClosureLines.stockpileId),
  ])

  const toMap = (rows: { stockpileId: number; total: string }[]) =>
    new Map(rows.map((r) => [r.stockpileId, Number(r.total)]))
  const receivedMap = toMap(receiptTotals)
  const fedMap = toMap(feedTotals)
  // Корректировки закрытия смены входят в «подано»: досписание увеличивает, возврат излишка уменьшает.
  for (const [id, delta] of toMap(closureTotals)) fedMap.set(id, (fedMap.get(id) ?? 0) + delta)
  const inMap = toMap(crushInTotals)
  const outMap = toMap(crushOutTotals)

  return piles.map((p) => {
    const received = receivedMap.get(p.id) ?? 0
    const fed = fedMap.get(p.id) ?? 0
    const crushedIn = inMap.get(p.id) ?? 0
    const crushedOut = outMap.get(p.id) ?? 0
    return {
      ...p,
      received,
      fed,
      crushedIn,
      crushedOut,
      balance: p.initialTonnage + received + crushedIn - fed - crushedOut,
    }
  })
}

export type ShiftBalanceRow = {
  id: number
  name: string
  isActive: boolean
  auGrade: number
  opening: number
  received: number
  crushedIn: number
  crushedOut: number
  fed: number
  closing: number
}

/** Остаток на начало и конец смены и движение за смену. */
export async function getShiftBalanceReport(key: ShiftKey): Promise<ShiftBalanceRow[]> {
  const { start, end } = shiftBounds(key)
  const [opening, closing] = await Promise.all([getBalances(start), getBalances(end)])
  const openMap = new Map(opening.map((b) => [b.id, b]))
  return closing.map((c) => {
    const o = openMap.get(c.id)
    return {
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      auGrade: c.auGrade,
      opening: o?.balance ?? c.initialTonnage,
      received: c.received - (o?.received ?? 0),
      crushedIn: c.crushedIn - (o?.crushedIn ?? 0),
      crushedOut: c.crushedOut - (o?.crushedOut ?? 0),
      fed: c.fed - (o?.fed ?? 0),
      closing: c.balance,
    }
  })
}

export async function getRecentCrushing(limit = 50) {
  const ops = await db
    .select({
      id: crushingOps.id,
      occurredAt: crushingOps.occurredAt,
      shiftDate: crushingOps.shiftDate,
      shiftNo: crushingOps.shiftNo,
      targetName: stockpiles.name,
      loaderName: sql<string | null>`coalesce(${loaders.name}, ${crushingOps.loader})`,
      bucketWeightT: crushingOps.bucketWeightT,
      note: crushingOps.note,
    })
    .from(crushingOps)
    .leftJoin(stockpiles, eq(stockpiles.id, crushingOps.targetStockpileId))
    .leftJoin(loaders, eq(loaders.id, crushingOps.loaderId))
    .orderBy(desc(crushingOps.occurredAt), desc(crushingOps.id))
    .limit(limit)
  if (ops.length === 0) return []

  const lines = await db
    .select({
      opId: crushingLines.opId,
      sourceName: stockpiles.name,
      bucketCount: crushingLines.bucketCount,
      auGrade: crushingLines.auGrade,
    })
    .from(crushingLines)
    .leftJoin(stockpiles, eq(stockpiles.id, crushingLines.sourceStockpileId))
    .where(inArray(crushingLines.opId, ops.map((o) => o.id)))
    .orderBy(asc(crushingLines.id))

  return ops.map((op) => {
    const bucketWeightT = Number(op.bucketWeightT)
    const sources = lines
      .filter((l) => l.opId === op.id)
      .map((l) => ({
        name: l.sourceName ?? '—',
        buckets: l.bucketCount,
        tonnage: l.bucketCount * bucketWeightT,
        auGrade: Number(l.auGrade),
      }))
    const tonnage = sources.reduce((s, l) => s + l.tonnage, 0)
    const metal = sources.reduce((s, l) => s + l.tonnage * l.auGrade, 0)
    return {
      id: op.id,
      occurredAt: op.occurredAt.toISOString(),
      shiftNo: op.shiftNo,
      targetName: op.targetName ?? '—',
      loaderName: op.loaderName,
      bucketWeightT,
      note: op.note,
      sources,
      buckets: sources.reduce((s, l) => s + l.buckets, 0),
      tonnage,
      grade: tonnage > 0 ? metal / tonnage : 0,
    }
  })
}

export type BlendLine = {
  stockpileId: number
  stockpileName: string
  tonnage: number
  buckets: number
  metalG: number
}

export type ShiftFeedReport = {
  tonnage: number
  buckets: number
  metalG: number
  grade: number
  byStockpile: BlendLine[]
  byLoader: { loaderName: string; tonnage: number; buckets: number }[]
}

const tonnageExpr = sql<string>`coalesce(sum(${oreFeeds.bucketCount} * ${oreFeeds.bucketWeightT}), 0)`
const bucketsExpr = sql<string>`coalesce(sum(${oreFeeds.bucketCount}), 0)`
const metalExpr = sql<string>`coalesce(sum(${oreFeeds.bucketCount} * ${oreFeeds.bucketWeightT} * ${oreFeeds.auGrade}), 0)`

export async function getShiftFeedReport(key: ShiftKey): Promise<ShiftFeedReport> {
  const where = and(eq(oreFeeds.shiftDate, key.date), eq(oreFeeds.shiftNo, key.shift))
  const [byPile, byLoader] = await Promise.all([
    db
      .select({
        stockpileId: oreFeeds.stockpileId,
        stockpileName: stockpiles.name,
        tonnage: tonnageExpr,
        buckets: bucketsExpr,
        metal: metalExpr,
      })
      .from(oreFeeds)
      .leftJoin(stockpiles, eq(stockpiles.id, oreFeeds.stockpileId))
      .where(where)
      .groupBy(oreFeeds.stockpileId, stockpiles.name)
      .orderBy(asc(stockpiles.name)),
    db
      .select({
        loaderName: sql<string>`coalesce(${loaders.name}, ${oreFeeds.loader}, 'Не указан')`,
        tonnage: tonnageExpr,
        buckets: bucketsExpr,
      })
      .from(oreFeeds)
      .leftJoin(loaders, eq(loaders.id, oreFeeds.loaderId))
      .where(where)
      .groupBy(sql`1`),
  ])

  const lines: BlendLine[] = byPile.map((r) => ({
    stockpileId: r.stockpileId,
    stockpileName: r.stockpileName ?? '—',
    tonnage: Number(r.tonnage),
    buckets: Number(r.buckets),
    metalG: Number(r.metal),
  }))
  const tonnage = lines.reduce((s, l) => s + l.tonnage, 0)
  const metalG = lines.reduce((s, l) => s + l.metalG, 0)

  return {
    tonnage,
    buckets: lines.reduce((s, l) => s + l.buckets, 0),
    metalG,
    grade: tonnage > 0 ? metalG / tonnage : 0,
    byStockpile: lines,
    byLoader: byLoader.map((r) => ({ loaderName: r.loaderName, tonnage: Number(r.tonnage), buckets: Number(r.buckets) })),
  }
}

export type ShiftSummaryRow = {
  date: string
  shift: ShiftNo
  tonnage: number
  buckets: number
  grade: number
  metalG: number
  plannedT: number
}

export async function getShiftHistory(limit = 14): Promise<ShiftSummaryRow[]> {
  const [fact, plan] = await Promise.all([
    db
      .select({
        date: oreFeeds.shiftDate,
        shift: oreFeeds.shiftNo,
        tonnage: tonnageExpr,
        buckets: bucketsExpr,
        metal: metalExpr,
      })
      .from(oreFeeds)
      .where(sql`${oreFeeds.shiftDate} is not null`)
      .groupBy(oreFeeds.shiftDate, oreFeeds.shiftNo)
      .orderBy(desc(oreFeeds.shiftDate), desc(oreFeeds.shiftNo))
      .limit(limit),
    db
      .select({
        date: shiftPlans.shiftDate,
        shift: shiftPlans.shiftNo,
        planned: sql<string>`coalesce(sum(${shiftPlans.plannedT}), 0)`,
      })
      .from(shiftPlans)
      .groupBy(shiftPlans.shiftDate, shiftPlans.shiftNo),
  ])
  const planMap = new Map(plan.map((p) => [`${p.date}-${p.shift}`, Number(p.planned)]))

  return fact.map((r) => {
    const tonnage = Number(r.tonnage)
    const metalG = Number(r.metal)
    return {
      date: r.date as string,
      shift: r.shift as ShiftNo,
      tonnage,
      buckets: Number(r.buckets),
      metalG,
      grade: tonnage > 0 ? metalG / tonnage : 0,
      plannedT: planMap.get(`${r.date}-${r.shift}`) ?? 0,
    }
  })
}

export async function getShiftPlan(key: ShiftKey): Promise<Map<number, number>> {
  const rows = await db
    .select({ stockpileId: shiftPlans.stockpileId, plannedT: shiftPlans.plannedT })
    .from(shiftPlans)
    .where(and(eq(shiftPlans.shiftDate, key.date), eq(shiftPlans.shiftNo, key.shift)))
  return new Map(rows.map((r) => [r.stockpileId, Number(r.plannedT)]))
}

export async function getRecentReceipts(limit = 100) {
  const rows = await db
    .select({
      id: oreReceipts.id,
      occurredAt: oreReceipts.occurredAt,
      stockpileName: stockpiles.name,
      truckNumber: oreReceipts.truckNumber,
      ticketNumber: oreReceipts.ticketNumber,
      netWeightT: oreReceipts.netWeightT,
      note: oreReceipts.note,
    })
    .from(oreReceipts)
    .leftJoin(stockpiles, eq(stockpiles.id, oreReceipts.stockpileId))
    .orderBy(desc(oreReceipts.occurredAt), desc(oreReceipts.id))
    .limit(limit)
  return rows.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString(), netWeightT: Number(r.netWeightT) }))
}

export async function getRecentFeeds(limit = 100) {
  const rows = await db
    .select({
      id: oreFeeds.id,
      occurredAt: oreFeeds.occurredAt,
      stockpileName: stockpiles.name,
      bucketCount: oreFeeds.bucketCount,
      bucketWeightT: oreFeeds.bucketWeightT,
      auGrade: oreFeeds.auGrade,
      shiftDate: oreFeeds.shiftDate,
      shiftNo: oreFeeds.shiftNo,
      loaderName: sql<string | null>`coalesce(${loaders.name}, ${oreFeeds.loader})`,
      note: oreFeeds.note,
    })
    .from(oreFeeds)
    .leftJoin(stockpiles, eq(stockpiles.id, oreFeeds.stockpileId))
    .leftJoin(loaders, eq(loaders.id, oreFeeds.loaderId))
    .orderBy(desc(oreFeeds.occurredAt), desc(oreFeeds.id))
    .limit(limit)
  return rows.map((r) => {
    const bucketWeightT = Number(r.bucketWeightT)
    return {
      ...r,
      occurredAt: r.occurredAt.toISOString(),
      bucketWeightT,
      auGrade: Number(r.auGrade),
      tonnage: r.bucketCount * bucketWeightT,
    }
  })
}

/** Current balances with movement columns limited to the given (current) shift. */
export async function getCurrentShiftBalances(key: ShiftKey): Promise<StockpileBalance[]> {
  const { start, end } = shiftBounds(key)
  const until = end.getTime() > Date.now() ? undefined : end
  const [now, opening] = await Promise.all([getBalances(until), getBalances(start)])
  const openingById = new Map(opening.map((b) => [b.id, b]))
  return now.map((b) => {
    const o = openingById.get(b.id)
    return {
      ...b,
      received: b.received - (o?.received ?? 0),
      fed: b.fed - (o?.fed ?? 0),
      crushedIn: b.crushedIn - (o?.crushedIn ?? 0),
      crushedOut: b.crushedOut - (o?.crushedOut ?? 0),
    }
  })
}

export type KirankanStockpile = { id: number; name: string; auGrade: number }

export type KirankanBalance = KirankanStockpile & {
  received: number
  shipped: number
  adjusted: number
  balance: number
}

export async function getKirankanStockpiles(): Promise<KirankanStockpile[]> {
  const rows = await db.select().from(kirankanStockpiles).orderBy(asc(kirankanStockpiles.name))
  return rows.map((r) => ({ id: r.id, name: r.name, auGrade: Number(r.auGrade) }))
}

async function kirankanTotals(from?: Date, to?: Date) {
  const range = (
    col:
      | typeof kirankanReceipts.occurredAt
      | typeof kirankanShipments.occurredAt
      | typeof kirankanAdjustments.occurredAt,
  ) =>
    and(from ? gte(col, from) : undefined, to ? lt(col, to) : undefined)
  const [receipts, shipments, adjustments] = await Promise.all([
    db
      .select({ stockpileId: kirankanReceipts.stockpileId, total: sql<string>`coalesce(sum(${kirankanReceipts.netWeightT}), 0)` })
      .from(kirankanReceipts)
      .where(range(kirankanReceipts.occurredAt))
      .groupBy(kirankanReceipts.stockpileId),
    db
      .select({ stockpileId: kirankanShipments.stockpileId, total: sql<string>`coalesce(sum(${kirankanShipments.netWeightT}), 0)` })
      .from(kirankanShipments)
      .where(range(kirankanShipments.occurredAt))
      .groupBy(kirankanShipments.stockpileId),
    db
      .select({ stockpileId: kirankanAdjustments.stockpileId, total: sql<string>`coalesce(sum(${kirankanAdjustments.deltaT}), 0)` })
      .from(kirankanAdjustments)
      .where(range(kirankanAdjustments.occurredAt))
      .groupBy(kirankanAdjustments.stockpileId),
  ])
  const toMap = (rows: { stockpileId: number; total: string }[]) =>
    new Map(rows.map((r) => [r.stockpileId, Number(r.total)]))
  return { received: toMap(receipts), shipped: toMap(shipments), adjusted: toMap(adjustments) }
}

/** Kirankan balances: balance is current; received/shipped/adjusted are the current shift's movement. */
export async function getKirankanBalances(key: ShiftKey): Promise<KirankanBalance[]> {
  const { start, end } = shiftBounds(key)
  const until = end.getTime() > Date.now() ? undefined : end
  const [piles, all, shift] = await Promise.all([
    getKirankanStockpiles(),
    kirankanTotals(undefined, until),
    kirankanTotals(start, until),
  ])
  return piles.map((p) => ({
    ...p,
    received: shift.received.get(p.id) ?? 0,
    shipped: shift.shipped.get(p.id) ?? 0,
    adjusted: shift.adjusted.get(p.id) ?? 0,
    balance: (all.received.get(p.id) ?? 0) - (all.shipped.get(p.id) ?? 0) + (all.adjusted.get(p.id) ?? 0),
  }))
}

export type KirankanJournalEntry = {
  kind: 'receipt' | 'shipment' | 'adjustment'
  id: number
  occurredAt: Date
  stockpileName: string | null
  truckNumber: string | null
  ticketNumber: string | null
  tonnage: number
  note: string | null
}

export async function getKirankanJournal(limit = 100): Promise<KirankanJournalEntry[]> {
  const [receipts, shipments, adjustments] = await Promise.all([
    db
      .select({
        id: kirankanReceipts.id,
        occurredAt: kirankanReceipts.occurredAt,
        stockpileName: kirankanStockpiles.name,
        truckNumber: kirankanReceipts.truckNumber,
        ticketNumber: kirankanReceipts.ticketNumber,
        tonnage: kirankanReceipts.netWeightT,
        note: kirankanReceipts.note,
      })
      .from(kirankanReceipts)
      .leftJoin(kirankanStockpiles, eq(kirankanStockpiles.id, kirankanReceipts.stockpileId))
      .orderBy(desc(kirankanReceipts.occurredAt))
      .limit(limit),
    db
      .select({
        id: kirankanShipments.id,
        occurredAt: kirankanShipments.occurredAt,
        stockpileName: kirankanStockpiles.name,
        truckNumber: kirankanShipments.truckNumber,
        ticketNumber: kirankanShipments.ticketNumber,
        tonnage: kirankanShipments.netWeightT,
        note: kirankanShipments.note,
      })
      .from(kirankanShipments)
      .leftJoin(kirankanStockpiles, eq(kirankanStockpiles.id, kirankanShipments.stockpileId))
      .orderBy(desc(kirankanShipments.occurredAt))
      .limit(limit),
    db
      .select({
        id: kirankanAdjustments.id,
        occurredAt: kirankanAdjustments.occurredAt,
        stockpileName: kirankanStockpiles.name,
        tonnage: kirankanAdjustments.deltaT,
        note: kirankanAdjustments.note,
      })
      .from(kirankanAdjustments)
      .leftJoin(kirankanStockpiles, eq(kirankanStockpiles.id, kirankanAdjustments.stockpileId))
      .orderBy(desc(kirankanAdjustments.occurredAt))
      .limit(limit),
  ])
  const entries: KirankanJournalEntry[] = [
    ...receipts.map((r) => ({ ...r, kind: 'receipt' as const, tonnage: Number(r.tonnage) })),
    ...shipments.map((r) => ({ ...r, kind: 'shipment' as const, tonnage: Number(r.tonnage) })),
    ...adjustments.map((r) => ({
      ...r,
      kind: 'adjustment' as const,
      truckNumber: null,
      ticketNumber: null,
      tonnage: Number(r.tonnage),
    })),
  ]
  return entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit)
}

/* ---------- Закрытие смены ---------- */

export type ShiftClosureLine = { stockpileId: number; stockpileName: string; deltaT: number; auGrade: number }

export type ShiftClosure = {
  id: number
  date: string
  shift: ShiftNo
  scaleT: number
  fedT: number
  blendGrade: number
  targetStockpileId: number | null
  targetStockpileName: string | null
  note: string | null
  updatedAt: Date
  lines: ShiftClosureLine[]
}

export async function getShiftClosure(key: ShiftKey): Promise<ShiftClosure | null> {
  const [row] = await db
    .select({
      id: shiftClosures.id,
      scaleT: shiftClosures.scaleT,
      fedT: shiftClosures.fedT,
      blendGrade: shiftClosures.blendGrade,
      targetStockpileId: shiftClosures.targetStockpileId,
      targetStockpileName: stockpiles.name,
      note: shiftClosures.note,
      updatedAt: shiftClosures.updatedAt,
    })
    .from(shiftClosures)
    .leftJoin(stockpiles, eq(stockpiles.id, shiftClosures.targetStockpileId))
    .where(and(eq(shiftClosures.shiftDate, key.date), eq(shiftClosures.shiftNo, key.shift)))
  if (!row) return null
  const lines = await db
    .select({
      stockpileId: shiftClosureLines.stockpileId,
      stockpileName: stockpiles.name,
      deltaT: shiftClosureLines.deltaT,
      auGrade: shiftClosureLines.auGrade,
    })
    .from(shiftClosureLines)
    .leftJoin(stockpiles, eq(stockpiles.id, shiftClosureLines.stockpileId))
    .where(eq(shiftClosureLines.closureId, row.id))
    .orderBy(asc(stockpiles.name))
  return {
    id: row.id,
    date: key.date,
    shift: key.shift,
    scaleT: Number(row.scaleT),
    fedT: Number(row.fedT),
    blendGrade: Number(row.blendGrade),
    targetStockpileId: row.targetStockpileId,
    targetStockpileName: row.targetStockpileName,
    note: row.note,
    updatedAt: row.updatedAt,
    lines: lines.map((l) => ({
      stockpileId: l.stockpileId,
      stockpileName: l.stockpileName ?? '—',
      deltaT: Number(l.deltaT),
      auGrade: Number(l.auGrade),
    })),
  }
}

export type ShiftClosureSummary = {
  date: string
  shift: ShiftNo
  scaleT: number
  fedT: number
  blendGrade: number
  targetStockpileName: string | null
}

export async function getRecentClosures(limit = 20): Promise<ShiftClosureSummary[]> {
  const rows = await db
    .select({
      date: shiftClosures.shiftDate,
      shift: shiftClosures.shiftNo,
      scaleT: shiftClosures.scaleT,
      fedT: shiftClosures.fedT,
      blendGrade: shiftClosures.blendGrade,
      targetStockpileName: stockpiles.name,
    })
    .from(shiftClosures)
    .leftJoin(stockpiles, eq(stockpiles.id, shiftClosures.targetStockpileId))
    .orderBy(desc(shiftClosures.shiftDate), desc(shiftClosures.shiftNo))
    .limit(limit)
  return rows.map((r) => ({
    date: r.date,
    shift: (r.shift === 1 ? 1 : 2) as ShiftNo,
    scaleT: Number(r.scaleT),
    fedT: Number(r.fedT),
    blendGrade: Number(r.blendGrade),
    targetStockpileName: r.targetStockpileName,
  }))
}
