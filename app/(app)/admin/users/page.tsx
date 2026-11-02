import { headers } from 'next/headers'
import { PageHeader } from '@/components/page-header'
import { UserManagement, type ManagedUser } from '@/components/user-management'
import { auth } from '@/lib/auth'
import { requireAdminPage } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const me = await requireAdminPage()
  const result = await auth.api.listUsers({
    query: { limit: 500, sortBy: 'createdAt', sortDirection: 'asc' },
    headers: await headers(),
  })

  const users: ManagedUser[] = result.users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === 'admin' ? 'admin' : 'user',
    banned: Boolean(u.banned),
    createdAt: new Date(u.createdAt).toISOString(),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Пользователи"
        description="Доступ к системе только по учётным записям. Администратор управляет настройками и пользователями, оператор вводит данные."
      />
      <UserManagement users={users} currentUserId={me.id} />
    </div>
  )
}
