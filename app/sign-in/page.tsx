import { redirect } from 'next/navigation'
import { Mountain } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'
import { countUsers } from '@/lib/auth'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function SignInPage() {
  const session = await getSession()
  if (session?.user) redirect('/')
  const setup = (await countUsers()) === 0

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Mountain className="size-5" aria-hidden="true" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold">Рудный склад</h1>
            <p className="text-sm text-muted-foreground">Учёт остатков руды</p>
          </div>
        </div>
        <AuthForm mode={setup ? 'setup' : 'sign-in'} />
      </div>
    </main>
  )
}
