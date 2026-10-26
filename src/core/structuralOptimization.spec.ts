import { describe, expect, it } from 'vitest'

import { hexToRgb, rgbToLab } from '@/core/color'
import {
  applyControlledDithering,
  optimizePatternStructure,
} from '@/core/structuralOptimization'
import type { BeadPalette } from '@/domain/palette/types'

const palette: BeadPalette = {
  id: 'structure-test',
  brand: 'Test',
  name: 'Structure',
  version: '1',
  source: 'digital-reference',
  colors: ['#FFFFFF', '#D8D8D8', '#000000'].map((hex, index) => {
    const rgb = hexToRgb(hex)
    return {
      id: `c${index}`,
      code: `T${index}`,
      name: `Color ${index}`,
      hex,
      rgb,
      lab: rgbToLab(rgb),
      symbol: String(index),
    }
  }),
}

function solidImage(hex: string, width: number, height: number) {
  const rgb = hexToRgb(hex)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    data.set([rgb.r, rgb.g, rgb.b, 255], index * 4)
  }
  return new ImageData(data, width, height)
}

describe('optimizePatternStructure', () => {
  it('removes a weak color break inside a flat region', () => {
    const candidates = Array.from({ length: 9 }, (_, index) =>
      index === 4
        ? [
            { colorIndex: 1, cost: 0 },
            { colorIndex: 0, cost: 0.2 },
          ]
        : [{ colorIndex: 0, cost: 0 }],
    )
    const result = optimizePatternStructure(
      [1, 1, 1, 1, 2, 1, 1, 1, 1],
      candidates,
      3,
      3,
      solidImage('#FFFFFF', 3, 3),
      palette,
      new Uint8Array(9),
      'balanced',
    )

    expect(result.cells).toEqual(new Array(9).fill(1))
    expect(result.changedCells).toBe(1)
  })

  it('keeps contrast that is backed by a strong source edge', () => {
    const source = new ImageData(
      new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]),
      2,
      1,
    )
    const result = optimizePatternStructure(
      [1, 3],
      [[{ colorIndex: 0, cost: 0 }], [{ colorIndex: 2, cost: 0 }]],
      2,
      1,
      source,
      palette,
      new Uint8Array([255, 255]),
      'balanced',
    )

    expect(result.cells).toEqual([1, 3])
  })

  it('never chooses a neighbor color outside the cell top candidates', () => {
    const result = optimizePatternStructure(
      [1, 3],
      [[{ colorIndex: 0, cost: 0 }], [{ colorIndex: 2, cost: 0 }]],
      2,
      1,
      solidImage('#FFFFFF', 2, 1),
      palette,
      new Uint8Array(2),
      'few-colors',
    )

    expect(result.cells).toEqual([1, 3])
  })

  it('uses only a sparse deterministic pattern for smooth gradients', () => {
    const candidates = Array.from({ length: 16 }, () => [
      { colorIndex: 0, cost: 0 },
      { colorIndex: 1, cost: 0.05 },
    ])
    const result = applyControlledDithering(
      new Array(16).fill(1),
      candidates,
      Array.from({ length: 16 }, () => ({
        coverage: 1,
        variance: 0.001,
        edgeStrength: 0,
        candidates: [],
      })),
      4,
      4,
      new Uint8Array(16),
      palette,
      'closest',
    )

    expect(result.ditheredCells).toBeGreaterThan(0)
    expect(result.ditheredCells).toBeLessThan(6)
  })

  it('does not dither a small patch or overwrite a structural choice', () => {
    const candidates = Array.from({ length: 4 }, () => [
      { colorIndex: 0, cost: 0 },
      { colorIndex: 1, cost: 0.05 },
    ])
    const features = Array.from({ length: 4 }, () => ({
      coverage: 1,
      variance: 0.001,
      edgeStrength: 0,
      candidates: [],
    }))
    expect(
      applyControlledDithering(
        new Array(4).fill(1),
        candidates,
        features,
        2,
        2,
        new Uint8Array(4),
        palette,
        'closest',
      ).ditheredCells,
    ).toBe(0)

    const structurallyChanged = new Array(16).fill(1)
    structurallyChanged[0] = 3
    expect(
      applyControlledDithering(
        structurallyChanged,
        Array.from({ length: 16 }, () => candidates[0]!),
        Array.from({ length: 16 }, () => features[0]!),
        4,
        4,
        new Uint8Array(16),
        palette,
        'closest',
      ).cells[0],
    ).toBe(3)
  })
})
