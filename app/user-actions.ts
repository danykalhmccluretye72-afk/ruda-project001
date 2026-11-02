'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { assertAdmin } from '@/lib/session'
import type { ActionState } from '@/app/actions'

type Role = 'admin' | 'user'

function parseRole(value: FormDataEntryValue | null): Role {
  return value === 'admin' ? 'admin' : 'user'
}

function errorMessage(e: unknown, fallback: string) {
  console.error('[users]', e)
  if (e instanceof Error && /exist|already/i.test(e.message)) return 'Пользователь с таким email уже существует'
  if (e instanceof Error && e.message === 'Недостаточно прав') return e.message
  return fallback
}

export async function createUserAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  try {
    await assertAdmin()
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    if (!name || !email) return { ok: false, message: 'Укажите имя и email' }
    if (password.length < 8) return { ok: false, message: 'Пароль — не менее 8 символов' }

    await auth.api.createUser({
      body: { name, email, password, role: parseRole(formData.get('role')) },
      headers: await headers(),
    })
    revalidatePath('/admin/users')
    return { ok: true, message: `Пользователь ${email} создан` }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Не удалось создать пользователя') }
  }
}

export async function setUserRoleAction(userId: string, role: Role): Promise<ActionState> {
  try {
    const me = await assertAdmin()
    if (me.id === userId) return { ok: false, message: 'Нельзя изменить собственную роль' }
    await auth.api.setRole({ body: { userId, role }, headers: await headers() })
    revalidatePath('/admin/users')
    return { ok: true, message: 'Роль изменена' }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Не удалось изменить роль') }
  }
}

export async function setUserPasswordAction(userId: string, newPassword: string): Promise<ActionState> {
  try {
    await assertAdmin()
    if (newPassword.length < 8) return { ok: false, message: 'Пароль — не менее 8 символов' }
    await auth.api.setUserPassword({ body: { userId, newPassword }, headers: await headers() })
    await auth.api.revokeUserSessions({ body: { userId }, headers: await headers() })
    return { ok: true, message: 'Пароль изменён, активные сеансы пользователя завершены' }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Не удалось изменить пароль') }
  }
}

export async function setUserBlockedAction(userId: string, blocked: boolean): Promise<ActionState> {
  try {
    const me = await assertAdmin()
    if (me.id === userId) return { ok: false, message: 'Нельзя заблокировать самого себя' }
    const h = await headers()
    if (blocked) await auth.api.banUser({ body: { userId }, headers: h })
    else await auth.api.unbanUser({ body: { userId }, headers: h })
    revalidatePath('/admin/users')
    return { ok: true, message: blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован' }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Не удалось изменить статус') }
  }
}

export async function deleteUserAction(userId: string): Promise<ActionState> {
  try {
    const me = await assertAdmin()
    if (me.id === userId) return { ok: false, message: 'Нельзя удалить самого себя' }
    await auth.api.removeUser({ body: { userId }, headers: await headers() })
    revalidatePath('/admin/users')
    return { ok: true, message: 'Пользователь удалён' }
  } catch (e) {
    return { ok: false, message: errorMessage(e, 'Не удалось удалить пользователя') }
  }
}
