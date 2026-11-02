'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn, signUp } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'setup' }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const setup = mode === 'setup'

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    const result = setup
      ? await signUp.email({ email, password, name: String(form.get('name') ?? '').trim() || email })
      : await signIn.email({ email, password })

    setPending(false)
    if (result.error) {
      console.error('[auth]', result.error)
      setError(
        setup
          ? 'Не удалось создать администратора. Пароль — не менее 8 символов.'
          : 'Неверный email или пароль, либо учётная запись заблокирована.',
      )
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{setup ? 'Первый запуск' : 'Вход в систему'}</CardTitle>
        <CardDescription>
          {setup
            ? 'Создайте учётную запись администратора. Остальных пользователей администратор добавит в разделе «Пользователи».'
            : 'Доступ выдаёт администратор склада.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {setup ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="auth-name">Имя</Label>
              <Input id="auth-name" name="name" autoComplete="name" required maxLength={100} />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="auth-password">Пароль</Label>
            <Input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={setup ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? 'Подождите…' : setup ? 'Создать администратора' : 'Войти'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
