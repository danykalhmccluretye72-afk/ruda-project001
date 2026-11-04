import { BalanceSummary } from '@/components/balance-summary'
import { BalanceTable } from '@/components/balance-table'
import { PageHeader } from '@/components/page-header'
import { ShiftTrio } from '@/components/shift-trio'
import { getBalances, getShiftFeedReport, getShiftPlan } from '@/lib/queries'
import { canEdit } from '@/lib/roles'
import { requireUser } from '@/lib/session'
import { getShift, nextShift, prevShift } from '@/lib/shift'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await requireUser()
  const current = getShift(new Date())
  const prev = prevShift(current)
  const next = nextShift(current)
  const [balances, prevReport, report, prevPlan, plan, nextPlan] = await Promise.all([
    getBalances(),
    getShiftFeedReport(prev),
    getShiftFeedReport(current),
    getShiftPlan(prev),
    getShiftPlan(current),
    getShiftPlan(next),
  ])

  return (
    <>
      <PageHeader
        title="Остатки руды по штабелям"
        description="Остаток = поступление (автовесовая) ± дробление − подача в переработку (ковши погрузчика)."
      />
      <BalanceSummary balances={balances} shift={current} report={report} plan={plan} />
      <ShiftTrio
        balances={balances}
        columns={[
          { key: prev, kind: 'prev', plan: prevPlan, report: prevReport },
          { key: current, kind: 'current', plan, report },
          { key: next, kind: 'next', plan: nextPlan, report: null },
        ]}
      />
      <BalanceTable balances={balances} canEdit={canEdit(user.role)} />
    </>
  )
}
