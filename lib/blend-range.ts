export type RangeShifts = 'all' | '1' | '2'

export function blendRangeHref(from: string, to: string, s: RangeShifts) {
  return `/shifts?view=sum&from=${from}&to=${to}&s=${s}`
}
