'use server'

import { and, asc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { oreFeeds, shiftClosureLines, shiftClosures, stockpiles } from '@/lib/db/schema'
import { formatShift, parseShiftKey, shiftBounds, type ShiftKey } from '@/lib/shift'
import { assertOperator } from '@/lib/session'
import { formatTons } from '@/lib/utils'
import type { ActionState } from './actions'

const EPS = 0.0005

const round3 = (v: number) => Math.round(v * 1000) / 1000

async function getShiftFeedByPile(key: ShiftKey) {
  const rows = await db
    .select({
      stockpileId: oreFeeds.stockpileId,
      tonnage: sql<string>`coalesce(sum(${oreFeeds.bucketCount} * ${oreFeeds.bucketWeightT}), 0)`,
      metal: sql<string>`coalesce(sum(${oreFeeds.bucketCount} * ${oreFeeds.bucketWeightT} * ${oreFeeds.auGrade}), 0)`,
    })
    .from(oreFeeds)
    .where(and(eq(oreFeeds.shiftDate, key.date), eq(oreFeeds.shiftNo, key.shift)))
    .groupBy(oreFeeds.stockpileId)
    .orderBy(asc(oreFeeds.stockpileId))
  return rows
    .map((r) => ({ stockpileId: r.stockpileId, tonnage: Number(r.tonnage), metal: Number(r.metal) }))
    .filter((r) => r.tonnage > 0)
}

const closureSchema = z.object({
  date: z.string(),
  shift: z.string(),
  scaleT: z.coerce
    .number({ message: 'Факт по весам: введите число' })
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 100000, 'Факт по весам: от 0 до 100 000 т'),
  targetStockpileId: z.coerce.number().int().optional(),
  note: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null)),
})

export async function saveShiftClosure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await assertOperator()
  const parsed = closureSchema.safeParse({
    date: formData.get('date'),
    shift: formData.get('shift'),
    scaleT: formData.get('scaleT'),
    targetStockpileId: formData.get('targetStockpileId') || undefined,
    note: formData.get('note') ?? undefined,
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Ошибка ввода' }
  const key = parseShiftKey(parsed.data.date, parsed.data.shift)
  if (!key) return { ok: false, message: 'Некорректная смена' }

  const feed = await getShiftFeedByPile(key)
  const fedT = round3(feed.reduce((s, f) => s + f.tonnage, 0))
  const metal = feed.reduce((s, f) => s + f.metal, 0)
  const blendGrade = fedT > 0 ? metal / fedT : 0
  const scaleT = round3(parsed.data.scaleT)
  const diff = round3(scaleT - fedT)

  let lines: { stockpileId: number; deltaT: number; auGrade: number }[] = []
  let targetStockpileId: number | null = null

  if (diff > EPS) {
    if (fedT <= 0) return { ok: false, message: 'За смену нет подачи — не по чему распределить досписание' }
    let rest = diff
    lines = feed.map((f, i) => {
      const delta = i === feed.length - 1 ? round3(rest) : round3((diff * f.tonnage) / fedT)
      rest -= delta
      return { stockpileId: f.stockpileId, deltaT: delta, auGrade: f.tonnage > 0 ? f.metal / f.tonnage : 0 }
    })
  } else if (diff < -EPS) {
    const id = parsed.data.targetStockpileId
    if (!id) return { ok: false, message: 'Выберите целевой штабель для излишка' }
    const [pile] = await db
      .select({ id: stockpiles.id })
      .from(stockpiles)
      .where(and(eq(stockpiles.id, id), eq(stockpiles.isActive, true)))
    if (!pile) return { ok: false, message: 'Целевой штабель не найден или в архиве' }
    targetStockpileId = pile.id
    lines = [{ stockpileId: pile.id, deltaT: diff, auGrade: blendGrade }]
  }

  // Корректировка относится к последней секунде смены, чтобы попасть в её остатки на конец.
  const occurredAt = new Date(shiftBounds(key).end.getTime() - 1000)

  await db.transaction(async (tx) => {
    const values = {
      shiftDate: key.date,
      shiftNo: key.shift,
      scaleT: String(scaleT),
      fedT: String(fedT),
      blendGrade: String(round3(blendGrade)),
      targetStockpileId,
      occurredAt,
      note: parsed.data.note,
      updatedAt: new Date(),
    }
    const [closure] = await tx
      .insert(shiftClosures)
      .values(values)
      .onConflictDoUpdate({ target: [shiftClosures.shiftDate, shiftClosures.shiftNo], set: values })
      .returning({ id: shiftClosures.id })
    await tx.delete(shiftClosureLines).where(eq(shiftClosureLines.closureId, closure.id))
    if (lines.length > 0) {
      await tx.insert(shiftClosureLines).values(
        lines.map((l) => ({
          closureId: closure.id,
          stockpileId: l.stockpileId,
          deltaT: String(l.deltaT),
          auGrade: String(round3(l.auGrade)),
        })),
      )
    }
  })

  revalidatePath('/', 'layout')
  const result =
    diff > EPS
      ? `досписано ${formatTons(diff)} т со штабелей`
      : diff < -EPS
        ? `излишек ${formatTons(-diff)} т направлен в целевой штабель`
        : 'расхождения нет'
  return { ok: true, message: `Смена закрыта (${formatShift(key)}): ${result}` }
}

export async function deleteShiftClosure(formData: FormData) {
  await assertOperator()
  const key = parseShiftKey(String(formData.get('date') ?? ''), String(formData.get('shift') ?? ''))
  if (!key) return
  await db
    .delete(shiftClosures)
    .where(and(eq(shiftClosures.shiftDate, key.date), eq(shiftClosures.shiftNo, key.shift)))
  await db.execute(
    sql`delete from shift_closure_lines l where not exists (select 1 from shift_closures c where c.id = l.closure_id)`,
  )
  revalidatePath('/', 'layout')
}
