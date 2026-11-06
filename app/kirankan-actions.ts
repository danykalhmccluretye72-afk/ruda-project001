'use server'

import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionState } from '@/app/actions'
import { db } from '@/lib/db'
import { kirankanAdjustments, kirankanReceipts, kirankanShipments, kirankanStockpiles } from '@/lib/db/schema'
import { assertKirankan } from '@/lib/session'
import { fromKhvInputValue } from '@/lib/shift'
import { formatTons } from '@/lib/utils'

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : null))

const occurredAtSchema = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return new Date()
    const d = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? fromKhvInputValue(v) : new Date(v)
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Некорректная дата' })
      return z.NEVER
    }
    return d
  })

const tonnage = (label: string) =>
  z.coerce
    .number({ message: `${label}: введите число` })
    .refine((v) => Number.isFinite(v) && v > 0 && v <= 1000, `${label}: от 0 до 1000 т`)

const nonNegative = (label: string) =>
  z.coerce
    .number({ message: `${label}: введите число` })
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 10_000_000, `${label}: значение не может быть отрицательным`)

const gradeSchema = z.coerce
  .number({ message: 'Содержание: введите число' })
  .refine((v) => Number.isFinite(v) && v >= 0 && v <= 1000, 'Содержание: от 0 до 1000 г/т')

const stockpileId = z.coerce.number().int().positive({ message: 'Выберите штабель' })

function revalidateAll() {
  revalidatePath('/', 'layout')
}

function fail(error: z.ZodError): ActionState {
  return { ok: false, message: error.issues[0]?.message ?? 'Ошибка ввода' }
}

async function getPile(id: number) {
  const [pile] = await db.select().from(kirankanStockpiles).where(eq(kirankanStockpiles.id, id))
  return pile ?? null
}

async function getPileBalance(id: number) {
  const result = await db.execute<{ balance: string }>(sql`
    select
      coalesce((select sum(net_weight_t) from kirankan_receipts where stockpile_id = ${id}), 0)
      - coalesce((select sum(net_weight_t) from kirankan_shipments where stockpile_id = ${id}), 0)
      + coalesce((select sum(delta_t) from kirankan_adjustments where stockpile_id = ${id}), 0) as balance
  `)
  return Number(result.rows[0]?.balance ?? 0)
}

/* ---------- Штабели ---------- */

const pileSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(100),
  auGrade: gradeSchema,
})

export async function addKirankanStockpile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertKirankan()
  const parsed = pileSchema.extend({ initialTonnage: nonNegative('Начальный остаток') }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  try {
    await db.transaction(async (tx) => {
      const [pile] = await tx
        .insert(kirankanStockpiles)
        .values({ name: data.name, auGrade: data.auGrade.toFixed(3) })
        .returning({ id: kirankanStockpiles.id })
      if (data.initialTonnage > 0) {
        await tx
          .insert(kirankanAdjustments)
          .values({ stockpileId: pile.id, deltaT: data.initialTonnage.toFixed(3), note: 'Начальный остаток' })
      }
    })
  } catch {
    return { ok: false, message: 'Штабель с таким названием уже существует' }
  }
  revalidateAll()
  return { ok: true, message: `Штабель «${data.name}» создан` }
}

export async function updateKirankanStockpile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertKirankan()
  const parsed = pileSchema.extend({ id: stockpileId }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  try {
    await db
      .update(kirankanStockpiles)
      .set({ name: data.name, auGrade: data.auGrade.toFixed(3) })
      .where(eq(kirankanStockpiles.id, data.id))
  } catch {
    return { ok: false, message: 'Штабель с таким названием уже существует' }
  }
  revalidateAll()
  return { ok: true, message: 'Штабель обновлён' }
}

export async function deleteKirankanStockpile(id: number, confirmName: string): Promise<ActionState> {
  await assertKirankan()
  const pile = await getPile(id)
  if (!pile) return { ok: false, message: 'Штабель не найден' }
  if (confirmName.trim() !== pile.name) return { ok: false, message: 'Название не совпадает' }
  await db.delete(kirankanStockpiles).where(eq(kirankanStockpiles.id, id))
  revalidateAll()
  return { ok: true, message: `Штабель «${pile.name}» удалён` }
}

/* ---------- Поступление и отгрузка ---------- */

const movementSchema = z.object({
  stockpileId,
  occurredAt: occurredAtSchema,
  netWeightT: tonnage('Вес нетто'),
  truckNumber: optionalText,
  ticketNumber: optionalText,
  note: optionalText,
})

export async function addKirankanReceipt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertKirankan()
  const parsed = movementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  if (!(await getPile(data.stockpileId))) return { ok: false, message: 'Штабель не найден' }
  await db.insert(kirankanReceipts).values({ ...data, netWeightT: data.netWeightT.toFixed(3) })
  revalidateAll()
  return { ok: true, message: `Поступление ${formatTons(data.netWeightT)} т записано` }
}

export async function addKirankanShipment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertKirankan()
  const parsed = movementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  const pile = await getPile(data.stockpileId)
  if (!pile) return { ok: false, message: 'Штабель не найден' }
  const balance = await getPileBalance(pile.id)
  if (data.netWeightT > balance + 0.0005) {
    return { ok: false, message: `Отгрузка больше остатка штабеля (${formatTons(Math.max(0, balance))} т)` }
  }
  await db
    .insert(kirankanShipments)
    .values({ ...data, netWeightT: data.netWeightT.toFixed(3), auGrade: pile.auGrade })
  revalidateAll()
  return { ok: true, message: `Отгрузка ${formatTons(data.netWeightT)} т на Перевальное записана` }
}

/* ---------- Корректировка остатка ---------- */

const adjustSchema = z.object({
  stockpileId,
  actualT: nonNegative('Фактический остаток'),
  note: optionalText,
})

export async function adjustKirankanBalance(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertKirankan()
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  if (!(await getPile(data.stockpileId))) return { ok: false, message: 'Штабель не найден' }
  const delta = Math.round((data.actualT - (await getPileBalance(data.stockpileId))) * 1000) / 1000
  if (delta === 0) return { ok: true, message: 'Остаток не изменился' }
  await db.insert(kirankanAdjustments).values({
    stockpileId: data.stockpileId,
    deltaT: delta.toFixed(3),
    note: data.note ?? 'Корректировка остатка',
  })
  revalidateAll()
  return { ok: true, message: `Остаток установлен: ${formatTons(data.actualT)} т` }
}

/* ---------- Удаление записей журнала ---------- */

const tables = {
  receipt: kirankanReceipts,
  shipment: kirankanShipments,
  adjustment: kirankanAdjustments,
} as const

export async function deleteKirankanEntry(formData: FormData) {
  await assertKirankan()
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  const kind = z.enum(['receipt', 'shipment', 'adjustment']).parse(formData.get('kind'))
  const table = tables[kind]
  await db.delete(table).where(eq(table.id, id))
  revalidateAll()
}
