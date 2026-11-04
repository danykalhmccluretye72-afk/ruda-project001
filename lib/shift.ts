// Хабаровск: UTC+10 круглый год (без перехода на летнее время с 2014 г.)
export const KHV_OFFSET_MS = 10 * 60 * 60 * 1000
export const KHV_TIME_ZONE = 'Asia/Vladivostok'

export type ShiftNo = 1 | 2
export type ShiftKey = { date: string; shift: ShiftNo }

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

/**
 * Смена 1: 19:00 предыдущего дня — 07:00 (относится к дате окончания).
 * Смена 2: 07:00 — 19:00.
 */
export function getShift(at: Date): ShiftKey {
  const local = new Date(at.getTime() + KHV_OFFSET_MS)
  const hour = local.getUTCHours()
  const day = local.toISOString().slice(0, 10)
  if (hour >= 19) return { date: addDays(day, 1), shift: 1 }
  if (hour < 7) return { date: day, shift: 1 }
  return { date: day, shift: 2 }
}

export function shiftBounds({ date, shift }: ShiftKey) {
  const startLocal = shift === 1 ? `${addDays(date, -1)}T19:00:00` : `${date}T07:00:00`
  const start = new Date(new Date(`${startLocal}Z`).getTime() - KHV_OFFSET_MS)
  const end = new Date(start.getTime() + 12 * 60 * 60 * 1000)
  return { start, end }
}

export function nextShift({ date, shift }: ShiftKey): ShiftKey {
  return shift === 1 ? { date, shift: 2 } : { date: addDays(date, 1), shift: 1 }
}

export function prevShift({ date, shift }: ShiftKey): ShiftKey {
  return shift === 2 ? { date, shift: 1 } : { date: addDays(date, -1), shift: 2 }
}

export const MAX_BATCH_DAYS = 93

/** Все смены в диапазоне дат (включительно) с выбранными номерами смен */
export function shiftsInRange(from: string, to: string, shifts: ShiftNo[]): ShiftKey[] {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(from) || !dateRe.test(to) || from > to || shifts.length === 0) return []
  const result: ShiftKey[] = []
  const sorted = [...new Set(shifts)].sort()
  for (let d = from, i = 0; d <= to && i < MAX_BATCH_DAYS; d = addDays(d, 1), i++) {
    for (const s of sorted) result.push({ date: d, shift: s })
  }
  return result
}

export function shiftDateOffset(date: string, days: number) {
  return addDays(date, days)
}

export function shiftHours(shift: ShiftNo) {
  return shift === 1 ? '19:00–07:00' : '07:00–19:00'
}

export function formatShiftDate(date: string) {
  const [y, m, d] = date.split('-')
  return `${d}.${m}.${y}`
}

export function formatShift(key: ShiftKey) {
  return `${formatShiftDate(key.date)}, смена ${key.shift} (${shiftHours(key.shift)})`
}

export function parseShiftKey(date?: string, shift?: string): ShiftKey | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) return null
  if (shift !== '1' && shift !== '2') return null
  return { date, shift: Number(shift) as ShiftNo }
}

export function shiftHref(path: string, key: ShiftKey) {
  return `${path}?date=${key.date}&shift=${key.shift}`
}

/** Значение для <input type="datetime-local"> по времени Хабаровска */
export function toKhvInputValue(at: Date) {
  return new Date(at.getTime() + KHV_OFFSET_MS).toISOString().slice(0, 16)
}

/** Разбор значения datetime-local как времени Хабаровска */
export function fromKhvInputValue(value: string) {
  return new Date(`${value}:00+10:00`)
}
