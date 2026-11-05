import { CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { BalanceSummary } from '@/components/balance-summary'
import { Button } from '@/components/ui/button'
import { BalanceTable } from '@/components/balance-table'
import { KirankanBalanceTable } from '@/components/kirankan-balance-table'
import { PageHeader } from '@/components/page-header'
import { ShiftPicker } from '@/components/shift-picker'
import { ShiftTrio } from '@/components/shift-trio'
import {
  getCurrentShiftBalances,
  getKirankanBalances,
  getShiftFeedReport,
  getShiftPlan,
} from '@/lib/queries'
import { canEdit, canManageKirankan } from '@/lib/roles'
import { requireUser } from '@/lib/session'
import { getShift, nextShift, parseShiftKey, prevShift } from '@/lib/shift'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string; shift?: string }> }) {
  const user = await requireUser()
  const params = await searchParams
  const now = getShift(new Date())
  const current = parseShiftKey(params.date, params.shift) ?? now
  const isNow = current.date === now.date && current.shift === now.shift
  const prev = prevShift(current)
  const next = nextShift(current)
  const [balances, kirankan, prevReport, report, prevPlan, plan, nextPlan] = await Promise.all([
    getCurrentShiftBalances(current),
    getKirankanBalances(current),
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <ShiftPicker path="/" value={current} current={now} />
        <Button asChild variant="outline">
          <Link href={`/daily?date=${current.date}`}>
            <CalendarDays className="size-4" aria-hidden="true" />
            Суточный отчёт
          </Link>
        </Button>
      </div>
      <BalanceSummary balances={balances} shift={current} report={report} plan={plan} />
      <ShiftTrio
        balances={balances}
        columns={[
          { key: prev, kind: 'prev', plan: prevPlan, report: prevReport },
          { key: current, kind: 'current', plan, report },
          { key: next, kind: 'next', plan: nextPlan, report: null },
        ]}
      />
      <BalanceTable balances={balances} canEdit={isNow && canEdit(user.role)} />
      <KirankanBalanceTable balances={kirankan} canManage={isNow && canManageKirankan(user.role)} />
    </>
  )
}
