import { PageHeader } from '@/components/page-header'
import { PlanForm } from '@/components/plan-form'
import { ShiftPicker } from '@/components/shift-picker'
import { getBalances, getLoaders, getShiftFeedReport, getShiftPlan } from '@/lib/queries'
import { getShift, parseShiftKey } from '@/lib/shift'

import { requireOperatorPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ date?: string; shift?: string }> }) {
  await requireOperatorPage()
  const params = await searchParams
  const current = getShift(new Date())
  const selected = parseShiftKey(params.date, params.shift) ?? current

  const [balances, plan, report, loaders] = await Promise.all([
    getBalances(),
    getShiftPlan(selected),
    getShiftFeedReport(selected),
    getLoaders({ activeOnly: true }),
  ])

  const fedById = Object.fromEntries(report.byStockpile.map((l) => [l.stockpileId, l.tonnage]))
  const rows = balances
    .filter((b) => b.isActive || plan.has(b.id))
    .map((b) => ({
      id: b.id,
      name: b.name,
      balance: b.balance,
      auGrade: b.auGrade,
      planned: plan.get(b.id) ?? 0,
      fed: fedById[b.id] ?? 0,
    }))

  return (
    <>
      <PageHeader
        title="Планирование шихты"
        description="Распределите тоннаж по штабелям или задайте пропорции на смену, при необходимости примените план на период — содержание шихты и количество ковшей рассчитываются автоматически."
      />
      <div className="mb-6">
        <ShiftPicker path="/planning" value={selected} current={current} />
      </div>
      <PlanForm
        key={`${selected.date}-${selected.shift}`}
        shift={selected}
        rows={rows}
        loaders={loaders.map((l) => ({ id: l.id, name: l.name, bucketWeightT: l.bucketWeightT }))}
      />
    </>
  )
}
