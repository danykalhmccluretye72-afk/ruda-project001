import type { Metadata } from 'next'
import { LoaderConsole, type ConsolePile } from '@/components/loader-console'
import { upcoming } from '@/lib/bucket-sequence'
import { getLoaderShiftState, getLoaders } from '@/lib/queries'
import { requireLoaderPage } from '@/lib/session'
import { formatShift, getShift } from '@/lib/shift'

export const metadata: Metadata = { title: 'Погрузчик' }
export const dynamic = 'force-dynamic'

export default async function LoaderPage({ searchParams }: { searchParams: Promise<{ loader?: string }> }) {
  await requireLoaderPage()
  const { loader: loaderParam } = await searchParams
  const shift = getShift(new Date())
  const [machines, state] = await Promise.all([getLoaders({ activeOnly: true }), getLoaderShiftState(shift)])

  if (machines.length === 0) {
    return <p className="text-muted-foreground">Нет активных погрузчиков. Обратитесь к оператору.</p>
  }

  const machine = machines.find((m) => String(m.id) === loaderParam) ?? machines[0]
  const w = machine.bucketWeightT

  const piles: ConsolePile[] = state.rows.map((r) => ({
    id: r.stockpileId,
    name: r.name,
    auGrade: r.auGrade,
    plannedT: r.plannedT,
    fedT: r.fedT,
    planned: Math.max(1, Math.round(r.plannedT / w)),
    done: Math.round(r.fedT / w),
  }))
  const queue = upcoming(piles, 2)
  const last = state.recent[0]

  return (
    <LoaderConsole
      shiftLabel={formatShift(shift)}
      loaders={machines.map((m) => ({ id: m.id, name: m.name, bucketWeightT: m.bucketWeightT }))}
      loaderId={machine.id}
      piles={piles}
      currentId={queue[0] ?? null}
      nextId={queue[1] ?? null}
      previous={last ? { name: last.stockpileName ?? '—', occurredAt: last.occurredAt } : null}
    />
  )
}
