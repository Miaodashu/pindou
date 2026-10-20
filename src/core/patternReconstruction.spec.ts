import { describe, expect, it } from 'vitest'

import { rgbToLab } from '@/core/color'
import type { BeadPalette, RgbColor } from '@/domain/palette/types'

import { reconstructPattern } from './patternReconstruction'

const colors: Array<{ code: string; rgb: RgbColor }> = [
  { code: 'R1', rgb: { r: 210, g: 44, b: 55 } },
  { code: 'B1', rgb: { r: 35, g: 92, b: 175 } },
]

const palette: BeadPalette = {
  id: 'reconstruction-test',
  brand: 'Test',
  name: 'Test',
  version: '1',
  source: 'measured',
  colors: colors.map(({ code, rgb }) => ({
    id: code,
    code,
    name: code,
    hex: code === 'R1' ? '#d22c37' : '#235caf',
    rgb,
    lab: rgbToLab(rgb),
    symbol: code,
  })),
}

function chartImage() {
  const width = 40
  const height = 40
  const data = new Uint8ClampedArray(width * height * 4)
  const fills = [
    colors[0]!.rgb,
    { r: 250, g: 250, b: 250 },
    colors[1]!.rgb,
    colors[0]!.rgb,
  ]

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = Math.floor(y / 20) * 2 + Math.floor(x / 20)
      const fill = fills[cell]!
      const isGlyph = x % 20 >= 8 && x % 20 <= 12 && y % 20 >= 8 && y % 20 <= 12
      const offset = (y * width + x) * 4
      data[offset] = isGlyph ? 0 : fill.r
      data[offset + 1] = isGlyph ? 0 : fill.g
      data[offset + 2] = isGlyph ? 0 : fill.b
      data[offset + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

describe('reconstructPattern', () => {
  it('rebuilds grid colors while ignoring centered blurry labels', () => {
    const result = reconstructPattern(chartImage(), palette, {
      columns: 2,
      rows: 2,
    })

    expect(result.cells).toEqual([1, 0, 2, 1])
    expect(result.uncertainCells).toEqual([])
    expect(result.averageDeltaE).toBeLessThan(0.1)
  })

  it('restricts matching to color codes confirmed by the source legend', () => {
    const result = reconstructPattern(chartImage(), palette, {
      columns: 2,
      rows: 2,
      allowedPaletteIndexes: [1],
    })

    expect(result.cells).toEqual([2, 0, 2, 2])
  })
})
