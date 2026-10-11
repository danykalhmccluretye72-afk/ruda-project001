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
  timeZone: 'Asia/Vladivostok',
})

export function formatDateTime(value: Date | string) {
  return dateTimeFormatter.format(new Date(value))
}

const gradeFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatGrade(value: number) {
  return gradeFormatter.format(value)
}

const metalFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatMetal(grams: number) {
  return metalFormatter.format(grams)
}

const percentFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatPercent(value: number) {
  return `${percentFormatter.format(value)}%`
}
