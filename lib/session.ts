import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { normalizeRole } from '@/lib/roles'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/** For pages: redirects to sign-in when there is no session. */
export async function requireUser() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  return { ...session.user, role: normalizeRole(session.user.role) }
}

/** For data-entry pages: the read-only "info" role is sent back to the balances page. */
export async function requireOperatorPage() {
  const user = await requireUser()
  if (user.role === 'info') redirect('/')
  return user
}

/** For admin pages: redirects non-admins to the dashboard. */
export async function requireAdminPage() {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/')
  return user
}

/** For server actions: throws instead of redirecting. */
export async function assertUser() {
  const session = await getSession()
  if (!session?.user) throw new Error('Требуется вход в систему')
  return { ...session.user, role: normalizeRole(session.user.role) }
}

export async function assertOperator() {
  const user = await assertUser()
  if (user.role === 'info') throw new Error('Недостаточно прав')
  return user
}

export async function assertAdmin() {
  const user = await assertUser()
  if (user.role !== 'admin') throw new Error('Недостаточно прав')
  return user
}
