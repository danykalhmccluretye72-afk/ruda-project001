'use client'

import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'
import { useActionState, useCallback, useState, useTransition } from 'react'
import { addStockpile, toggleStockpileActive, updateStockpile, type ActionState } from '@/app/actions'
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
import type { Stockpile } from '@/lib/queries'
import { formatTons } from '@/lib/utils'

function StockpileDialog({ stockpile }: { stockpile?: Stockpile }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    stockpile ? updateStockpile : addStockpile,
    null,
  )
  const close = useCallback(() => setOpen(false), [])
  useActionToast(state, close)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {stockpile ? (
          <Button variant="ghost" size="icon" aria-label={`Изменить ${stockpile.name}`}>
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Добавить штабель
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stockpile ? 'Изменить штабель' : 'Новый штабель'}</DialogTitle>
          <DialogDescription>
            Исходный остаток — количество руды на штабеле на момент начала учёта в системе.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {stockpile ? <input type="hidden" name="id" value={stockpile.id} /> : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="pile-name">Название</Label>
            <Input id="pile-name" name="name" required maxLength={100} defaultValue={stockpile?.name} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pile-initial">Исходный остаток, т</Label>
            <Input
              id="pile-initial"
              name="initialTonnage"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              required
              className="font-mono"
              defaultValue={stockpile?.initialTonnage ?? 0}
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

function ToggleActiveButton({ stockpile }: { stockpile: Stockpile }) {
  const [pending, startTransition] = useTransition()
  const label = stockpile.isActive ? 'В архив' : 'Восстановить'

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={`${label}: ${stockpile.name}`}
      title={label}
      onClick={() => {
        const formData = new FormData()
        formData.set('id', String(stockpile.id))
        formData.set('active', String(!stockpile.isActive))
        startTransition(() => toggleStockpileActive(formData))
      }}
    >
      {stockpile.isActive ? (
        <Archive className="size-4" aria-hidden="true" />
      ) : (
        <ArchiveRestore className="size-4" aria-hidden="true" />
      )}
    </Button>
  )
}

export function StockpileSettings({ stockpiles }: { stockpiles: Stockpile[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Штабели и исходные остатки</CardTitle>
          <CardDescription>Архивные штабели скрыты из форм ввода, но сохраняют историю.</CardDescription>
        </div>
        <StockpileDialog />
      </CardHeader>
      <CardContent>
        {stockpiles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Штабели ещё не добавлены.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Штабель</TableHead>
                <TableHead className="text-right">Исходный остаток, т</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Действия</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockpiles.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {s.name}
                      {!s.isActive ? <Badge variant="outline">в архиве</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatTons(s.initialTonnage)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <StockpileDialog stockpile={s} />
                      <ToggleActiveButton stockpile={s} />
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
