'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DEFAULT_SORT,
  JOURNAL_TYPES,
  SCOPE_LABELS,
  SITE_LABELS,
  SITE_SCOPES,
  reportQuery,
  type ReportFilters as Filters,
  type ReportScope,
  type ReportSite,
} from '@/lib/report-columns'

type Pile = { id: number; name: string; status: string }

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

function presets(today: string): { label: string; from: string; to: string }[] {
  const [y, m] = today.split('-').map(Number)
  const monthStart = `${today.slice(0, 7)}-01`
  const prevEnd = addDays(monthStart, -1)
  return [
    { label: 'Сегодня', from: today, to: today },
    { label: '7 дней', from: addDays(today, -6), to: today },
    { label: '30 дней', from: addDays(today, -29), to: today },
    { label: 'Этот месяц', from: monthStart, to: today },
    { label: 'Прошлый месяц', from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd },
    { label: 'С начала года', from: `${y}-01-01`, to: today },
  ].filter((p) => m > 0 && p.from <= p.to)
}

export function ReportFilters({
  filters,
  piles,
  today,
}: {
  filters: Filters
  piles: Record<ReportSite, Pile[]>
  today: string
}) {
  const router = useRouter()
  const [site, setSite] = useState<ReportSite>(filters.site)
  const [from, setFrom] = useState(filters.from)
  const [to, setTo] = useState(filters.to)
  const [scope, setScope] = useState<ReportScope>(filters.scope)
  const [pile, setPile] = useState(filters.pile ? String(filters.pile) : 'all')
  const [type, setType] = useState(filters.type)

  const pileOptions = piles[site].filter((p) => scope === 'all' || p.status === scope)

  function apply(patch: Partial<Filters> = {}) {
    const siteChanged = (patch.site ?? site) !== filters.site
    const next: Filters = {
      ...filters,
      site,
      from,
      to,
      scope,
      pile: pile === 'all' ? null : Number(pile),
      type,
      ...(siteChanged ? DEFAULT_SORT[filters.view] : {}),
      ...patch,
    }
    router.push(`/reports?${reportQuery(next)}`)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-site">Участок</Label>
          <Select
            value={site}
            onValueChange={(v) => {
              setSite(v as ReportSite)
              setScope('all')
              setPile('all')
              setType('all')
            }}
          >
            <SelectTrigger id="report-site" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SITE_LABELS) as ReportSite[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SITE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-from">С даты</Label>
          <Input id="report-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-to">По дату</Label>
          <Input id="report-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-scope">Вид штабелей</Label>
          <Select
            value={scope}
            onValueChange={(v) => {
              setScope(v as ReportScope)
              setPile('all')
            }}
          >
            <SelectTrigger id="report-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SITE_SCOPES[site].map((s) => (
                <SelectItem key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="report-pile">Штабель</Label>
          <Select value={pile} onValueChange={setPile}>
            <SelectTrigger id="report-pile" className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все ({pileOptions.length})</SelectItem>
              {pileOptions.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="report-type">Операции (журнал)</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="report-type" className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все операции</SelectItem>
              {JOURNAL_TYPES[site].map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Быстрый выбор периода">
          {presets(today).map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={p.from === from && p.to === to ? 'secondary' : 'outline'}
              onClick={() => {
                setFrom(p.from)
                setTo(p.to)
                apply({ from: p.from, to: p.to })
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button type="submit">Сформировать</Button>
      </div>
    </form>
  )
}
