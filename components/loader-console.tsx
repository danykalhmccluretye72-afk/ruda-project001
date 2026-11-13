'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import { recordBucket, undoLastBucket } from '@/app/loader-actions'
import { Button } from '@/components/ui/button'
import { formatTons } from '@/lib/utils'
import { cn } from '@/lib/utils'

export type ConsolePile = {
  id: number
  name: string
  auGrade: number
  plannedT: number
  fedT: number
  planned: number
  done: number
}

type Props = {
  shiftLabel: string
  loaders: { id: number; name: string; bucketWeightT: number }[]
  loaderId: number
  piles: ConsolePile[]
  currentId: number | null
  nextId: number | null
  previous: { name: string; occurredAt: string } | null
}

const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Vladivostok' })

export function LoaderConsole({ shiftLabel, loaders, loaderId, piles, currentId, nextId, previous }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showOther, setShowOther] = useState(false)

  // Несколько погрузчиков работают по одному заданию — периодически подтягиваем чужие ковши.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20_000)
    return () => clearInterval(t)
  }, [router])

  const current = piles.find((p) => p.id === currentId) ?? null
  const next = piles.find((p) => p.id === nextId) ?? null
  const totalPlanned = piles.reduce((s, p) => s + p.planned, 0)
  const totalDone = piles.reduce((s, p) => s + Math.min(p.done, p.planned), 0)
  const percent = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const res = await action()
      if (res.ok) toast.success(res.message)
      else toast.error(res.message)
      setShowOther(false)
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-lg font-semibold">Задание шихты</h1>
          <p className="text-right text-xs text-muted-foreground">{shiftLabel}</p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Погрузчик</span>
          <select
            value={loaderId}
            onChange={(e) => router.replace(`/loader?loader=${e.target.value}`)}
            className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
          >
            {loaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} · ковш {formatTons(l.bucketWeightT)} т
              </option>
            ))}
          </select>
        </label>
      </header>

      {piles.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          На текущую смену задание шихты не запланировано.
        </p>
      ) : (
        <>
          <section aria-label="Выполнение" className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Ковшей</span>
              <span className="font-mono text-sm">
                <span className="text-lg font-semibold text-foreground">{totalDone}</span> / {totalPlanned} · {percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
          </section>

          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Прошлый ковш</p>
            <p className="mt-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-base">{previous?.name ?? '—'}</span>
              {previous && (
                <span className="font-mono text-xs text-muted-foreground">{timeFmt.format(new Date(previous.occurredAt))}</span>
              )}
            </p>
          </div>

          {current ? (
            <section aria-live="polite" className="flex flex-col gap-4 rounded-xl border-2 border-primary bg-card p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary">Сейчас грузить</p>
                <p className="mt-1 text-balance text-3xl font-bold leading-tight">{current.name}</p>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  ковш {current.done + 1} из {current.planned} · Au {current.auGrade.toFixed(2)} г/т
                </p>
              </div>
              <Button
                size="lg"
                className="h-20 w-full text-xl font-semibold"
                disabled={pending}
                onClick={() => run(() => recordBucket(current.id, loaderId))}
              >
                <Check className="size-6" aria-hidden="true" />
                Ковш загружен
              </Button>
            </section>
          ) : (
            <section className="rounded-xl border-2 border-primary bg-card p-6 text-center">
              <p className="text-2xl font-bold">Задание выполнено</p>
              <p className="mt-1 text-sm text-muted-foreground">Все ковши по плану смены загружены.</p>
            </section>
          )}

          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Следующий ковш</p>
              <p className="truncate text-base">{next?.name ?? '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-14 text-base"
              disabled={pending}
              onClick={() => run(() => undoLastBucket(loaderId))}
            >
              <RotateCcw className="size-5" aria-hidden="true" />
              Отменить
            </Button>
            <Button
              variant="outline"
              className="h-14 text-base"
              disabled={pending}
              aria-expanded={showOther}
              onClick={() => setShowOther((v) => !v)}
            >
              Другой штабель
            </Button>
          </div>

          {showOther && (
            <section aria-label="Загружен из другого штабеля" className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Ковш взят не из того штабеля? Отметьте, откуда:</p>
              {piles.map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  className="h-14 justify-between text-base"
                  disabled={pending}
                  onClick={() => run(() => recordBucket(p.id, loaderId))}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {p.done}/{p.planned}
                  </span>
                </Button>
              ))}
            </section>
          )}

          <section aria-label="По штабелям" className="rounded-lg border border-border bg-card">
            <ul className="divide-y divide-border">
              {piles.map((p) => {
                const pct = p.planned > 0 ? Math.min(100, (p.done / p.planned) * 100) : 0
                const over = p.done > p.planned
                return (
                  <li key={p.id} className="flex flex-col gap-1.5 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate', p.id === current?.id && 'font-semibold text-primary')}>{p.name}</span>
                      <span className={cn('shrink-0 font-mono text-sm', over && 'text-destructive')}>
                        {p.done}/{p.planned} ковш.
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full', over ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTons(p.fedT)} / {formatTons(p.plannedT)} т
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
