export type SequencePile = { id: number; planned: number; done: number }

/**
 * Равномерное перемешивание шихты: следующий ковш берётся из штабеля, который сильнее всего
 * отстаёт от своей доли плана к текущему номеру ковша. Отклонения (ковш «не из того» штабеля)
 * автоматически выравниваются последующими ковшами.
 */
export function pickNext(piles: SequencePile[]): number | null {
  const totalPlanned = piles.reduce((s, p) => s + p.planned, 0)
  if (totalPlanned <= 0) return null
  const k = piles.reduce((s, p) => s + Math.min(p.done, p.planned), 0)
  let best: SequencePile | null = null
  let bestScore = -Infinity
  for (const p of piles) {
    if (p.done >= p.planned) continue
    const score = (p.planned * (k + 1)) / totalPlanned - p.done
    if (score > bestScore + 1e-9) {
      best = p
      bestScore = score
    }
  }
  return best?.id ?? null
}

/** Ближайшие `count` ковшей по очереди. */
export function upcoming(piles: SequencePile[], count: number): number[] {
  const state = piles.map((p) => ({ ...p }))
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const id = pickNext(state)
    if (id === null) break
    result.push(id)
    const pile = state.find((p) => p.id === id)
    if (pile) pile.done += 1
  }
  return result
}
