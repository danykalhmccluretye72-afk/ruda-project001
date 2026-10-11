'use client'

import { useActionState } from 'react'
import { updateBucketWeight, type ActionState } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionToast } from '@/hooks/use-action-toast'

export function BucketWeightForm({ bucketWeight }: { bucketWeight: number }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateBucketWeight, null)
  useActionToast(state)

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Вес ковша</CardTitle>
        <CardDescription>
          Применяется к новым записям подачи. Ранее внесённые подачи сохраняют вес ковша на момент записи.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bucket-weight">Вес одного ковша, т</Label>
            <Input
              id="bucket-weight"
              name="bucketWeight"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0.001"
              max="100"
              required
              defaultValue={bucketWeight}
              key={bucketWeight}
              className="font-mono"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
