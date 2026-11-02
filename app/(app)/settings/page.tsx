import { LoaderSettings } from '@/components/loader-settings'
import { PageHeader } from '@/components/page-header'
import { StockpileSettings } from '@/components/stockpile-settings'
import { getLoaders, getStockpiles } from '@/lib/queries'
import { requireAdminPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireAdminPage()
  const [loaders, piles] = await Promise.all([getLoaders(), getStockpiles()])

  return (
    <>
      <PageHeader
        title="Настройки"
        description="Погрузчики и вес ковша, исходные остатки и содержание золота по штабелям. Время — Хабаровск (UTC+10)."
      />
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <LoaderSettings loaders={loaders} />
        <StockpileSettings stockpiles={piles} />
      </div>
    </>
  )
}
