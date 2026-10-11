'use client'

import { useActionState, useCallback, useRef, useState } from 'react'
import { addReceipt, type ActionState } from '@/app/actions'
import { StockpileSelect } from '@/components/stockpile-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toLocalInputValue, useActionToast, withIsoDate } from '@/hooks/use-action-toast'
import type { Stockpile } from '@/lib/queries'

export function ReceiptForm({ stockpiles }: { stockpiles: Stockpile[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [now, setNow] = useState(() => toLocalInputValue(new Date()))
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    (prev, formData) => addReceipt(prev, withIsoDate(formData)),
    null,
  )
  const reset = useCallback(() => {
    const form = formRef.current
    if (!form) return
    for (const name of ['netWeightT', 'truckNumber', 'ticketNumber', 'note']) {
      const el = form.elements.namedItem(name) as HTMLInputElement | null
      if (el) el.value = ''
    }
    setNow(toLocalInputValue(new Date()))
  }, [])
  useActionToast(state, reset)

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Новый рейс</CardTitle>
        <CardDescription>Данные талона автовесовой</CardDescription>
      </CardHeader>
      <CardContent>
        {stockpiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет активных штабелей. Добавьте их в настройках.</p>
        ) : (
          <form ref={formRef} action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-stockpile">Штабель</Label>
              <StockpileSelect id="receipt-stockpile" stockpiles={stockpiles} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-weight">Вес нетто, т</Label>
              <Input
                id="receipt-weight"
                name="netWeightT"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0.001"
                max="1000"
                required
                className="font-mono"
                placeholder="0,000"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-time">Дата и время взвешивания</Label>
              <Input
                id="receipt-time"
                name="occurredAtLocal"
                type="datetime-local"
                value={now}
                onChange={(e) => setNow(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="receipt-truck">Гос. номер</Label>
                <Input id="receipt-truck" name="truckNumber" maxLength={50} placeholder="А123ВС" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="receipt-ticket">№ талона</Label>
                <Input id="receipt-ticket" name="ticketNumber" maxLength={50} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="receipt-note">Примечание</Label>
              <Input id="receipt-note" name="note" maxLength={200} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Сохранение…' : 'Записать поступление'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
