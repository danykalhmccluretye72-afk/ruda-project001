import 'server-only'
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from './db'
import { crushingLines, crushingOps, loaders, oreFeeds, oreReceipts, shiftPlans, stockpiles } from './db/schema'
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
  const [piles, receiptTotals, feedTotals, crushInTotals, crushOutTotals] = await Promise.all([
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
  ])

  const toMap = (rows: { stockpileId: number; total: string }[]) =>
    new Map(rows.map((r) => [r.stockpileId, Number(r.total)]))
  const receivedMap = toMap(receiptTotals)
  const fedMap = toMap(feedTotals)
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
