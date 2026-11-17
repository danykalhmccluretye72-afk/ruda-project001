'use client'

import { Popover } from 'radix-ui'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

type Pile = { id: number; name: string }

export function PileMultiSelect({
  id,
  options,
  value,
  onChange,
}: {
  id?: string
  options: Pile[]
  value: number[]
  onChange: (next: number[]) => void
}) {
  const [query, setQuery] = useState('')
  const listId = useId()
  const selected = new Set(value)
  const q = query.trim().toLowerCase()
  const visible = q ? options.filter((p) => p.name.toLowerCase().includes(q)) : options

  const summary =
    value.length === 0
      ? `Все (${options.length})`
      : value.length === 1
        ? (options.find((p) => p.id === value[0])?.name ?? '1 штабель')
        : `Выбрано: ${value.length}`

  function toggle(pileId: number) {
    onChange(selected.has(pileId) ? value.filter((v) => v !== pileId) : [...value, pileId])
  }

  return (
    <Popover.Root onOpenChange={(open) => !open && setQuery('')}>
      <Popover.Trigger
        id={id}
        className="flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="truncate">{summary}</span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-50" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 flex w-(--radix-popover-trigger-width) min-w-64 flex-col rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск штабеля"
              aria-label="Поиск штабеля"
              aria-controls={listId}
              className="h-9 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => onChange([...new Set([...value, ...visible.map((p) => p.id)])])}
            >
              Выбрать {q ? 'найденные' : 'все'}
            </button>
            <button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange([])}>
              Сбросить
            </button>
          </div>
          <ul id={listId} role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1">
            {visible.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">Ничего не найдено</li>
            ) : (
              visible.map((p) => {
                const on = selected.has(p.id)
                return (
                  <li key={p.id} role="option" aria-selected={on}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                        )}
                        aria-hidden
                      >
                        {on && <CheckIcon className="size-3" />}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {value.length === 0 ? 'Ничего не выбрано — в отчёт войдут все штабели' : `Суммируются ${value.length} шт.`}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
