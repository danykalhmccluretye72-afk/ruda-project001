import type { Metadata } from 'next'
import { HistoricalStockpiles } from '@/components/historical-stockpiles'
import { PageHeader } from '@/components/page-header'
import { getBalances } from '@/lib/queries'
import { canEdit } from '@/lib/roles'
import { requireViewerPage } from '@/lib/session'

export const metadata: Metadata = { title: 'Исторические данные' }

export default async function HistoryPage() {
  const user = await requireViewerPage()
  const piles = await getBalances(undefined, { historicalOnly: true })

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Исторические данные"
        description="Штабели, выведенные из оборота. При необходимости их можно вернуть в работу."
      />
      <HistoricalStockpiles stockpiles={piles} canEdit={canEdit(user.role)} />
    </div>
  )
}
