import { AppNav } from '@/components/app-nav'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser()

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppNav user={{ name: user.name, email: user.email, isAdmin: user.role === 'admin' }} />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
