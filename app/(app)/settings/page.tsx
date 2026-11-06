import { LoaderSettings } from '@/components/loader-settings'
import { PageHeader } from '@/components/page-header'
import { StockpileSettings } from '@/components/stockpile-settings'
import { SurveyJournal } from '@/components/survey-journal'
import { getBalances, getLoaders, getStockpileAdjustments } from '@/lib/queries'
import { requireOperatorPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireOperatorPage()
  const [loaders, piles, surveys] = await Promise.all([getLoaders(), getBalances(), getStockpileAdjustments()])

  return (
    <>
      <PageHeader
        title="Настройки"
        description="Погрузчики и вес ковша, исходные остатки и содержание золота по штабелям. Время — Хабаровск (UTC+10)."
      />
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <LoaderSettings loaders={loaders} />
        <div className="flex min-w-0 flex-col gap-6">
          <StockpileSettings stockpiles={piles} />
          <SurveyJournal entries={surveys} />
        </div>
      </div>
    </>
  )
}
