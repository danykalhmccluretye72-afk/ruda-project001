'use client'

import { Pencil, Plus, Scale, Trash2 } from 'lucide-react'
import { useActionState, useCallback, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ActionState } from '@/app/actions'
import {
  addKirankanReceipt,
  addKirankanShipment,
  addKirankanStockpile,
  adjustKirankanBalance,
  deleteKirankanEntry,
  deleteKirankanStockpile,
  updateKirankanStockpile,
} from '@/app/kirankan-actions'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useActionToast } from '@/hooks/use-action-toast'
import type { KirankanBalance, KirankanJournalEntry } from '@/lib/queries'
import { toKhvInputValue } from '@/lib/shift'
import { formatDateTime, formatGrade, formatTons } from '@/lib/utils'

/* ---------- Создание / редактирование штабеля ---------- */

function StockpileDialog({ stockpile }: { stockpile?: KirankanBalance }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    stockpile ? updateKirankanStockpile : addKirankanStockpile,
    null,
  )
  const close = useCallback(() => setOpen(false), [])
  useActionToast(state, close)
  const prefix = stockpile ? `kp-${stockpile.id}` : 'kp-new'

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
            Создать штабель
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stockpile ? 'Изменить штабель' : 'Новый штабель Киранкан'}</DialogTitle>
          <DialogDescription>
            {stockpile
              ? 'Название и содержание золота. Остаток меняется через «Редактировать остаток».'
              : 'Начальный остаток — руда на штабеле на момент начала учёта.'}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {stockpile ? <input type="hidden" name="id" value={stockpile.id} /> : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${prefix}-name`}>Название</Label>
            <Input id={`${prefix}-name`} name="name" required maxLength={100} defaultValue={stockpile?.name} />
          </div>
          {stockpile ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${prefix}-initial`}>Начальный остаток, т</Label>
              <Input
                id={`${prefix}-initial`}
                name="initialTonnage"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                required
                defaultValue={0}
                className="font-mono"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${prefix}-grade`}>Содержание золота, г/т</Label>
            <Input
              id={`${prefix}-grade`}
              name="auGrade"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max="1000"
              required
              defaultValue={stockpile?.auGrade ?? 0}
              className="font-mono"
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

/* ---------- Редактирование остатка ---------- */

function AdjustDialog({ stockpile }: { stockpile: KirankanBalance }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(adjustKirankanBalance, null)
  const close = useCallback(() => setOpen(false), [])
  useActionToast(state, close)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Редактировать остаток ${stockpile.name}`}>
          <Scale className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Остаток «{stockpile.name}»</DialogTitle>
          <DialogDescription>
            Текущий учётный остаток {formatTons(stockpile.balance)} т. Введите фактический — разница запишется
            корректировкой.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="stockpileId" value={stockpile.id} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`adj-${stockpile.id}-actual`}>Фактический остаток, т</Label>
            <Input
              id={`adj-${stockpile.id}-actual`}
              name="actualT"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              required
              defaultValue={Math.max(0, stockpile.balance)}
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`adj-${stockpile.id}-note`}>Основание</Label>
            <Input id={`adj-${stockpile.id}-note`} name="note" maxLength={200} placeholder="Маркшейдерский замер" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Сохранение…' : 'Сохранить остаток'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Удаление штабеля ---------- */

function DeleteDialog({ stockpile }: { stockpile: KirankanBalance }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteKirankanStockpile(stockpile.id, confirm)
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
        if (!next) setConfirm('')
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Удалить ${stockpile.name}`}>
          <Trash2 className="size-4 text-destructive" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить штабель «{stockpile.name}»?</DialogTitle>
          <DialogDescription>
            Будут удалены все поступления, отгрузки и корректировки штабеля. Действие необратимо.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`del-${stockpile.id}`}>Введите название штабеля для подтверждения</Label>
          <Input id={`del-${stockpile.id}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={pending || confirm.trim() !== stockpile.name}>
            {pending ? 'Удаление…' : 'Удалить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Поступление / отгрузка ---------- */

function MovementForm({ kind, stockpiles }: { kind: 'receipt' | 'shipment'; stockpiles: KirankanBalance[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    kind === 'receipt' ? addKirankanReceipt : addKirankanShipment,
    null,
  )
  const reset = useCallback(() => {
    const form = formRef.current
    if (!form) return
    for (const name of ['netWeightT', 'truckNumber', 'ticketNumber', 'note']) {
      const el = form.elements.namedItem(name)
      if (el instanceof HTMLInputElement) el.value = ''
    }
  }, [])
  useActionToast(state, reset)
  const id = (name: string) => `${kind}-${name}`

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id('pile')}>Штабель</Label>
        <Select name="stockpileId" required>
          <SelectTrigger id={id('pile')} className="w-full">
            <SelectValue placeholder="Выберите штабель" />
          </SelectTrigger>
          <SelectContent>
            {stockpiles.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
                {kind === 'shipment' ? ` — ${formatTons(s.balance)} т` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id('time')}>Дата и время</Label>
        <Input
          id={id('time')}
          name="occurredAt"
          type="datetime-local"
          required
          defaultValue={toKhvInputValue(new Date())}
          suppressHydrationWarning
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id('weight')}>Вес нетто, т</Label>
        <Input
          id={id('weight')}
          name="netWeightT"
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0.001"
          max="1000"
          required
          className="font-mono"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id('truck')}>Номер самосвала</Label>
        <Input id={id('truck')} name="truckNumber" maxLength={200} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id('ticket')}>Номер талона</Label>
        <Input id={id('ticket')} name="ticketNumber" maxLength={200} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id('note')}>Примечание</Label>
        <Input id={id('note')} name="note" maxLength={200} />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending || stockpiles.length === 0}>
          {pending ? 'Сохранение…' : kind === 'receipt' ? 'Записать поступление' : 'Записать отгрузку на Перевальное'}
        </Button>
      </div>
    </form>
  )
}

/* ---------- Журнал ---------- */

const KIND_LABELS: Record<KirankanJournalEntry['kind'], string> = {
  receipt: 'Поступление',
  shipment: 'Отгрузка',
  adjustment: 'Корректировка',
}

function DeleteEntryButton({ entry }: { entry: KirankanJournalEntry }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label="Удалить запись"
      onClick={() => {
        if (!window.confirm('Удалить запись?')) return
        const fd = new FormData()
        fd.set('id', String(entry.id))
        fd.set('kind', entry.kind)
        startTransition(async () => {
          await deleteKirankanEntry(fd)
          toast.success('Запись удалена')
        })
      }}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </Button>
  )
}

/* ---------- Страница ---------- */

export function KirankanManager({
  balances,
  journal,
}: {
  balances: KirankanBalance[]
  journal: KirankanJournalEntry[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Движение руды</CardTitle>
          <CardDescription>Поступление на штабели Киранкана и отгрузка на Перевальное</CardDescription>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Сначала создайте штабель.</p>
          ) : (
            <Tabs defaultValue="receipt">
              <TabsList>
                <TabsTrigger value="receipt">Поступление руды</TabsTrigger>
                <TabsTrigger value="shipment">Отгрузка на Перевальное</TabsTrigger>
              </TabsList>
              <TabsContent value="receipt" className="pt-4">
                <MovementForm kind="receipt" stockpiles={balances} />
              </TabsContent>
              <TabsContent value="shipment" className="pt-4">
                <MovementForm kind="shipment" stockpiles={balances} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Штабели Киранкан</CardTitle>
            <CardDescription>Создание, редактирование, корректировка остатка и удаление</CardDescription>
          </div>
          <StockpileDialog />
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Штабелей пока нет.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Штабель</TableHead>
                  <TableHead className="text-right">Остаток, т</TableHead>
                  <TableHead className="text-right">Au, г/т</TableHead>
                  <TableHead className="w-36 text-right">
                    <span className="sr-only">Действия</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatTons(b.balance)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatGrade(b.auGrade)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <AdjustDialog stockpile={b} />
                        <StockpileDialog stockpile={b} />
                        <DeleteDialog stockpile={b} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Журнал операций</CardTitle>
          <CardDescription>Последние 100 записей</CardDescription>
        </CardHeader>
        <CardContent>
          {journal.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Записей пока нет.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead>Штабель</TableHead>
                  <TableHead className="text-right">Тонн</TableHead>
                  <TableHead>Самосвал / талон</TableHead>
                  <TableHead>Примечание</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Удалить</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journal.map((e) => (
                  <TableRow key={`${e.kind}-${e.id}`}>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                      {formatDateTime(e.occurredAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.kind === 'shipment' ? 'default' : e.kind === 'receipt' ? 'secondary' : 'outline'}>
                        {KIND_LABELS[e.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.stockpileName ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {e.kind === 'shipment' ? '−' : e.kind === 'adjustment' && e.tonnage > 0 ? '+' : ''}
                      {formatTons(e.tonnage)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[e.truckNumber, e.ticketNumber].filter(Boolean).join(' / ') || '—'}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-muted-foreground">{e.note ?? '—'}</TableCell>
                    <TableCell>
                      <DeleteEntryButton entry={e} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
