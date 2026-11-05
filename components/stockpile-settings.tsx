'use client'

import { Archive, ArchiveRestore, Pencil, Plus, Scale, Trash2 } from 'lucide-react'
import { useActionState, useCallback, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  addStockpile,
  adjustStockpileBalance,
  deleteStockpile,
  toggleStockpileActive,
  updateStockpile,
  type ActionState,
} from '@/app/actions'
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
import type { Stockpile, StockpileBalance } from '@/lib/queries'
import { cn, formatGrade, formatTons } from '@/lib/utils'

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
          <div className="flex flex-col gap-2">
            <Label htmlFor="pile-grade">Содержание золота, г/т</Label>
            <Input
              id="pile-grade"
              name="auGrade"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max="1000"
              required
              className="font-mono"
              defaultValue={stockpile?.auGrade ?? 0}
            />
            <p className="text-xs text-muted-foreground">
              Содержание фиксируется в записи подачи на момент её ввода.
            </p>
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

function SurveyDialog({ stockpile }: { stockpile: StockpileBalance }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(adjustStockpileBalance, null)
  const close = useCallback(() => setOpen(false), [])
  useActionToast(state, close)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Уточнить остаток по замеру: ${stockpile.name}`}
          title="Уточнить остаток по маркшейдерскому замеру"
        >
          <Scale className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Маркшейдерский замер «{stockpile.name}»</DialogTitle>
          <DialogDescription>
            Учётный остаток {formatTons(stockpile.balance)} т. Введите остаток по замеру — разница запишется
            корректировкой, история движений не меняется.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="stockpileId" value={stockpile.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`survey-${stockpile.id}-actual`}>Остаток по замеру, т</Label>
            <Input
              id={`survey-${stockpile.id}-actual`}
              name="actualT"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              required
              defaultValue={Math.max(0, Math.round(stockpile.balance * 1000) / 1000)}
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`survey-${stockpile.id}-note`}>Основание</Label>
            <Input
              id={`survey-${stockpile.id}-note`}
              name="note"
              maxLength={200}
              placeholder="Маркшейдерский замер №…"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Сохранение…' : 'Записать замер'}
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

function DeleteStockpileDialog({ stockpile }: { stockpile: Stockpile }) {
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [pending, startTransition] = useTransition()
  const matches = confirmName.trim() === stockpile.name

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteStockpile(stockpile.id, confirmName)
      if (result?.ok) {
        toast.success(result.message)
        setOpen(false)
      } else if (result) {
        toast.error(result.message)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmName('')
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={`Удалить ${stockpile.name} полностью`}
          title="Удалить полностью"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить штабель «{stockpile.name}»?</DialogTitle>
          <DialogDescription>
            Будут безвозвратно удалены штабель и вся его история: поступления, подачи в переработку и планы смен.
            Это повлияет на отчёты по прошлым сменам. Если нужно только скрыть штабель — используйте архив.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirm-${stockpile.id}`}>Для подтверждения введите название штабеля</Label>
          <Input
            id={`confirm-${stockpile.id}`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={stockpile.name}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!matches || pending}>
            {pending ? 'Удаление…' : 'Удалить навсегда'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StockpileSettings({ stockpiles }: { stockpiles: StockpileBalance[] }) {
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
                <TableHead className="text-right">Маркшейд. уточн., т</TableHead>
                <TableHead className="text-right">Текущий остаток, т</TableHead>
                <TableHead className="text-right">Au, г/т</TableHead>
                <TableHead className="w-32">
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
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      s.adjusted > 0 ? 'text-success' : s.adjusted < 0 ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {s.adjusted === 0 ? '—' : `${s.adjusted > 0 ? '+' : '−'}${formatTons(Math.abs(s.adjusted))}`}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatTons(s.balance)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatGrade(s.auGrade)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <SurveyDialog stockpile={s} />
                      <StockpileDialog stockpile={s} />
                      <ToggleActiveButton stockpile={s} />
                    <DeleteStockpileDialog stockpile={s} />
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
