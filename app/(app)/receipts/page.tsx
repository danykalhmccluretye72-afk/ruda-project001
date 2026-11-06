import { PageHeader } from '@/components/page-header'
import { ReceiptForm } from '@/components/receipt-form'
import { ReceiptsTable } from '@/components/receipts-table'
import { getRecentReceipts, getStockpiles } from '@/lib/queries'

import { requireOperatorPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function ReceiptsPage() {
  await requireOperatorPage()
  const [piles, receipts] = await Promise.all([getStockpiles({ activeOnly: true }), getRecentReceipts()])

  return (
    <>
      <PageHeader
        title="Поступление руды"
        description="Регистрация рейсов по данным автовесовой: вес нетто и штабель разгрузки."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <ReceiptForm stockpiles={piles} />
        <ReceiptsTable receipts={receipts} />
      </div>
    </>
  )
}
