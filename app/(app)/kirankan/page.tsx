import { KirankanManager } from '@/components/kirankan-manager'
import { PageHeader } from '@/components/page-header'
import { getKirankanBalances, getKirankanJournal, getKirankanStockpiles } from '@/lib/queries'
import { requireKirankanPage } from '@/lib/session'
import { getShift } from '@/lib/shift'

export const dynamic = 'force-dynamic'

export default async function KirankanPage() {
  await requireKirankanPage()
  const [balances, journal, history] = await Promise.all([
    getKirankanBalances(getShift(new Date())),
    getKirankanJournal(),
    getKirankanStockpiles({ historical: true }),
  ])

  return (
    <>
      <PageHeader
        title="Киранкан"
        description="Управление рудными запасами Киранкана: штабели, поступление, отгрузка на Перевальное и корректировка остатков."
      />
      <KirankanManager balances={balances} journal={journal} history={history} />
    </>
  )
}
