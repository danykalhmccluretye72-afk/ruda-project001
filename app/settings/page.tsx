import { BucketWeightForm } from '@/components/bucket-weight-form'
import { PageHeader } from '@/components/page-header'
import { StockpileSettings } from '@/components/stockpile-settings'
import { getBucketWeight, getStockpiles } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [bucketWeight, piles] = await Promise.all([getBucketWeight(), getStockpiles()])

  return (
    <>
      <PageHeader title="Настройки" description="Вес ковша погрузчика и исходные остатки по штабелям." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <BucketWeightForm bucketWeight={bucketWeight} />
        <StockpileSettings stockpiles={piles} />
      </div>
    </>
  )
}
