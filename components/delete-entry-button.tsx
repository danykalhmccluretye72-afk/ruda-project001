'use client'

import { Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function DeleteEntryButton({ id, action }: { id: number; action: (formData: FormData) => Promise<void> }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label="Удалить запись"
      onClick={() => {
        if (!confirm('Удалить запись? Остатки будут пересчитаны.')) return
        const formData = new FormData()
        formData.set('id', String(id))
        startTransition(async () => {
          await action(formData)
          toast.success('Запись удалена')
        })
      }}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </Button>
  )
}
