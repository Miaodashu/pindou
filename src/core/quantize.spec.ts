import { describe, expect, it } from 'vitest'

import { hexToRgb, rgbToLab } from '@/core/color'
import { quantizeToPalette } from '@/core/quantize'
import type { BeadPalette } from '@/domain/palette/types'

const palette: BeadPalette = {
  id: 'test',
  brand: 'Test',
  name: 'Test palette',
  version: '1',
  source: 'digital-reference',
  colors: ['#000000', '#FFFFFF', '#FF0000'].map((hex, index) => {
    const rgb = hexToRgb(hex)
    return {
      id: `color-${index}`,
      code: `T${index + 1}`,
      name: `Color ${index + 1}`,
      hex,
      rgb,
      lab: rgbToLab(rgb),
      symbol: String(index + 1),
    }
  }),
}

function makeImageData(
  data: number[],
  width: number,
  height: number,
): ImageData {
  return { data: new Uint8ClampedArray(data), width, height } as ImageData
}

describe('quantizeToPalette', () => {
  it('maps opaque pixels to palette indexes and keeps transparent cells empty', () => {
    const image = makeImageData(
      [255, 8, 8, 255, 250, 250, 250, 255, 0, 0, 0, 0],
      3,
      1,
    )

    const result = quantizeToPalette(image, palette, { maxColors: 3 })

    expect(result.cells).toEqual([3, 2, 0])
    expect(result.selectedColorIndexes).toHaveLength(2)
    expect(result.averageDeltaE).toBeGreaterThanOrEqual(0)
  })

  it('enforces the selected color limit across the whole image', () => {
    const image = makeImageData(
      [0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255],
      3,
      1,
    )

    const result = quantizeToPalette(image, palette, { maxColors: 1 })

    expect(result.selectedColorIndexes).toHaveLength(1)
    expect(new Set(result.cells.filter(Boolean))).toHaveLength(1)
  })

  it('returns an empty pattern for a fully transparent image', () => {
    const image = makeImageData([1, 2, 3, 0], 1, 1)

    expect(quantizeToPalette(image, palette, { maxColors: 2 })).toEqual({
      cells: [0],
      selectedColorIndexes: [],
      averageDeltaE: 0,
      maximumDeltaE: 0,
      lowConfidenceCells: 0,
    })
  })

  it('uses the full palette for closest-color matching', () => {
    const image = makeImageData(
      [0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255],
      3,
      1,
    )

    const result = quantizeToPalette(image, palette, {
      maxColors: 1,
      strategy: 'closest',
    })

    expect(result.cells).toEqual([1, 2, 3])
    expect(result.selectedColorIndexes).toHaveLength(3)
  })
})
