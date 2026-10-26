import { deltaE2000, rgbToLab } from '@/core/color'
import {
  conversionStrategyPresets,
  type ConversionStrategy,
} from '@/core/conversionStrategy'
import type { SampledCellFeature } from '@/core/adaptiveSampling'
import type { ImageContentMode } from '@/core/imageContentMode'
import type { BeadPalette, LabColor } from '@/domain/palette/types'

export interface QuantizeOptions {
  maxColors: number
  strategy?: QuantizeStrategy
  alphaThreshold?: number
  edgeMask?: Uint8Array
  edgeWeight?: number
  refinePalette?: boolean
  cellFeatures?: readonly SampledCellFeature[]
  contentMode?: ImageContentMode
}

export type QuantizeStrategy = ConversionStrategy

export interface QuantizeResult {
  cells: number[]
  selectedColorIndexes: number[]
  averageDeltaE: number
  maximumDeltaE: number
  lowConfidenceCells: number
  candidateAssignments: PaletteCandidate[][]
}

export interface PaletteCandidate {
  colorIndex: number
  cost: number
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

function insertTopCandidate(
  ranked: PaletteCandidate[],
  candidate: PaletteCandidate,
  limit: number,
) {
  let position = 0
  while (
    position < ranked.length &&
    ((ranked[position]?.cost ?? Number.POSITIVE_INFINITY) < candidate.cost ||
      ((ranked[position]?.cost ?? Number.POSITIVE_INFINITY) ===
        candidate.cost &&
        (ranked[position]?.colorIndex ?? Number.POSITIVE_INFINITY) <
          candidate.colorIndex))
  ) {
    position += 1
  }
  ranked.splice(position, 0, candidate)
  if (ranked.length > limit) ranked.pop()
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

  const addSample = (
    red: number,
    green: number,
    blue: number,
    weight: number,
  ) => {
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4)
    const existing = samplesByColor.get(key)
    if (existing) {
      existing.weight += weight
      existing.redTotal += red * weight
      existing.greenTotal += green * weight
      existing.blueTotal += blue * weight
    } else {
      samplesByColor.set(key, {
        key,
        redTotal: red * weight,
        greenTotal: green * weight,
        blueTotal: blue * weight,
        weight,
      })
    }
    return key
  }

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
    const feature = options.cellFeatures?.[pixel]
    const detailBoost =
      options.contentMode === 'illustration' && feature?.protectedDetail
        ? 2.4
        : 1
    const importance =
      (1 + ((options.edgeMask?.[pixel] ?? 0) / 255) * edgeWeight) * detailBoost
    const featureCandidates = options.cellFeatures?.[pixel]?.candidates ?? []
    if (featureCandidates.length > 0) {
      featureCandidates.forEach((candidate) => {
        addSample(
          candidate.red,
          candidate.green,
          candidate.blue,
          importance * candidate.weight,
        )
      })
    } else {
      addSample(r, g, b, importance)
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
      candidateAssignments: Array.from(pixelKeys, () => []),
    }
  }

  const distances = samples.map((sample) =>
    palette.colors.map((color) => deltaE2000(sample.lab, color.lab)),
  )
  const sampleIndexByKey = new Map(
    samples.map((sample, index) => [sample.key, index]),
  )
  const selected: number[] = []
  const strategyPreset =
    conversionStrategyPresets[options.strategy ?? 'balanced']
  if (strategyPreset.usesFullPalette) {
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

    // Greedy facility selection is fast but can lock an early, merely local
    // choice into the final palette. Two deterministic swap-refinement rounds
    // recover most of that loss without making the worker unbounded.
    const refinementRounds = options.refinePalette === false ? 0 : 2
    for (let refinement = 0; refinement < refinementRounds; refinement += 1) {
      const bestPaletteIndex = new Int32Array(samples.length).fill(-1)
      const bestDistance = new Float64Array(samples.length).fill(
        Number.POSITIVE_INFINITY,
      )
      const secondDistance = new Float64Array(samples.length).fill(
        Number.POSITIVE_INFINITY,
      )
      let currentTotal = 0

      for (
        let sampleIndex = 0;
        sampleIndex < samples.length;
        sampleIndex += 1
      ) {
        for (const paletteIndex of selected) {
          const distance =
            distances[sampleIndex]?.[paletteIndex] ?? Number.POSITIVE_INFINITY
          if (distance < bestDistance[sampleIndex]!) {
            secondDistance[sampleIndex] = bestDistance[sampleIndex]!
            bestDistance[sampleIndex] = distance
            bestPaletteIndex[sampleIndex] = paletteIndex
          } else if (distance < secondDistance[sampleIndex]!) {
            secondDistance[sampleIndex] = distance
          }
        }
        currentTotal +=
          bestDistance[sampleIndex]! * (samples[sampleIndex]?.weight ?? 1)
      }

      let bestSwapPosition = -1
      let bestSwapCandidate = -1
      let bestSwapTotal = currentTotal
      for (let position = 0; position < selected.length; position += 1) {
        const removed = selected[position]
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
            const withoutRemoved =
              bestPaletteIndex[sampleIndex] === removed
                ? secondDistance[sampleIndex]!
                : bestDistance[sampleIndex]!
            total +=
              Math.min(
                withoutRemoved,
                distances[sampleIndex]?.[candidate] ?? Number.POSITIVE_INFINITY,
              ) * (samples[sampleIndex]?.weight ?? 1)
          }
          if (total < bestSwapTotal - 0.001) {
            bestSwapTotal = total
            bestSwapPosition = position
            bestSwapCandidate = candidate
          }
        }
      }

      if (bestSwapPosition < 0 || bestSwapCandidate < 0) break
      selected[bestSwapPosition] = bestSwapCandidate
    }
  }

  let distanceTotal = 0
  let measuredCells = 0
  let maximumDeltaE = 0
  let lowConfidenceCells = 0
  const candidateAssignments: PaletteCandidate[][] = []
  const cells = Array.from(pixelKeys, (key, pixel) => {
    if (key < 0) {
      candidateAssignments[pixel] = []
      return 0
    }
    const featureCandidates = options.cellFeatures?.[pixel]?.candidates ?? []
    const ranked: PaletteCandidate[] = []
    const fallbackSampleIndex = sampleIndexByKey.get(key)
    const featureSampleIndexes = featureCandidates.map((candidate) => ({
      candidate,
      sampleIndex: sampleIndexByKey.get(
        ((candidate.red >> 4) << 8) |
          ((candidate.green >> 4) << 4) |
          (candidate.blue >> 4),
      ),
      lab: rgbToLab({
        r: candidate.red,
        g: candidate.green,
        b: candidate.blue,
      }),
    }))
    for (const colorIndex of selected) {
      let cost =
        featureCandidates.length === 0
          ? fallbackSampleIndex === undefined
            ? Number.POSITIVE_INFINITY
            : (distances[fallbackSampleIndex]?.[colorIndex] ??
              Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY
      if (featureCandidates.length > 0) {
        cost = Number.POSITIVE_INFINITY
        for (const reference of featureSampleIndexes) {
          const distance =
            reference.sampleIndex === undefined
              ? deltaE2000(reference.lab, palette.colors[colorIndex]!.lab)
              : (distances[reference.sampleIndex]?.[colorIndex] ??
                Number.POSITIVE_INFINITY)
          const candidatePenalty =
            options.contentMode === 'illustration' &&
            options.cellFeatures?.[pixel]?.protectedDetail
              ? 8
              : 3
          cost = Math.min(
            cost,
            distance + (1 - reference.candidate.weight) * candidatePenalty,
          )
        }
      }
      const worst = ranked[ranked.length - 1]
      if (
        ranked.length < 5 ||
        cost < (worst?.cost ?? Number.POSITIVE_INFINITY) ||
        (cost === worst?.cost && colorIndex < worst.colorIndex)
      ) {
        insertTopCandidate(ranked, { colorIndex, cost }, 5)
      }
    }
    candidateAssignments[pixel] = ranked
    const nearest = ranked[0]
    if (!nearest) return 0
    const gap = (ranked[1]?.cost ?? nearest.cost + 100) - nearest.cost
    if (gap < 2) lowConfidenceCells += 1

    const offset = pixel * 4
    const measuredDistance = deltaE2000(
      rgbToLab({
        r: imageData.data[offset] ?? 0,
        g: imageData.data[offset + 1] ?? 0,
        b: imageData.data[offset + 2] ?? 0,
      }),
      palette.colors[nearest.colorIndex]!.lab,
    )
    distanceTotal += measuredDistance
    measuredCells += 1
    maximumDeltaE = Math.max(maximumDeltaE, measuredDistance)
    return nearest.colorIndex + 1
  })

  const usedColorIndexes = [
    ...new Set(cells.filter((cell) => cell > 0).map((cell) => cell - 1)),
  ].sort((first, second) => first - second)

  return {
    cells,
    selectedColorIndexes: usedColorIndexes,
    averageDeltaE: measuredCells === 0 ? 0 : distanceTotal / measuredCells,
    maximumDeltaE,
    lowConfidenceCells,
    candidateAssignments,
  }
}
