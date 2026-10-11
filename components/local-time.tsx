'use client'

import { formatDateTime } from '@/lib/utils'

export function LocalTime({ value }: { value: string }) {
  return (
    <time dateTime={value} suppressHydrationWarning>
      {formatDateTime(value)}
    </time>
  )
}
