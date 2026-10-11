'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { ActionState } from '@/app/actions'
import { fromKhvInputValue, toKhvInputValue } from '@/lib/shift'

export function useActionToast(state: ActionState, onSuccess?: () => void) {
  const lastState = useRef<ActionState>(null)

  useEffect(() => {
    if (!state || state === lastState.current) return
    lastState.current = state
    if (state.ok) {
      toast.success(state.message)
      onSuccess?.()
    } else {
      toast.error(state.message)
    }
  }, [state, onSuccess])
}

export function toLocalInputValue(date: Date) {
  return toKhvInputValue(date)
}

export function withIsoDate(formData: FormData) {
  const local = formData.get('occurredAtLocal')
  if (typeof local === 'string' && local) {
    formData.set('occurredAt', fromKhvInputValue(local).toISOString())
  }
  formData.delete('occurredAtLocal')
  return formData
}
