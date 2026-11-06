import { FeedForm } from '@/components/feed-form'
import { FeedsTable } from '@/components/feeds-table'
import { PageHeader } from '@/components/page-header'
import { getLoaders, getRecentFeeds, getStockpiles } from '@/lib/queries'

import { requireOperatorPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function FeedsPage() {
  await requireOperatorPage()
  const [piles, feeds, loaders] = await Promise.all([
    getStockpiles({ activeOnly: true }),
    getRecentFeeds(),
    getLoaders({ activeOnly: true }),
  ])

  return (
    <>
      <PageHeader
        title="Подача в переработку"
        description="Тоннаж = ковши × вес ковша погрузчика. Смена определяется автоматически по времени Хабаровска."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <FeedForm stockpiles={piles} loaders={loaders} />
        <FeedsTable feeds={feeds} />
      </div>
    </>
  )
}
