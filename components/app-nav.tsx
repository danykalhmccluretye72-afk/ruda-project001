'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  Hammer,
  LayoutGrid,
  LogOut,
  Mountain,
  Settings,
  Truck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth-client'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { cn } from '@/lib/utils'

const links: { href: string; label: string; icon: typeof LayoutGrid; roles: Role[] }[] = [
  { href: '/', label: 'Остатки', icon: LayoutGrid, roles: ['info', 'user', 'kirankan', 'admin'] },
  { href: '/kirankan', label: 'Киранкан', icon: Truck, roles: ['kirankan', 'admin'] },
  { href: '/receipts', label: 'Поступление', icon: ArrowDownToLine, roles: ['user', 'admin'] },
  { href: '/feeds', label: 'Подача в переработку', icon: ArrowUpFromLine, roles: ['user', 'admin'] },
  { href: '/crushing', label: 'Дробление', icon: Hammer, roles: ['user', 'admin'] },
  { href: '/shifts', label: 'Шихта по сменам', icon: ClipboardList, roles: ['user', 'admin'] },
  { href: '/closing', label: 'Закрытие смены', icon: ClipboardCheck, roles: ['user', 'admin'] },
  { href: '/planning', label: 'Планирование', icon: CalendarClock, roles: ['user', 'admin'] },
  { href: '/reports', label: 'Отчёты', icon: FileSpreadsheet, roles: ['user', 'admin'] },
  { href: '/settings', label: 'Настройки', icon: Settings, roles: ['user', 'admin'] },
  { href: '/admin/users', label: 'Пользователи', icon: Users, roles: ['admin'] },
]

type NavUser = { name: string; email: string; role: Role }

export function AppNav({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const items = links.filter((l) => l.roles.includes(user.role))

  function handleSignOut() {
    startTransition(async () => {
      await signOut()
      router.push('/sign-in')
      router.refresh()
    })
  }

  return (
    <aside className="flex flex-col border-b border-border bg-card md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 px-4 py-4 md:px-6 md:py-6">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Mountain className="size-5" aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Рудный склад</p>
          <p className="text-xs text-muted-foreground">Учёт остатков руды</p>
        </div>
      </div>
      <nav aria-label="Основная навигация" className="px-2 pb-3 md:flex-1 md:px-3">
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {items.map(({ href, label, icon: Icon }) => {
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
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 md:px-6 md:py-4">
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]} · {user.email}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          disabled={pending}
          aria-label="Выйти"
          title="Выйти"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </aside>
  )
}
