import 'server-only'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from './db'
import { loaders, oreFeeds, oreReceipts, shiftPlans, stockpiles } from './db/schema'
import type { ShiftKey, ShiftNo } from './shift'

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
  balance: number
}

export async function getBalances(): Promise<StockpileBalance[]> {
  const [piles, receiptTotals, feedTotals] = await Promise.all([
    getStockpiles(),
    db
      .select({ stockpileId: oreReceipts.stockpileId, total: sql<string>`coalesce(sum(${oreReceipts.netWeightT}), 0)` })
      .from(oreReceipts)
      .groupBy(oreReceipts.stockpileId),
    db
      .select({
        stockpileId: oreFeeds.stockpileId,
        total: sql<string>`coalesce(sum(${oreFeeds.bucketCount} * ${oreFeeds.bucketWeightT}), 0)`,
      })
      .from(oreFeeds)
      .groupBy(oreFeeds.stockpileId),
  ])

  const receivedMap = new Map(receiptTotals.map((r) => [r.stockpileId, Number(r.total)]))
  const fedMap = new Map(feedTotals.map((r) => [r.stockpileId, Number(r.total)]))

  return piles.map((p) => {
    const received = receivedMap.get(p.id) ?? 0
    const fed = fedMap.get(p.id) ?? 0
    return { ...p, received, fed, balance: p.initialTonnage + received - fed }
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
