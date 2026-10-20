import { deltaE2000, rgbToLab } from '@/core/color'
import type { BeadPalette, RgbColor } from '@/domain/palette/types'

export interface ReconstructionOptions {
  columns: number
  rows: number
  allowedPaletteIndexes?: number[]
  blankLightness?: number
  confidenceGap?: number
  maximumDistance?: number
}

export interface ReconstructionResult {
  cells: number[]
  confidence: number[]
  uncertainCells: number[]
  averageDeltaE: number
  maximumDeltaE: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function median(values: number[]) {
  if (values.length === 0) return 255
  values.sort((first, second) => first - second)
  return values[Math.floor(values.length / 2)] ?? 255
}

function sampleCellColor(
  source: ImageData,
  column: number,
  row: number,
  columns: number,
  rows: number,
): RgbColor {
  const x0 = (column * source.width) / columns
  const x1 = ((column + 1) * source.width) / columns
  const y0 = (row * source.height) / rows
  const y1 = ((row + 1) * source.height) / rows
  const width = x1 - x0
  const height = y1 - y0
  const red: number[] = []
  const green: number[] = []
  const blue: number[] = []

  const startX = Math.floor(x0 + width * 0.18)
  const endX = Math.ceil(x0 + width * 0.82)
  const startY = Math.floor(y0 + height * 0.16)
  const endY = Math.ceil(y0 + height * 0.84)

  for (let y = startY; y < endY; y += 1) {
    const relativeY = (y - y0) / height
    // Most source charts put the color code through the center. Sampling the
    // upper and lower bands avoids letting blurred glyphs dominate the color.
    if (relativeY > 0.36 && relativeY < 0.64) continue
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * source.width + x) * 4
      if ((source.data[offset + 3] ?? 0) < 32) continue
      red.push(source.data[offset] ?? 255)
      green.push(source.data[offset + 1] ?? 255)
      blue.push(source.data[offset + 2] ?? 255)
    }
  }

  return { r: median(red), g: median(green), b: median(blue) }
}

function isBlank({ r, g, b }: RgbColor, lightness: number) {
  const maximum = Math.max(r, g, b)
  const minimum = Math.min(r, g, b)
  return (r + g + b) / 3 >= lightness && maximum - minimum < 28
}

export function reconstructPattern(
  source: ImageData,
  palette: BeadPalette,
  options: ReconstructionOptions,
): ReconstructionResult {
  const columns = clamp(Math.floor(options.columns), 1, 300)
  const rows = clamp(Math.floor(options.rows), 1, 300)
  const blankLightness = clamp(options.blankLightness ?? 232, 180, 255)
  const confidenceGap = Math.max(0.1, options.confidenceGap ?? 2.2)
  const maximumDistance = Math.max(1, options.maximumDistance ?? 22)
  const allowedPaletteIndexes = [
    ...new Set(
      (options.allowedPaletteIndexes ?? []).filter(
        (index) => index >= 0 && index < palette.colors.length,
      ),
    ),
  ]
  const candidateIndexes =
    allowedPaletteIndexes.length > 0
      ? allowedPaletteIndexes
      : palette.colors.map((_, index) => index)
  const cells: number[] = []
  const confidence: number[] = []
  const uncertainCells: number[] = []
  let distanceTotal = 0
  let coloredCells = 0
  let maximumDeltaE = 0

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      const rgb = sampleCellColor(source, column, row, columns, rows)
      if (isBlank(rgb, blankLightness)) {
        cells.push(0)
        confidence.push(1)
        continue
      }

      const lab = rgbToLab(rgb)
      const ranked = candidateIndexes
        .map((paletteIndex) => ({
          paletteIndex,
          distance: deltaE2000(lab, palette.colors[paletteIndex]!.lab),
        }))
        .sort((first, second) => first.distance - second.distance)
      const nearest = ranked[0]
      if (!nearest) {
        cells.push(0)
        confidence.push(0)
        uncertainCells.push(index)
        continue
      }

      const gap =
        (ranked[1]?.distance ?? nearest.distance + 100) - nearest.distance
      const certainty = clamp(
        (gap / (confidenceGap * 3)) *
          (1 - nearest.distance / (maximumDistance * 2)),
        0,
        1,
      )
      cells.push(nearest.paletteIndex + 1)
      confidence.push(certainty)
      distanceTotal += nearest.distance
      coloredCells += 1
      maximumDeltaE = Math.max(maximumDeltaE, nearest.distance)

      if (gap < confidenceGap || nearest.distance > maximumDistance) {
        uncertainCells.push(index)
      }
    }
  }

  return {
    cells,
    confidence,
    uncertainCells,
    averageDeltaE: coloredCells === 0 ? 0 : distanceTotal / coloredCells,
    maximumDeltaE,
  }
}
