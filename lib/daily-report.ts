import 'server-only'
import { getDailyBalanceReport, getShiftFeedReport, getShiftPlan, type ShiftBalanceRow } from '@/lib/queries'
import type { ShiftKey } from '@/lib/shift'

export type FeedTotals = { planT: number; factT: number; metalG: number; grade: number }

export type DailyFeedRow = {
  stockpileId: number
  name: string
  s1: FeedTotals
  s2: FeedTotals
  day: FeedTotals
}

export type DailyReport = {
  date: string
  shifts: { s1: FeedTotals; s2: FeedTotals; day: FeedTotals }
  feedRows: DailyFeedRow[]
  balanceRows: ShiftBalanceRow[]
}

const empty = (): FeedTotals => ({ planT: 0, factT: 0, metalG: 0, grade: 0 })

function withGrade(t: FeedTotals): FeedTotals {
  return { ...t, grade: t.factT > 0 ? t.metalG / t.factT : 0 }
}

function sum(a: FeedTotals, b: FeedTotals): FeedTotals {
  return withGrade({ planT: a.planT + b.planT, factT: a.factT + b.factT, metalG: a.metalG + b.metalG, grade: 0 })
}

export async function buildDailyReport(
  date: string,
  { hideArchive = false }: { hideArchive?: boolean } = {},
): Promise<DailyReport> {
  const k1: ShiftKey = { date, shift: 1 }
  const k2: ShiftKey = { date, shift: 2 }
  const [balances, feed1, feed2, plan1, plan2] = await Promise.all([
    getDailyBalanceReport(date),
    getShiftFeedReport(k1),
    getShiftFeedReport(k2),
    getShiftPlan(k1),
    getShiftPlan(k2),
  ])

  const names = new Map(balances.map((b) => [b.id, b.name]))
  const archived = new Set(balances.filter((b) => !b.isActive).map((b) => b.id))
  const visible = (id: number) => !hideArchive || !archived.has(id)
  const rows = new Map<number, { s1: FeedTotals; s2: FeedTotals }>()
  const row = (id: number) => {
    let r = rows.get(id)
    if (!r) rows.set(id, (r = { s1: empty(), s2: empty() }))
    return r
  }
  for (const [id, t] of plan1) row(id).s1.planT += t
  for (const [id, t] of plan2) row(id).s2.planT += t
  for (const l of feed1.byStockpile) {
    const r = row(l.stockpileId).s1
    r.factT += l.tonnage
    r.metalG += l.metalG
    if (!names.has(l.stockpileId)) names.set(l.stockpileId, l.stockpileName)
  }
  for (const l of feed2.byStockpile) {
    const r = row(l.stockpileId).s2
    r.factT += l.tonnage
    r.metalG += l.metalG
    if (!names.has(l.stockpileId)) names.set(l.stockpileId, l.stockpileName)
  }

  const feedRows: DailyFeedRow[] = [...rows.entries()]
    .map(([id, r]) => {
      const s1 = withGrade(r.s1)
      const s2 = withGrade(r.s2)
      return { stockpileId: id, name: names.get(id) ?? '—', s1, s2, day: sum(s1, s2) }
    })
    .filter((r) => visible(r.stockpileId) && (r.day.planT > 0 || r.day.factT > 0))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  const s1 = feedRows.reduce((acc, r) => sum(acc, r.s1), empty())
  const s2 = feedRows.reduce((acc, r) => sum(acc, r.s2), empty())

  return {
    date,
    shifts: { s1, s2, day: sum(s1, s2) },
    feedRows,
    balanceRows: balances.filter(
      (r) => r.isActive || (!hideArchive && (r.opening !== 0 || r.closing !== 0)),
    ),
  }
}

export function percent(fact: number, plan: number) {
  return plan > 0 ? (fact / plan) * 100 : null
}
