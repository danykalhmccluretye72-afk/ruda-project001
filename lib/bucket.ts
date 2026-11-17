export type BucketMode = 'weight' | 'volume'

export type LoaderBucket = {
  bucketMode: BucketMode
  bucketWeightT: number
  bucketVolumeM3: number | null
}

/**
 * Вес ковша для конкретного штабеля.
 * weight — фиксированный вес ковша погрузчика.
 * volume — объём ковша × насыпной вес штабеля; null, если у штабеля не задан насыпной вес.
 */
export function bucketWeightFor(loader: LoaderBucket, bulkDensity: number | null | undefined): number | null {
  if (loader.bucketMode !== 'volume') return loader.bucketWeightT > 0 ? loader.bucketWeightT : null
  if (!loader.bucketVolumeM3 || !bulkDensity || bulkDensity <= 0) return null
  return Math.round(loader.bucketVolumeM3 * bulkDensity * 1000) / 1000
}

export function describeLoaderBucket(loader: LoaderBucket, format: (n: number) => string): string {
  return loader.bucketMode === 'volume'
    ? `ковш ${format(loader.bucketVolumeM3 ?? 0)} м³`
    : `ковш ${format(loader.bucketWeightT)} т`
}
