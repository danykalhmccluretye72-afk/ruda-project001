import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const tonFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatTons(value: number) {
  return tonFormatter.format(value)
}

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(value: Date | string) {
  return dateTimeFormatter.format(new Date(value))
}
