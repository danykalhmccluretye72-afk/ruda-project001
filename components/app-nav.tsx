'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  ClipboardList,
  LayoutGrid,
  Mountain,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Остатки', icon: LayoutGrid },
  { href: '/receipts', label: 'Поступление', icon: ArrowDownToLine },
  { href: '/feeds', label: 'Подача в переработку', icon: ArrowUpFromLine },
  { href: '/shifts', label: 'Шихта по сменам', icon: ClipboardList },
  { href: '/planning', label: 'Планирование', icon: CalendarClock },
  { href: '/settings', label: 'Настройки', icon: Settings },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <aside className="border-b border-border bg-card md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 px-4 py-4 md:px-6 md:py-6">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Mountain className="size-5" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Рудный склад</p>
          <p className="text-xs text-muted-foreground">Учёт остатков руды</p>
        </div>
      </div>
      <nav aria-label="Основная навигация" className="px-2 pb-3 md:px-3">
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className={cn('size-4', active && 'text-primary')} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
