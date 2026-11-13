'use client'

import { Ban, KeyRound, Plus, ShieldCheck, Trash2, UserCheck } from 'lucide-react'
import { useActionState, useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ActionState } from '@/app/actions'
import {
  createUserAction,
  deleteUserAction,
  setUserBlockedAction,
  setUserPasswordAction,
  setUserRoleAction,
} from '@/app/user-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useActionToast } from '@/hooks/use-action-toast'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from '@/lib/roles'

export type ManagedUser = {
  id: string
  name: string
  email: string
  role: Role
  banned: boolean
  createdAt: string
}

function notify(result: ActionState) {
  if (!result) return false
  if (result.ok) toast.success(result.message)
  else toast.error(result.message)
  return result.ok
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createUserAction, null)
  const close = useCallback(() => setOpen(false), [])
  useActionToast(state, close)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          Добавить пользователя
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый пользователь</DialogTitle>
          <DialogDescription>Передайте пользователю email и пароль лично. Пароль он не сможет восстановить сам.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-name">Имя</Label>
            <Input id="new-user-name" name="name" required maxLength={100} placeholder="Иванов И. И." />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-email">Email (логин)</Label>
            <Input id="new-user-email" name="email" type="email" required autoComplete="off" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-password">Пароль</Label>
            <Input id="new-user-password" name="password" type="text" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-role">Роль</Label>
            <Select name="role" defaultValue="user">
              <SelectTrigger id="new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">{ROLE_DESCRIPTIONS.info}</SelectItem>
                <SelectItem value="user">{ROLE_DESCRIPTIONS.user}</SelectItem>
                <SelectItem value="kirankan">{ROLE_DESCRIPTIONS.kirankan}</SelectItem>
                <SelectItem value="loader">{ROLE_DESCRIPTIONS.loader}</SelectItem>
                <SelectItem value="admin">{ROLE_DESCRIPTIONS.admin}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Создание…' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({ user }: { user: ManagedUser }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setPassword('')
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Сменить пароль ${user.email}`} title="Сменить пароль">
          <KeyRound className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый пароль</DialogTitle>
          <DialogDescription>
            {user.name} ({user.email}). После смены пользователь будет разлогинен на всех устройствах.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`pwd-${user.id}`}>Пароль, не менее 8 символов</Label>
          <Input
            id={`pwd-${user.id}`}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={pending || password.length < 8}
            onClick={() =>
              startTransition(async () => {
                if (notify(await setUserPasswordAction(user.id, password))) setOpen(false)
              })
            }
          >
            {pending ? 'Сохранение…' : 'Сохранить пароль'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteUserDialog({ user }: { user: ManagedUser }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={`Удалить ${user.email}`}
          title="Удалить"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить пользователя?</DialogTitle>
          <DialogDescription>
            {user.name} ({user.email}) потеряет доступ. Введённые им данные по складу сохранятся.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (notify(await deleteUserAction(user.id))) setOpen(false)
              })
            }
          >
            {pending ? 'Удаление…' : 'Удалить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UserRow({ user, isSelf }: { user: ManagedUser; isSelf: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <TableRow className={user.banned ? 'opacity-60' : undefined}>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">
            {user.name}
            {isSelf ? <span className="text-muted-foreground"> (вы)</span> : null}
          </span>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      </TableCell>
      <TableCell>
        {isSelf ? (
          <Badge>Администратор</Badge>
        ) : (
          <Select
            value={user.role}
            disabled={pending}
            onValueChange={(role) =>
              startTransition(async () => {
                notify(await setUserRoleAction(user.id, role as ManagedUser['role']))
              })
            }
          >
            <SelectTrigger className="w-48" aria-label={`Роль ${user.email}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">{ROLE_LABELS.info}</SelectItem>
              <SelectItem value="user">{ROLE_LABELS.user}</SelectItem>
              <SelectItem value="kirankan">{ROLE_LABELS.kirankan}</SelectItem>
              <SelectItem value="loader">{ROLE_LABELS.loader}</SelectItem>
              <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        {user.banned ? <Badge variant="destructive">Заблокирован</Badge> : <Badge variant="secondary">Активен</Badge>}
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {new Date(user.createdAt).toLocaleDateString('ru-RU', { timeZone: 'Asia/Vladivostok' })}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <PasswordDialog user={user} />
          {isSelf ? null : (
            <>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={user.banned ? `Разблокировать ${user.email}` : `Заблокировать ${user.email}`}
                title={user.banned ? 'Разблокировать' : 'Заблокировать'}
                onClick={() =>
                  startTransition(async () => {
                    notify(await setUserBlockedAction(user.id, !user.banned))
                  })
                }
              >
                {user.banned ? (
                  <UserCheck className="size-4" aria-hidden="true" />
                ) : (
                  <Ban className="size-4" aria-hidden="true" />
                )}
              </Button>
              <DeleteUserDialog user={user} />
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

export function UserManagement({ users, currentUserId }: { users: ManagedUser[]; currentUserId: string }) {
  const admins = users.filter((u) => u.role === 'admin' && !u.banned).length

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Учётные записи
          </CardTitle>
          <CardDescription>
            Всего: {users.length}, администраторов: {admins}. Регистрация закрыта — новых пользователей добавляет администратор.
          </CardDescription>
        </div>
        <CreateUserDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Пользователь</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="hidden md:table-cell">Создан</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
