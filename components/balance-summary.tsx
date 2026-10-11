import { ArrowDownToLine, ArrowUpFromLine, Layers, Weight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { StockpileBalance } from '@/lib/queries'
import { formatTons } from '@/lib/utils'

export function BalanceSummary({ balances, bucketWeight }: { balances: StockpileBalance[]; bucketWeight: number }) {
  const active = balances.filter((b) => b.isActive)
  const total = active.reduce((s, b) => s + b.balance, 0)
  const received24h = balances.reduce((s, b) => s + b.received24h, 0)
  const fed24h = balances.reduce((s, b) => s + b.fed24h, 0)
  const buckets24h = balances.reduce((s, b) => s + b.buckets24h, 0)

  const items = [
    { label: 'Общий остаток на складе', value: `${formatTons(total)} т`, hint: `${active.length} активн. штабелей`, icon: Layers, tone: 'text-primary' },
    { label: 'Поступило за 24 ч', value: `${formatTons(received24h)} т`, hint: 'по данным автовесовой', icon: ArrowDownToLine, tone: 'text-success' },
    { label: 'Подано в переработку за 24 ч', value: `${formatTons(fed24h)} т`, hint: `${buckets24h} ковш.`, icon: ArrowUpFromLine, tone: 'text-destructive' },
    { label: 'Вес ковша', value: `${formatTons(bucketWeight)} т`, hint: 'текущая настройка', icon: Weight, tone: 'text-muted-foreground' },
  ]

  return (
    <section aria-label="Сводка" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, hint, icon: Icon, tone }) => (
        <Card key={label} className="py-0">
          <CardContent className="flex flex-col gap-2 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className={`size-4 ${tone}`} aria-hidden="true" />
            </div>
            <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
