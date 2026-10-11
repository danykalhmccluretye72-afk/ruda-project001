import 'server-only'
import { asc, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from './db'
import { appSettings, oreFeeds, oreReceipts, stockpiles } from './db/schema'

export const BUCKET_WEIGHT_KEY = 'bucket_weight_t'
export const DEFAULT_BUCKET_WEIGHT = 5

export async function getBucketWeight() {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, BUCKET_WEIGHT_KEY))
  const value = row ? Number(row.value) : NaN
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BUCKET_WEIGHT
}

export type Stockpile = {
  id: number
  name: string
  initialTonnage: number
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
    isActive: r.isActive,
  }))
}

export type StockpileBalance = Stockpile & {
  received: number
  fed: number
  balance: number
  received24h: number
  fed24h: number
  buckets24h: number
}

export async function getBalances(): Promise<StockpileBalance[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [piles, receiptTotals, feedTotals, receipt24h, feed24h] = await Promise.all([
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
    db
      .select({ stockpileId: oreReceipts.stockpileId, total: sql<string>`coalesce(sum(${oreReceipts.netWeightT}), 0)` })
      .from(oreReceipts)
      .where(gte(oreReceipts.occurredAt, since))
      .groupBy(oreReceipts.stockpileId),
    db
      .select({
        stockpileId: oreFeeds.stockpileId,
        total: sql<string>`coalesce(sum(${oreFeeds.bucketCount} * ${oreFeeds.bucketWeightT}), 0)`,
        buckets: sql<string>`coalesce(sum(${oreFeeds.bucketCount}), 0)`,
      })
      .from(oreFeeds)
      .where(gte(oreFeeds.occurredAt, since))
      .groupBy(oreFeeds.stockpileId),
  ])

  const toMap = (rows: { stockpileId: number; total: string }[]) =>
    new Map(rows.map((r) => [r.stockpileId, Number(r.total)]))

  const receivedMap = toMap(receiptTotals)
  const fedMap = toMap(feedTotals)
  const received24hMap = toMap(receipt24h)
  const fed24hMap = toMap(feed24h)
  const buckets24hMap = new Map(feed24h.map((r) => [r.stockpileId, Number(r.buckets)]))

  return piles.map((p) => {
    const received = receivedMap.get(p.id) ?? 0
    const fed = fedMap.get(p.id) ?? 0
    return {
      ...p,
      received,
      fed,
      balance: p.initialTonnage + received - fed,
      received24h: received24hMap.get(p.id) ?? 0,
      fed24h: fed24hMap.get(p.id) ?? 0,
      buckets24h: buckets24hMap.get(p.id) ?? 0,
    }
  })
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
      loader: oreFeeds.loader,
      note: oreFeeds.note,
    })
    .from(oreFeeds)
    .leftJoin(stockpiles, eq(stockpiles.id, oreFeeds.stockpileId))
    .orderBy(desc(oreFeeds.occurredAt), desc(oreFeeds.id))
    .limit(limit)
  return rows.map((r) => {
    const bucketWeightT = Number(r.bucketWeightT)
    return {
      ...r,
      occurredAt: r.occurredAt.toISOString(),
      bucketWeightT,
      tonnage: r.bucketCount * bucketWeightT,
    }
  })
}
