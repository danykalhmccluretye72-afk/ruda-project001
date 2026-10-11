'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { appSettings, oreFeeds, oreReceipts, stockpiles } from '@/lib/db/schema'
import { BUCKET_WEIGHT_KEY, getBucketWeight } from '@/lib/queries'
import { formatTons } from '@/lib/utils'

export type ActionState = { ok: boolean; message: string } | null

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
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Некорректная дата' })
      return z.NEVER
    }
    return d
  })

const positiveNumber = (label: string) =>
  z.coerce
    .number({ message: `${label}: введите число` })
    .refine((v) => Number.isFinite(v) && v > 0, `${label}: значение должно быть больше нуля`)

function revalidateAll() {
  revalidatePath('/', 'layout')
}

function fail(error: z.ZodError): ActionState {
  return { ok: false, message: error.issues[0]?.message ?? 'Ошибка ввода' }
}

async function assertActiveStockpile(id: number) {
  const [pile] = await db
    .select({ id: stockpiles.id })
    .from(stockpiles)
    .where(and(eq(stockpiles.id, id), eq(stockpiles.isActive, true)))
  return Boolean(pile)
}

const receiptSchema = z.object({
  stockpileId: z.coerce.number().int().positive({ message: 'Выберите штабель' }),
  occurredAt: occurredAtSchema,
  netWeightT: positiveNumber('Вес нетто').refine((v) => v <= 1000, 'Вес нетто: не более 1000 т на рейс'),
  truckNumber: optionalText,
  ticketNumber: optionalText,
  note: optionalText,
})

export async function addReceipt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = receiptSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  if (!(await assertActiveStockpile(data.stockpileId))) return { ok: false, message: 'Штабель не найден' }

  await db.insert(oreReceipts).values({
    stockpileId: data.stockpileId,
    occurredAt: data.occurredAt,
    netWeightT: data.netWeightT.toFixed(3),
    truckNumber: data.truckNumber,
    ticketNumber: data.ticketNumber,
    note: data.note,
  })
  revalidateAll()
  return { ok: true, message: `Поступление ${formatTons(data.netWeightT)} т записано` }
}

export async function deleteReceipt(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  await db.delete(oreReceipts).where(eq(oreReceipts.id, id))
  revalidateAll()
}

const feedSchema = z.object({
  stockpileId: z.coerce.number().int().positive({ message: 'Выберите штабель' }),
  occurredAt: occurredAtSchema,
  bucketCount: z.coerce
    .number({ message: 'Количество ковшей: введите число' })
    .int('Количество ковшей должно быть целым')
    .positive('Количество ковшей должно быть больше нуля')
    .max(10000, 'Количество ковшей: не более 10000 за запись'),
  loader: optionalText,
  note: optionalText,
})

export async function addFeed(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = feedSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  if (!(await assertActiveStockpile(data.stockpileId))) return { ok: false, message: 'Штабель не найден' }

  const bucketWeight = await getBucketWeight()
  await db.insert(oreFeeds).values({
    stockpileId: data.stockpileId,
    occurredAt: data.occurredAt,
    bucketCount: data.bucketCount,
    bucketWeightT: bucketWeight.toFixed(3),
    loader: data.loader,
    note: data.note,
  })
  revalidateAll()
  return {
    ok: true,
      message: `Подача ${data.bucketCount} ковш. × ${formatTons(bucketWeight)} т = ${formatTons(data.bucketCount * bucketWeight)} т записана`,
  }
}

export async function deleteFeed(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  await db.delete(oreFeeds).where(eq(oreFeeds.id, id))
  revalidateAll()
}

export async function updateBucketWeight(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = positiveNumber('Вес ковша')
    .refine((v) => v <= 100, 'Вес ковша: не более 100 т')
    .safeParse(formData.get('bucketWeight'))
  if (!parsed.success) return fail(parsed.error)

  const value = String(parsed.data)
  await db
    .insert(appSettings)
    .values({ key: BUCKET_WEIGHT_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
  revalidateAll()
  return { ok: true, message: `Вес ковша установлен: ${parsed.data} т` }
}

const stockpileSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название штабеля').max(100),
  initialTonnage: z.coerce
    .number({ message: 'Исходный остаток: введите число' })
    .refine((v) => Number.isFinite(v) && v >= 0, 'Исходный остаток не может быть отрицательным'),
})

export async function addStockpile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = stockpileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const inserted = await db
    .insert(stockpiles)
    .values({ name: parsed.data.name, initialTonnage: parsed.data.initialTonnage.toFixed(3) })
    .onConflictDoNothing({ target: stockpiles.name })
    .returning({ id: stockpiles.id })
  if (inserted.length === 0) return { ok: false, message: 'Штабель с таким названием уже существует' }
  revalidateAll()
  return { ok: true, message: `Штабель «${parsed.data.name}» добавлен` }
}

export async function updateStockpile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Штабель не найден' }
  const parsed = stockpileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)

  try {
    await db
      .update(stockpiles)
      .set({ name: parsed.data.name, initialTonnage: parsed.data.initialTonnage.toFixed(3) })
      .where(eq(stockpiles.id, id.data))
  } catch {
    return { ok: false, message: 'Штабель с таким названием уже существует' }
  }
  revalidateAll()
  return { ok: true, message: 'Штабель обновлён' }
}

export async function toggleStockpileActive(formData: FormData) {
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  const active = formData.get('active') === 'true'
  await db.update(stockpiles).set({ isActive: active }).where(eq(stockpiles.id, id))
  revalidateAll()
}
