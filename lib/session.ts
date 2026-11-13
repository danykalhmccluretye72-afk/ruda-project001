import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canEdit, canManageKirankan, canUseLoaderConsole, normalizeRole } from '@/lib/roles'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

/** For pages: redirects to sign-in when there is no session. */
export async function requireUser() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  return { ...session.user, role: normalizeRole(session.user.role) }
}

/** For read-only pages: the loader role only has access to its own console. */
export async function requireViewerPage() {
  const user = await requireUser()
  if (user.role === 'loader') redirect('/loader')
  return user
}

/** For the loader console page. */
export async function requireLoaderPage() {
  const user = await requireUser()
  if (!canUseLoaderConsole(user.role)) redirect('/')
  return user
}

/** For Perevalnoe data-entry pages: other roles are sent back to the balances page. */
export async function requireOperatorPage() {
  const user = await requireUser()
  if (!canEdit(user.role)) redirect(user.role === 'loader' ? '/loader' : '/')
  return user
}

/** For the Kirankan management page. */
export async function requireKirankanPage() {
  const user = await requireUser()
  if (!canManageKirankan(user.role)) redirect(user.role === 'loader' ? '/loader' : '/')
  return user
}

export async function assertKirankan() {
  const user = await assertUser()
  if (!canManageKirankan(user.role)) throw new Error('Недостаточно прав')
  return user
}

/** For admin pages: redirects non-admins to the dashboard. */
export async function requireAdminPage() {
  const user = await requireUser()
  if (user.role !== 'admin') redirect(user.role === 'loader' ? '/loader' : '/')
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
  if (!canEdit(user.role)) throw new Error('Недостаточно прав')
  return user
}

export async function assertAdmin() {
  const user = await assertUser()
  if (user.role !== 'admin') throw new Error('Недостаточно прав')
  return user
}

export async function assertLoaderOperator() {
  const user = await assertUser()
  if (!canUseLoaderConsole(user.role)) throw new Error('Недостаточно прав')
  return user
}
