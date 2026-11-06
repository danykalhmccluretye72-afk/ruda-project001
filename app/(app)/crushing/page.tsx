import { CrushingForm } from '@/components/crushing-form'
import { CrushingTable } from '@/components/crushing-table'
import { PageHeader } from '@/components/page-header'
import { getLoaders, getRecentCrushing, getStockpiles } from '@/lib/queries'
import { requireOperatorPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function CrushingPage() {
  await requireOperatorPage()
  const [piles, loaders, ops] = await Promise.all([
    getStockpiles({ activeOnly: true }),
    getLoaders({ activeOnly: true }),
    getRecentCrushing(),
  ])

  return (
    <>
      <PageHeader
        title="Дробление"
        description="Руда списывается с исходных штабелей и приходуется на целевой. Тоннаж = ковши × вес ковша погрузчика."
      />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <CrushingForm stockpiles={piles} loaders={loaders} />
        <CrushingTable ops={ops} />
      </div>
    </>
  )
}
