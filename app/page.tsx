import { PageHeader } from '@/components/page-header'
import { BalanceSummary } from '@/components/balance-summary'
import { BalanceTable } from '@/components/balance-table'
import { getBalances, getBucketWeight } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [balances, bucketWeight] = await Promise.all([getBalances(), getBucketWeight()])

  return (
    <>
      <PageHeader
        title="Остатки руды по штабелям"
        description="Остаток = исходный остаток + поступление (автовесовая) − подача в переработку (ковши погрузчика)."
      />
      <BalanceSummary balances={balances} bucketWeight={bucketWeight} />
      <BalanceTable balances={balances} />
    </>
  )
}
