'use client'

import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'
import { useActionState, useCallback, useState, useTransition } from 'react'
import { addLoader, toggleLoaderActive, updateLoader, type ActionState } from '@/app/actions'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useActionToast } from '@/hooks/use-action-toast'
import type { Loader } from '@/lib/queries'
import { formatTons } from '@/lib/utils'

function LoaderDialog({ loader }: { loader?: Loader }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loader ? updateLoader : addLoader, null)
  const close = useCallback(() => setOpen(false), [])
  useActionToast(state, close)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {loader ? (
          <Button variant="ghost" size="icon" aria-label={`Изменить ${loader.name}`}>
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Добавить
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loader ? 'Изменить погрузчик' : 'Новый погрузчик'}</DialogTitle>
          <DialogDescription>
            Вес ковша фиксируется в каждой записи подачи — изменение не пересчитывает прошлые данные.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {loader ? <input type="hidden" name="id" value={loader.id} /> : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="loader-name">Название / гаражный №</Label>
            <Input id="loader-name" name="name" required maxLength={100} defaultValue={loader?.name} placeholder="CAT 988H №12" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="loader-weight">Вес ковша, т</Label>
            <Input
              id="loader-weight"
              name="bucketWeightT"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0.001"
              max="100"
              required
              className="font-mono"
              defaultValue={loader?.bucketWeightT}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ToggleLoaderButton({ loader }: { loader: Loader }) {
  const [pending, startTransition] = useTransition()
  const label = loader.isActive ? 'В архив' : 'Восстановить'
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`${label}: ${loader.name}`}
      title={label}
      onClick={() => {
        const formData = new FormData()
        formData.set('id', String(loader.id))
        formData.set('active', String(!loader.isActive))
        startTransition(() => toggleLoaderActive(formData))
      }}
    >
      {loader.isActive ? <Archive className="size-4" aria-hidden="true" /> : <ArchiveRestore className="size-4" aria-hidden="true" />}
    </Button>
  )
}

export function LoaderSettings({ loaders }: { loaders: Loader[] }) {
  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Погрузчики</CardTitle>
          <CardDescription>Вес ковша для расчёта тоннажа подачи</CardDescription>
        </div>
        <LoaderDialog />
      </CardHeader>
      <CardContent>
        {loaders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Погрузчики не добавлены.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Погрузчик</TableHead>
                <TableHead className="text-right">Ковш, т</TableHead>
                <TableHead className="w-20">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loaders.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {l.name}
                      {!l.isActive ? <Badge variant="outline">в архиве</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatTons(l.bucketWeightT)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <LoaderDialog loader={l} />
                      <ToggleLoaderButton loader={l} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
