import { BalanceSummary } from '@/components/balance-summary'
import { BalanceTable } from '@/components/balance-table'
import { PageHeader } from '@/components/page-header'
import { getBalances, getShiftFeedReport, getShiftPlan } from '@/lib/queries'
import { getShift } from '@/lib/shift'

import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireUser()
  const shift = getShift(new Date())
  const [balances, report, plan] = await Promise.all([getBalances(), getShiftFeedReport(shift), getShiftPlan(shift)])

  return (
    <>
      <PageHeader
        title="Остатки руды по штабелям"
        description="Остаток = исходный остаток + поступление (автовесовая) − подача в переработку (ковши погрузчика)."
      />
      <BalanceSummary balances={balances} shift={shift} report={report} plan={plan} />
      <BalanceTable balances={balances} />
    </>
  )
}
