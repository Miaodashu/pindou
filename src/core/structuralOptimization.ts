import { deltaE2000, rgbToLab } from '@/core/color'
import type { SampledCellFeature } from '@/core/adaptiveSampling'
import {
  conversionStrategyPresets,
  type ConversionStrategy,
} from '@/core/conversionStrategy'
import type { PaletteCandidate } from '@/core/quantize'
import type { BeadPalette, LabColor } from '@/domain/palette/types'

export interface StructuralOptimizationResult {
  cells: number[]
  changedCells: number
}

export interface ControlledDitheringResult {
  cells: number[]
  ditheredCells: number
}

const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

function neighbors(index: number, width: number, height: number) {
  const x = index % width
  const y = Math.floor(index / width)
  return [
    x > 0 ? index - 1 : -1,
    x < width - 1 ? index + 1 : -1,
    y > 0 ? index - width : -1,
    y < height - 1 ? index + width : -1,
  ]
}

function sourceLabs(imageData: ImageData) {
  return Array.from(
    { length: imageData.width * imageData.height },
    (_, index) => {
      const offset = index * 4
      return rgbToLab({
        r: imageData.data[offset] ?? 0,
        g: imageData.data[offset + 1] ?? 0,
        b: imageData.data[offset + 2] ?? 0,
      })
    },
  )
}

function findCandidateCost(
  candidates: readonly PaletteCandidate[],
  colorIndex: number,
  source: LabColor,
  palette: BeadPalette,
) {
  const direct = candidates.find(
    (candidate) => candidate.colorIndex === colorIndex,
  )
  if (direct) return direct.cost
  const color = palette.colors[colorIndex]
  return color ? deltaE2000(source, color.lab) + 1.5 : Number.POSITIVE_INFINITY
}

/**
 * Runs a bounded deterministic ICM pass over palette candidates. Flat regions
 * are encouraged to stay compact while strong source boundaries are rewarded
 * for preserving contrast. Transparent cells never participate.
 */
export function optimizePatternStructure(
  inputCells: readonly number[],
  candidateAssignments: readonly (readonly PaletteCandidate[])[],
  width: number,
  height: number,
  source: ImageData,
  palette: BeadPalette,
  edgeMask: Uint8Array,
  strategy: ConversionStrategy,
  protectedDetails?: Uint8Array,
): StructuralOptimizationResult {
  if (
    inputCells.length !== width * height ||
    candidateAssignments.length !== inputCells.length ||
    edgeMask.length !== inputCells.length ||
    source.width !== width ||
    source.height !== height
  ) {
    throw new Error('结构优化数据尺寸不匹配。')
  }

  const preset = conversionStrategyPresets[strategy]
  const labs = sourceLabs(source)
  const cells = [...inputCells]
  const changedIndexes = new Set<number>()

  for (
    let iteration = 0;
    iteration < preset.structuralIterations;
    iteration += 1
  ) {
    let passChanges = 0
    const reverse = iteration % 2 === 1
    for (let step = 0; step < cells.length; step += 1) {
      const index = reverse ? cells.length - 1 - step : step
      if ((cells[index] ?? 0) <= 0) continue
      if (protectedDetails?.[index]) continue
      const assignments = candidateAssignments[index] ?? []
      if (assignments.length === 0) continue
      const possible = new Set(
        assignments.map((candidate) => candidate.colorIndex),
      )

      let bestColor = (cells[index] ?? 1) - 1
      let bestEnergy = Number.POSITIVE_INFINITY
      for (const colorIndex of possible) {
        const color = palette.colors[colorIndex]
        if (!color) continue
        let energy = findCandidateCost(
          assignments,
          colorIndex,
          labs[index]!,
          palette,
        )
        for (const neighbor of neighbors(index, width, height)) {
          const neighborCell = cells[neighbor] ?? 0
          if (neighbor < 0 || neighborCell <= 0) continue
          const neighborColor = palette.colors[neighborCell - 1]
          if (!neighborColor) continue
          const boundaryStrength =
            Math.max(edgeMask[index] ?? 0, edgeMask[neighbor] ?? 0) / 255
          const sourceContrast = deltaE2000(labs[index]!, labs[neighbor]!)
          const outputContrast = deltaE2000(color.lab, neighborColor.lab)

          if (sourceContrast < 6 || boundaryStrength < 0.22) {
            if (colorIndex !== neighborCell - 1) {
              energy +=
                preset.smoothnessWeight * Math.pow(1 - boundaryStrength, 2)
            }
          } else if (colorIndex === neighborCell - 1) {
            energy +=
              preset.edgeContrastWeight * Math.min(3, sourceContrast / 8)
          } else {
            energy +=
              Math.abs(outputContrast - sourceContrast) *
              preset.edgeContrastWeight *
              0.035
          }
        }

        if (energy < bestEnergy - 0.001) {
          bestEnergy = energy
          bestColor = colorIndex
        }
      }

      const next = bestColor + 1
      if (next !== cells[index]) {
        cells[index] = next
        passChanges += 1
        changedIndexes.add(index)
      }
    }
    if (passChanges === 0) break
  }

  return { cells, changedCells: changedIndexes.size }
}

export function applyControlledDithering(
  inputCells: readonly number[],
  candidateAssignments: readonly (readonly PaletteCandidate[])[],
  cellFeatures: readonly SampledCellFeature[],
  width: number,
  height: number,
  edgeMask: Uint8Array,
  palette: BeadPalette,
  strategy: ConversionStrategy,
): ControlledDitheringResult {
  const strength = conversionStrategyPresets[strategy].ditheringStrength
  const cells = [...inputCells]
  if (strength <= 0) return { cells, ditheredCells: 0 }
  if (
    candidateAssignments.length !== cells.length ||
    cellFeatures.length !== cells.length
  ) {
    throw new Error('受控抖色数据尺寸不匹配。')
  }
  const regionKeys = new Array<string>(cells.length).fill('')
  const regionSizes = new Uint32Array(cells.length)

  for (let index = 0; index < cells.length; index += 1) {
    const ranked = candidateAssignments[index] ?? []
    const first = ranked[0]
    const second = ranked[1]
    const feature = cellFeatures[index]
    if (
      !first ||
      !second ||
      !feature ||
      cells[index] !== first.colorIndex + 1 ||
      feature.variance > 0.008 ||
      (edgeMask[index] ?? 0) >= 26
    ) {
      continue
    }
    const gap = second.cost - first.cost
    const firstColor = palette.colors[first.colorIndex]
    const secondColor = palette.colors[second.colorIndex]
    if (!firstColor || !secondColor || gap < 0 || gap > 1.25) continue
    const paletteContrast = deltaE2000(firstColor.lab, secondColor.lab)
    if (paletteContrast < 3 || paletteContrast > 18) continue
    regionKeys[index] = `${first.colorIndex}:${second.colorIndex}`
  }

  const visited = new Uint8Array(cells.length)
  for (let start = 0; start < cells.length; start += 1) {
    const key = regionKeys[start]
    if (!key || visited[start]) continue
    const region: number[] = []
    const queue = [start]
    visited[start] = 1
    while (queue.length > 0) {
      const index = queue.pop()
      if (index === undefined) break
      region.push(index)
      for (const neighbor of neighbors(index, width, height)) {
        if (
          neighbor >= 0 &&
          !visited[neighbor] &&
          regionKeys[neighbor] === key
        ) {
          visited[neighbor] = 1
          queue.push(neighbor)
        }
      }
    }
    region.forEach((index) => {
      regionSizes[index] = region.length
    })
  }

  let ditheredCells = 0

  for (let index = 0; index < cells.length; index += 1) {
    if (regionSizes[index] < 8) continue
    const ranked = candidateAssignments[index] ?? []
    const first = ranked[0]
    const second = ranked[1]
    if (!first || !second) continue
    const gap = second.cost - first.cost

    const x = index % width
    const y = Math.floor(index / width)
    const threshold = ((BAYER_4[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16
    const mix = strength * (1 - gap / 1.25)
    if (threshold >= mix) continue
    cells[index] = second.colorIndex + 1
    ditheredCells += 1
  }

  return { cells, ditheredCells }
}

export function measurePatternError(
  cells: readonly number[],
  source: ImageData,
  palette: BeadPalette,
) {
  let total = 0
  let count = 0
  let maximumDeltaE = 0
  const labs = sourceLabs(source)
  cells.forEach((cell, index) => {
    if (cell <= 0) return
    const color = palette.colors[cell - 1]
    if (!color) return
    const distance = deltaE2000(labs[index]!, color.lab)
    total += distance
    count += 1
    maximumDeltaE = Math.max(maximumDeltaE, distance)
  })
  return {
    averageDeltaE: count === 0 ? 0 : total / count,
    maximumDeltaE,
  }
}
