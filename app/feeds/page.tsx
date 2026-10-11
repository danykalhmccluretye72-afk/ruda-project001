import { FeedForm } from '@/components/feed-form'
import { FeedsTable } from '@/components/feeds-table'
import { PageHeader } from '@/components/page-header'
import { getBucketWeight, getRecentFeeds, getStockpiles } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function FeedsPage() {
  const [piles, feeds, bucketWeight] = await Promise.all([
    getStockpiles({ activeOnly: true }),
    getRecentFeeds(),
    getBucketWeight(),
  ])

  return (
    <>
      <PageHeader
        title="Подача в переработку"
        description="Регистрация ковшей погрузчика. Тоннаж = количество ковшей × вес ковша на момент записи."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <FeedForm stockpiles={piles} bucketWeight={bucketWeight} />
        <FeedsTable feeds={feeds} />
      </div>
    </>
  )
}
