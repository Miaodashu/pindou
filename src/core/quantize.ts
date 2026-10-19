import { deltaE2000, rgbToLab } from '@/core/color'
import type { BeadPalette, LabColor } from '@/domain/palette/types'

export interface QuantizeOptions {
  maxColors: number
  strategy?: QuantizeStrategy
  alphaThreshold?: number
  edgeMask?: Uint8Array
  edgeWeight?: number
}

export type QuantizeStrategy = 'balanced' | 'closest' | 'few-colors'

export interface QuantizeResult {
  cells: number[]
  selectedColorIndexes: number[]
  averageDeltaE: number
  maximumDeltaE: number
  lowConfidenceCells: number
}

interface Sample {
  key: number
  lab: LabColor
  weight: number
}

interface SampleAccumulator {
  key: number
  redTotal: number
  greenTotal: number
  blueTotal: number
  weight: number
}

export function quantizeToPalette(
  imageData: ImageData,
  palette: BeadPalette,
  options: QuantizeOptions,
): QuantizeResult {
  const alphaThreshold = options.alphaThreshold ?? 16
  const edgeWeight = options.edgeWeight ?? 2.5
  const samplesByColor = new Map<number, SampleAccumulator>()
  const pixelKeys = new Int32Array(imageData.width * imageData.height).fill(-1)

  for (let pixel = 0; pixel < pixelKeys.length; pixel += 1) {
    const offset = pixel * 4
    const alpha = imageData.data[offset + 3] ?? 0
    if (alpha < alphaThreshold) continue

    const r = imageData.data[offset] ?? 0
    const g = imageData.data[offset + 1] ?? 0
    const b = imageData.data[offset + 2] ?? 0
    // Four bits per channel cap the working histogram at 4,096 colors. This
    // keeps large grids and large brand palettes bounded while preserving the
    // weighted average of the original colors inside every bucket.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    pixelKeys[pixel] = key
    const importance = 1 + ((options.edgeMask?.[pixel] ?? 0) / 255) * edgeWeight
    const existing = samplesByColor.get(key)

    if (existing) {
      existing.weight += importance
      existing.redTotal += r * importance
      existing.greenTotal += g * importance
      existing.blueTotal += b * importance
    } else {
      samplesByColor.set(key, {
        key,
        redTotal: r * importance,
        greenTotal: g * importance,
        blueTotal: b * importance,
        weight: importance,
      })
    }
  }

  const samples: Sample[] = [...samplesByColor.values()].map((sample) => ({
    key: sample.key,
    weight: sample.weight,
    lab: rgbToLab({
      r: sample.redTotal / sample.weight,
      g: sample.greenTotal / sample.weight,
      b: sample.blueTotal / sample.weight,
    }),
  }))
  const colorLimit = Math.max(
    1,
    Math.min(Math.floor(options.maxColors), palette.colors.length),
  )

  if (samples.length === 0) {
    return {
      cells: Array.from(pixelKeys, () => 0),
      selectedColorIndexes: [],
      averageDeltaE: 0,
      maximumDeltaE: 0,
      lowConfidenceCells: 0,
    }
  }

  const distances = samples.map((sample) =>
    palette.colors.map((color) => deltaE2000(sample.lab, color.lab)),
  )
  const selected: number[] = []
  if (options.strategy === 'closest') {
    selected.push(...palette.colors.map((_, index) => index))
  } else {
    const currentBest = new Float64Array(samples.length).fill(
      Number.POSITIVE_INFINITY,
    )

    while (selected.length < colorLimit) {
      let bestCandidate = -1
      let bestTotal = Number.POSITIVE_INFINITY

      for (
        let candidate = 0;
        candidate < palette.colors.length;
        candidate += 1
      ) {
        if (selected.includes(candidate)) continue
        let total = 0

        for (
          let sampleIndex = 0;
          sampleIndex < samples.length;
          sampleIndex += 1
        ) {
          const distance = distances[sampleIndex]?.[candidate] ?? 0
          const weightedDistance = Math.min(
            currentBest[sampleIndex] ?? Number.POSITIVE_INFINITY,
            distance,
          )
          total += weightedDistance * (samples[sampleIndex]?.weight ?? 1)
        }

        if (total < bestTotal) {
          bestTotal = total
          bestCandidate = candidate
        }
      }

      if (bestCandidate < 0) break
      selected.push(bestCandidate)

      for (
        let sampleIndex = 0;
        sampleIndex < samples.length;
        sampleIndex += 1
      ) {
        currentBest[sampleIndex] = Math.min(
          currentBest[sampleIndex] ?? Number.POSITIVE_INFINITY,
          distances[sampleIndex]?.[bestCandidate] ?? Number.POSITIVE_INFINITY,
        )
      }
    }
  }

  const assignments = new Map<
    number,
    { paletteIndex: number; distance: number; gap: number }
  >()
  let weightedDistanceTotal = 0
  let totalWeight = 0
  let maximumDeltaE = 0

  samples.forEach((sample, sampleIndex) => {
    const ranked = selected
      .map((paletteIndex) => ({
        paletteIndex,
        distance: distances[sampleIndex]?.[paletteIndex] ?? 0,
      }))
      .sort((first, second) => first.distance - second.distance)
    const nearest = ranked[0]
    if (!nearest) return
    const gap =
      (ranked[1]?.distance ?? nearest.distance + 100) - nearest.distance
    assignments.set(sample.key, { ...nearest, gap })
    weightedDistanceTotal += nearest.distance * sample.weight
    totalWeight += sample.weight
    maximumDeltaE = Math.max(maximumDeltaE, nearest.distance)
  })

  let lowConfidenceCells = 0
  const cells = Array.from(pixelKeys, (key) => {
    if (key < 0) return 0
    const assignment = assignments.get(key)
    if (!assignment) return 0
    if (assignment.gap < 2) lowConfidenceCells += 1
    return assignment.paletteIndex + 1
  })

  const usedColorIndexes = [
    ...new Set(cells.filter((cell) => cell > 0).map((cell) => cell - 1)),
  ].sort((first, second) => first - second)

  return {
    cells,
    selectedColorIndexes: usedColorIndexes,
    averageDeltaE: totalWeight === 0 ? 0 : weightedDistanceTotal / totalWeight,
    maximumDeltaE,
    lowConfidenceCells,
  }
}
