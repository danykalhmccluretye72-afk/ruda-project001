'use server'

import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { crushingLines, crushingOps, loaders, oreFeeds, oreReceipts, shiftPlans, stockpiles } from '@/lib/db/schema'
import {
  MAX_BATCH_DAYS,
  formatShift,
  formatShiftDate,
  fromKhvInputValue,
  getShift,
  parseShiftKey,
  shiftDateOffset,
  shiftsInRange,
  type ShiftNo,
} from '@/lib/shift'
import { assertOperator } from '@/lib/session'
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
    // datetime-local has no zone; the server runs in UTC, so read it as Khabarovsk time.
    const d = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? fromKhvInputValue(v) : new Date(v)
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

const gradeSchema = z.coerce
  .number({ message: 'Содержание: введите число' })
  .refine((v) => Number.isFinite(v) && v >= 0 && v <= 1000, 'Содержание: от 0 до 1000 г/т')

function revalidateAll() {
  revalidatePath('/', 'layout')
}

function fail(error: z.ZodError): ActionState {
  return { ok: false, message: error.issues[0]?.message ?? 'Ошибка ввода' }
}

async function getActiveStockpile(id: number) {
  const [pile] = await db
    .select({ id: stockpiles.id, auGrade: stockpiles.auGrade })
    .from(stockpiles)
    .where(and(eq(stockpiles.id, id), eq(stockpiles.isActive, true)))
  return pile ?? null
}

/* ---------- Поступление ---------- */

const receiptSchema = z.object({
  stockpileId: z.coerce.number().int().positive({ message: 'Выберите штабель' }),
  occurredAt: occurredAtSchema,
  netWeightT: positiveNumber('Вес нетто').refine((v) => v <= 1000, 'Вес нетто: не более 1000 т на рейс'),
  truckNumber: optionalText,
  ticketNumber: optionalText,
  note: optionalText,
})

export async function addReceipt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const parsed = receiptSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data
  if (!(await getActiveStockpile(data.stockpileId))) return { ok: false, message: 'Штабель не найден' }

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
  await assertOperator()
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  await db.delete(oreReceipts).where(eq(oreReceipts.id, id))
  revalidateAll()
}

/* ---------- Подача ---------- */

const feedSchema = z.object({
  stockpileId: z.coerce.number().int().positive({ message: 'Выберите штабель' }),
  loaderId: z.coerce.number().int().positive({ message: 'Выберите погрузчик' }),
  occurredAt: occurredAtSchema,
  bucketCount: z.coerce
    .number({ message: 'Количество ковшей: введите число' })
    .int('Количество ковшей должно быть целым')
    .positive('Количество ковшей должно быть больше нуля')
    .max(10000, 'Количество ковшей: не более 10000 за запись'),
  note: optionalText,
})

export async function addFeed(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const parsed = feedSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data

  const pile = await getActiveStockpile(data.stockpileId)
  if (!pile) return { ok: false, message: 'Штабель не найден' }
  const [loader] = await db
    .select()
    .from(loaders)
    .where(and(eq(loaders.id, data.loaderId), eq(loaders.isActive, true)))
  if (!loader) return { ok: false, message: 'Погрузчик не найден' }

  const bucketWeight = Number(loader.bucketWeightT)
  const shift = getShift(data.occurredAt)
  await db.insert(oreFeeds).values({
    stockpileId: data.stockpileId,
    loaderId: loader.id,
    loader: loader.name,
    occurredAt: data.occurredAt,
    bucketCount: data.bucketCount,
    bucketWeightT: loader.bucketWeightT,
    auGrade: pile.auGrade,
    shiftDate: shift.date,
    shiftNo: shift.shift,
    note: data.note,
  })
  revalidateAll()
  return {
    ok: true,
    message: `Подача ${data.bucketCount} ковш. × ${formatTons(bucketWeight)} т = ${formatTons(data.bucketCount * bucketWeight)} т записана в смену ${shift.shift}`,
  }
}

export async function deleteFeed(formData: FormData) {
  await assertOperator()
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  await db.delete(oreFeeds).where(eq(oreFeeds.id, id))
  revalidateAll()
}

/* ---------- Погрузчики ---------- */

const loaderSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название погрузчика').max(100),
  bucketWeightT: positiveNumber('Вес ковша').refine((v) => v <= 100, 'Вес ковша: не более 100 т'),
})

export async function addLoader(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const parsed = loaderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const inserted = await db
    .insert(loaders)
    .values({ name: parsed.data.name, bucketWeightT: parsed.data.bucketWeightT.toFixed(3) })
    .onConflictDoNothing({ target: loaders.name })
    .returning({ id: loaders.id })
  if (inserted.length === 0) return { ok: false, message: 'Погрузчик с таким названием уже существует' }
  revalidateAll()
  return { ok: true, message: `Погрузчик «${parsed.data.name}» добавлен` }
}

export async function updateLoader(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Погрузчик не найден' }
  const parsed = loaderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  try {
    await db
      .update(loaders)
      .set({ name: parsed.data.name, bucketWeightT: parsed.data.bucketWeightT.toFixed(3) })
      .where(eq(loaders.id, id.data))
  } catch {
    return { ok: false, message: 'Погрузчик с таким названием уже существует' }
  }
  revalidateAll()
  return { ok: true, message: 'Погрузчик обновлён. Новый вес ковша применяется к следующим подачам.' }
}

export async function toggleLoaderActive(formData: FormData) {
  await assertOperator()
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  const active = formData.get('active') === 'true'
  await db.update(loaders).set({ isActive: active }).where(eq(loaders.id, id))
  revalidateAll()
}

/* ---------- Штабели ---------- */

const stockpileSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название штабеля').max(100),
  initialTonnage: z.coerce
    .number({ message: 'Исходный остаток: введите число' })
    .refine((v) => Number.isFinite(v) && v >= 0, 'Исходный остаток не может быть отрицательным'),
  auGrade: gradeSchema,
})

export async function addStockpile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const parsed = stockpileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)
  const inserted = await db
    .insert(stockpiles)
    .values({
      name: parsed.data.name,
      initialTonnage: parsed.data.initialTonnage.toFixed(3),
      auGrade: parsed.data.auGrade.toFixed(3),
    })
    .onConflictDoNothing({ target: stockpiles.name })
    .returning({ id: stockpiles.id })
  if (inserted.length === 0) return { ok: false, message: 'Штабель с таким названием уже существует' }
  revalidateAll()
  return { ok: true, message: `Штабель «${parsed.data.name}» добавлен` }
}

export async function updateStockpile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const id = z.coerce.number().int().positive().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Штабель не найден' }
  const parsed = stockpileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fail(parsed.error)

  try {
    await db
      .update(stockpiles)
      .set({
        name: parsed.data.name,
        initialTonnage: parsed.data.initialTonnage.toFixed(3),
        auGrade: parsed.data.auGrade.toFixed(3),
      })
      .where(eq(stockpiles.id, id.data))
  } catch {
    return { ok: false, message: 'Штабель с таким названием уже существует' }
  }
  revalidateAll()
  return { ok: true, message: 'Штабель обновлён' }
}

export async function toggleStockpileActive(formData: FormData) {
  await assertOperator()
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  const active = formData.get('active') === 'true'
  await db.update(stockpiles).set({ isActive: active }).where(eq(stockpiles.id, id))
  revalidateAll()
}

/* ---------- Планирование ---------- */

const planValue = z.coerce
  .number({ message: 'План: введите число' })
  .refine((v) => Number.isFinite(v) && v >= 0 && v <= 100000, 'План: от 0 до 100 000 т')

type PlanEntry = { stockpileId: number; plannedT: number }

async function parsePlanEntries(formData: FormData): Promise<{ entries: PlanEntry[] } | { error: ActionState }> {
  const entries: PlanEntry[] = []
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith('plan_')) continue
    const stockpileId = Number(name.slice(5))
    if (!Number.isInteger(stockpileId) || stockpileId <= 0) continue
    const text = String(raw).trim().replace(',', '.')
    const parsed = planValue.safeParse(text === '' ? 0 : text)
    if (!parsed.success) return { error: fail(parsed.error) }
    entries.push({ stockpileId, plannedT: parsed.data })
  }
  const ids = entries.map((e) => e.stockpileId)
  const valid = ids.length
    ? await db.select({ id: stockpiles.id }).from(stockpiles).where(inArray(stockpiles.id, ids))
    : []
  const validIds = new Set(valid.map((v) => v.id))
  return { entries: entries.filter((e) => validIds.has(e.stockpileId)) }
}

export async function saveShiftPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const key = parseShiftKey(String(formData.get('shiftDate') ?? ''), String(formData.get('shiftNo') ?? ''))
  if (!key) return { ok: false, message: 'Некорректная смена' }

  const parsedEntries = await parsePlanEntries(formData)
  if ('error' in parsedEntries) return parsedEntries.error
  const filtered = parsedEntries.entries

  await db.transaction(async (tx) => {
    await tx
      .delete(shiftPlans)
      .where(and(eq(shiftPlans.shiftDate, key.date), eq(shiftPlans.shiftNo, key.shift)))
    const rows = filtered
      .filter((e) => e.plannedT > 0)
      .map((e) => ({
        shiftDate: key.date,
        shiftNo: key.shift,
        stockpileId: e.stockpileId,
        plannedT: e.plannedT.toFixed(3),
      }))
    if (rows.length) await tx.insert(shiftPlans).values(rows)
  })
  revalidateAll()
  const total = filtered.reduce((s, e) => s + e.plannedT, 0)
  return { ok: true, message: `План на ${formatShift(key)} сохранён: ${formatTons(total)} т` }
}

export async function saveBatchShiftPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const from = String(formData.get('batchFrom') ?? '')
  const to = String(formData.get('batchTo') ?? '')
  const shiftNos = formData
    .getAll('batchShift')
    .map(String)
    .filter((s) => s === '1' || s === '2')
    .map((s) => Number(s) as ShiftNo)
  const overwrite = formData.get('batchOverwrite') === 'on'

  if (!parseShiftKey(from, '1') || !parseShiftKey(to, '1')) return { ok: false, message: 'Укажите даты периода' }
  if (from > to) return { ok: false, message: 'Дата начала позже даты окончания' }
  if (shiftNos.length === 0) return { ok: false, message: 'Выберите хотя бы одну смену' }
  if (shiftDateOffset(from, MAX_BATCH_DAYS - 1) < to) {
    return { ok: false, message: `Период не может превышать ${MAX_BATCH_DAYS} дн.` }
  }

  const targets = shiftsInRange(from, to, shiftNos)
  const parsedEntries = await parsePlanEntries(formData)
  if ('error' in parsedEntries) return parsedEntries.error
  const entries = parsedEntries.entries.filter((e) => e.plannedT > 0)
  if (entries.length === 0) return { ok: false, message: 'План пуст — заполните тоннаж или доли' }

  const existing = await db
    .selectDistinct({ date: shiftPlans.shiftDate, shift: shiftPlans.shiftNo })
    .from(shiftPlans)
    .where(and(gte(shiftPlans.shiftDate, from), lte(shiftPlans.shiftDate, to)))
  const existingKeys = new Set(existing.map((e) => `${e.date}|${e.shift}`))
  const toWrite = overwrite ? targets : targets.filter((t) => !existingKeys.has(`${t.date}|${t.shift}`))
  if (toWrite.length === 0) {
    return { ok: false, message: 'На все выбранные смены план уже задан. Включите «Перезаписать».' }
  }

  await db.transaction(async (tx) => {
    for (const t of toWrite) {
      await tx.delete(shiftPlans).where(and(eq(shiftPlans.shiftDate, t.date), eq(shiftPlans.shiftNo, t.shift)))
    }
    await tx.insert(shiftPlans).values(
      toWrite.flatMap((t) =>
        entries.map((e) => ({
          shiftDate: t.date,
          shiftNo: t.shift,
          stockpileId: e.stockpileId,
          plannedT: e.plannedT.toFixed(3),
        })),
      ),
    )
  })
  revalidateAll()
  const perShift = entries.reduce((s, e) => s + e.plannedT, 0)
  const skipped = targets.length - toWrite.length
  return {
    ok: true,
    message: `План записан на ${toWrite.length} смен (${formatShiftDate(from)}–${formatShiftDate(to)}): ${formatTons(perShift * toWrite.length)} т${skipped ? `, пропущено ${skipped} смен с существующим планом` : ''}`,
  }
}

/* ---------- Полное удаление штабеля ---------- */

export async function deleteStockpile(id: number, confirmName: string): Promise<ActionState> {
  await assertOperator()
  const pileId = z.number().int().positive().safeParse(id)
  if (!pileId.success) return { ok: false, message: 'Штабель не найден' }
  const [pile] = await db.select({ name: stockpiles.name }).from(stockpiles).where(eq(stockpiles.id, pileId.data))
  if (!pile) return { ok: false, message: 'Штабель не найден' }
  if (confirmName.trim() !== pile.name) return { ok: false, message: 'Название штабеля введено неверно' }

  await db.transaction(async (tx) => {
    await tx.delete(crushingOps).where(eq(crushingOps.targetStockpileId, pileId.data))
    await tx.delete(crushingLines).where(eq(crushingLines.sourceStockpileId, pileId.data))
    await tx.execute(sql`delete from crushing_ops o where not exists (select 1 from crushing_lines l where l.op_id = o.id)`)
    await tx.delete(shiftPlans).where(eq(shiftPlans.stockpileId, pileId.data))
    await tx.delete(oreFeeds).where(eq(oreFeeds.stockpileId, pileId.data))
    await tx.delete(oreReceipts).where(eq(oreReceipts.stockpileId, pileId.data))
    await tx.delete(stockpiles).where(eq(stockpiles.id, pileId.data))
  })
  revalidateAll()
  return { ok: true, message: `Штабель «${pile.name}» и все его записи удалены` }
}

/* ---------- Дробление ---------- */

const crushingSchema = z.object({
  targetStockpileId: z.coerce.number().int().positive({ message: 'Выберите целевой штабель' }),
  loaderId: z.coerce.number().int().positive({ message: 'Выберите погрузчик' }),
  occurredAt: occurredAtSchema,
  note: optionalText,
})

const crushingBuckets = z.coerce
  .number({ message: 'Количество ковшей: введите число' })
  .int('Количество ковшей должно быть целым')
  .positive('Количество ковшей должно быть больше нуля')
  .max(10000, 'Количество ковшей: не более 10000 на штабель')

export async function addCrushing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const parsed = crushingSchema.safeParse({
    targetStockpileId: formData.get('targetStockpileId'),
    loaderId: formData.get('loaderId'),
    occurredAt: formData.get('occurredAt') ?? undefined,
    note: formData.get('note') ?? undefined,
  })
  if (!parsed.success) return fail(parsed.error)
  const data = parsed.data

  const sourceIds = formData.getAll('sourceId').map((v) => Number(v))
  const bucketValues = formData.getAll('buckets')
  if (sourceIds.length === 0 || sourceIds.length !== bucketValues.length) {
    return { ok: false, message: 'Добавьте хотя бы один исходный штабель' }
  }

  const lines: { sourceId: number; buckets: number }[] = []
  for (let i = 0; i < sourceIds.length; i++) {
    const sourceId = sourceIds[i]
    if (!Number.isInteger(sourceId) || sourceId <= 0) return { ok: false, message: 'Выберите исходный штабель' }
    const buckets = crushingBuckets.safeParse(bucketValues[i])
    if (!buckets.success) return fail(buckets.error)
    lines.push({ sourceId, buckets: buckets.data })
  }
  if (new Set(lines.map((l) => l.sourceId)).size !== lines.length) {
    return { ok: false, message: 'Один и тот же исходный штабель указан дважды' }
  }
  if (lines.some((l) => l.sourceId === data.targetStockpileId)) {
    return { ok: false, message: 'Целевой штабель не может быть исходным' }
  }

  const ids = [data.targetStockpileId, ...lines.map((l) => l.sourceId)]
  const piles = await db
    .select({ id: stockpiles.id, auGrade: stockpiles.auGrade })
    .from(stockpiles)
    .where(and(inArray(stockpiles.id, ids), eq(stockpiles.isActive, true)))
  const gradeById = new Map(piles.map((p) => [p.id, p.auGrade]))
  if (ids.some((id) => !gradeById.has(id))) return { ok: false, message: 'Штабель не найден или в архиве' }

  const [loader] = await db
    .select()
    .from(loaders)
    .where(and(eq(loaders.id, data.loaderId), eq(loaders.isActive, true)))
  if (!loader) return { ok: false, message: 'Погрузчик не найден' }

  const shift = getShift(data.occurredAt)
  await db.transaction(async (tx) => {
    const [op] = await tx
      .insert(crushingOps)
      .values({
        occurredAt: data.occurredAt,
        shiftDate: shift.date,
        shiftNo: shift.shift,
        targetStockpileId: data.targetStockpileId,
        loaderId: loader.id,
        loader: loader.name,
        bucketWeightT: loader.bucketWeightT,
        note: data.note,
      })
      .returning({ id: crushingOps.id })
    await tx.insert(crushingLines).values(
      lines.map((l) => ({
        opId: op.id,
        sourceStockpileId: l.sourceId,
        bucketCount: l.buckets,
        auGrade: gradeById.get(l.sourceId) ?? '0',
      })),
    )
  })
  revalidateAll()
  const buckets = lines.reduce((s, l) => s + l.buckets, 0)
  const tonnage = buckets * Number(loader.bucketWeightT)
  return { ok: true, message: `Дробление ${buckets} ковш. = ${formatTons(tonnage)} т записано в смену ${shift.shift}` }
}

export async function deleteCrushing(formData: FormData) {
  await assertOperator()
  const id = z.coerce.number().int().positive().parse(formData.get('id'))
  await db.delete(crushingOps).where(eq(crushingOps.id, id))
  revalidateAll()
}
