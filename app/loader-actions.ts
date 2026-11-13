'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { loaders, oreFeeds, stockpiles } from '@/lib/db/schema'
import { assertLoaderOperator } from '@/lib/session'
import { getShift } from '@/lib/shift'

export type LoaderActionState = { ok: boolean; message: string }

const idSchema = z.coerce.number().int().positive()

/** Записать один ковш в подачу текущей смены. */
export async function recordBucket(stockpileId: number, loaderId: number): Promise<LoaderActionState> {
  await assertLoaderOperator()
  const pileId = idSchema.safeParse(stockpileId)
  const machineId = idSchema.safeParse(loaderId)
  if (!pileId.success || !machineId.success) return { ok: false, message: 'Некорректные данные' }

  const [[pile], [loader]] = await Promise.all([
    db
      .select({ id: stockpiles.id, name: stockpiles.name, auGrade: stockpiles.auGrade })
      .from(stockpiles)
      .where(and(eq(stockpiles.id, pileId.data), eq(stockpiles.isActive, true), eq(stockpiles.isHistorical, false))),
    db
      .select()
      .from(loaders)
      .where(and(eq(loaders.id, machineId.data), eq(loaders.isActive, true))),
  ])
  if (!pile) return { ok: false, message: 'Штабель не найден' }
  if (!loader) return { ok: false, message: 'Погрузчик не найден' }

  const now = new Date()
  const shift = getShift(now)
  await db.insert(oreFeeds).values({
    stockpileId: pile.id,
    loaderId: loader.id,
    loader: loader.name,
    occurredAt: now,
    bucketCount: 1,
    bucketWeightT: loader.bucketWeightT,
    auGrade: pile.auGrade,
    shiftDate: shift.date,
    shiftNo: shift.shift,
    note: 'Погрузчик: ковш',
  })
  revalidatePath('/', 'layout')
  return { ok: true, message: `Ковш из «${pile.name}» записан` }
}

/** Отменить последний ковш этого погрузчика в текущей смене. */
export async function undoLastBucket(loaderId: number): Promise<LoaderActionState> {
  await assertLoaderOperator()
  const machineId = idSchema.safeParse(loaderId)
  if (!machineId.success) return { ok: false, message: 'Некорректные данные' }

  const shift = getShift(new Date())
  const [last] = await db
    .select({ id: oreFeeds.id, name: stockpiles.name })
    .from(oreFeeds)
    .leftJoin(stockpiles, eq(stockpiles.id, oreFeeds.stockpileId))
    .where(
      and(
        eq(oreFeeds.loaderId, machineId.data),
        eq(oreFeeds.shiftDate, shift.date),
        eq(oreFeeds.shiftNo, shift.shift),
        eq(oreFeeds.bucketCount, 1),
      ),
    )
    .orderBy(desc(oreFeeds.occurredAt), desc(oreFeeds.id))
    .limit(1)
  if (!last) return { ok: false, message: 'В этой смене нет ковшей для отмены' }

  await db.delete(oreFeeds).where(eq(oreFeeds.id, last.id))
  revalidatePath('/', 'layout')
  return { ok: true, message: `Ковш из «${last.name ?? 'штабеля'}» отменён` }
}
