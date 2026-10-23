import { deltaE2000, rgbToLab } from '@/core/color'
import {
  conversionStrategyPresets,
  type ConversionStrategy,
} from '@/core/conversionStrategy'
import type { BeadPalette } from '@/domain/palette/types'

export interface SpatialCleanupResult {
  cells: number[]
  replacedCellCount: number
  averageDeltaE: number
  maximumDeltaE: number
}

function sourceLabAt(imageData: ImageData, index: number) {
  const offset = index * 4
  return rgbToLab({
    r: imageData.data[offset] ?? 0,
    g: imageData.data[offset + 1] ?? 0,
    b: imageData.data[offset + 2] ?? 0,
  })
}

function orthogonalNeighbors(index: number, width: number, height: number) {
  const x = index % width
  const y = Math.floor(index / width)
  return [
    x > 0 ? index - 1 : -1,
    x < width - 1 ? index + 1 : -1,
    y > 0 ? index - width : -1,
    y < height - 1 ? index + width : -1,
  ]
}

function measure(
  cells: readonly number[],
  imageData: ImageData,
  palette: BeadPalette,
) {
  let total = 0
  let count = 0
  let maximumDeltaE = 0
  cells.forEach((cell, index) => {
    if (cell <= 0) return
    const color = palette.colors[cell - 1]
    if (!color) return
    const distance = deltaE2000(sourceLabAt(imageData, index), color.lab)
    total += distance
    count += 1
    maximumDeltaE = Math.max(maximumDeltaE, distance)
  })
  return {
    averageDeltaE: count === 0 ? 0 : total / count,
    maximumDeltaE,
  }
}

/**
 * Removes only tiny isolated regions when a surrounding color remains a good
 * perceptual match. Strong source edges are protected, keeping eyes, line art,
 * highlights and other intentional micro-details intact.
 */
export function cleanupSpatialRegions(
  inputCells: readonly number[],
  width: number,
  height: number,
  source: ImageData,
  palette: BeadPalette,
  edgeMask: Uint8Array,
  strategy: ConversionStrategy,
): SpatialCleanupResult {
  if (
    inputCells.length !== width * height ||
    source.width !== width ||
    source.height !== height ||
    edgeMask.length !== width * height
  ) {
    throw new Error('空间清理数据尺寸不匹配。')
  }

  const preset = conversionStrategyPresets[strategy]
  const cells = [...inputCells]
  const visited = new Uint8Array(cells.length)
  let replacedCellCount = 0

  for (let start = 0; start < cells.length; start += 1) {
    if (visited[start] || (cells[start] ?? 0) === 0) continue
    const colorIndex = cells[start] ?? 0
    const region: number[] = []
    const queue = [start]
    visited[start] = 1

    while (queue.length > 0) {
      const index = queue.pop()
      if (index === undefined) break
      region.push(index)
      for (const neighbor of orthogonalNeighbors(index, width, height)) {
        if (
          neighbor >= 0 &&
          !visited[neighbor] &&
          cells[neighbor] === colorIndex
        ) {
          visited[neighbor] = 1
          queue.push(neighbor)
        }
      }
    }

    if (region.length > preset.maximumRegionSize) continue
    if (
      region.some(
        (index) => (edgeMask[index] ?? 0) >= preset.protectedEdgeStrength,
      )
    ) {
      continue
    }

    const regionSet = new Set(region)
    const candidates = new Map<number, number>()
    for (const index of region) {
      for (const neighbor of orthogonalNeighbors(index, width, height)) {
        if (neighbor < 0 || regionSet.has(neighbor)) continue
        const candidate = cells[neighbor] ?? 0
        if (candidate <= 0 || candidate === colorIndex) continue
        candidates.set(candidate, (candidates.get(candidate) ?? 0) + 1)
      }
    }

    const rankedCandidates = [...candidates.entries()].sort(
      (first, second) => second[1] - first[1] || first[0] - second[0],
    )
    let bestCandidate = 0
    let bestIncrease = Number.POSITIVE_INFINITY
    for (const [candidate, boundaryCount] of rankedCandidates) {
      if (boundaryCount < 2) continue
      const currentColor = palette.colors[colorIndex - 1]
      const candidateColor = palette.colors[candidate - 1]
      if (!currentColor || !candidateColor) continue
      let increase = 0
      for (const index of region) {
        const sourceLab = sourceLabAt(source, index)
        increase +=
          deltaE2000(sourceLab, candidateColor.lab) -
          deltaE2000(sourceLab, currentColor.lab)
      }
      const averageIncrease = increase / region.length
      if (averageIncrease < bestIncrease) {
        bestIncrease = averageIncrease
        bestCandidate = candidate
      }
    }

    if (bestCandidate > 0 && bestIncrease <= preset.maximumErrorIncrease) {
      region.forEach((index) => {
        cells[index] = bestCandidate
      })
      replacedCellCount += region.length
    }
  }

  return {
    cells,
    replacedCellCount,
    ...measure(cells, source, palette),
  }
}
