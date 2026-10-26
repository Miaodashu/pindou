import { describe, expect, it } from 'vitest'

import { hexToRgb, rgbToLab } from '@/core/color'
import { cleanupSpatialRegions } from '@/core/spatialCleanup'
import type { BeadPalette } from '@/domain/palette/types'

const palette: BeadPalette = {
  id: 'cleanup-test',
  brand: 'Test',
  name: 'Cleanup palette',
  version: '1',
  source: 'digital-reference',
  colors: ['#FFFFFF', '#F00000', '#000000'].map((hex, index) => {
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

function solidSource(hex: string, width: number, height: number) {
  const rgb = hexToRgb(hex)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    data.set([rgb.r, rgb.g, rgb.b, 255], index * 4)
  }
  return new ImageData(data, width, height)
}

describe('cleanupSpatialRegions', () => {
  it('replaces a tiny low-error island with its surrounding color', () => {
    const result = cleanupSpatialRegions(
      [1, 1, 1, 1, 2, 1, 1, 1, 1],
      3,
      3,
      solidSource('#FFF8F8', 3, 3),
      palette,
      new Uint8Array(9),
      'balanced',
    )

    expect(result.cells).toEqual(new Array(9).fill(1))
    expect(result.replacedCellCount).toBe(1)
  })

  it('protects a one-cell detail backed by a strong source edge', () => {
    const edges = new Uint8Array(9)
    edges[4] = 255
    const result = cleanupSpatialRegions(
      [1, 1, 1, 1, 2, 1, 1, 1, 1],
      3,
      3,
      solidSource('#FFF8F8', 3, 3),
      palette,
      edges,
      'few-colors',
    )

    expect(result.cells[4]).toBe(2)
    expect(result.replacedCellCount).toBe(0)
  })

  it('keeps a mode-protected line detail even when its reduced edge is weak', () => {
    const protectedDetails = new Uint8Array(9)
    protectedDetails[4] = 1
    const result = cleanupSpatialRegions(
      [1, 1, 1, 1, 2, 1, 1, 1, 1],
      3,
      3,
      solidSource('#FFF8F8', 3, 3),
      palette,
      new Uint8Array(9),
      'balanced',
      protectedDetails,
    )

    expect(result.cells[4]).toBe(2)
    expect(result.replacedCellCount).toBe(0)
  })

  it('removes an isolated low-edge background speckle in clean photo mode', () => {
    const result = cleanupSpatialRegions(
      [1, 1, 1, 1, 2, 1, 1, 1, 1],
      3,
      3,
      solidSource('#FFF8F8', 3, 3),
      palette,
      new Uint8Array(9),
      'closest',
      undefined,
      true,
    )

    expect(result.cells).toEqual(new Array(9).fill(1))
  })

  it('does not remove a protected photo detail during speckle reduction', () => {
    const protectedDetails = new Uint8Array(9)
    protectedDetails[4] = 1
    const result = cleanupSpatialRegions(
      [1, 1, 1, 1, 2, 1, 1, 1, 1],
      3,
      3,
      solidSource('#FFF8F8', 3, 3),
      palette,
      new Uint8Array(9),
      'closest',
      protectedDetails,
      true,
    )

    expect(result.cells[4]).toBe(2)
    expect(result.replacedCellCount).toBe(0)
  })

  it('does not fill transparent cells during cleanup', () => {
    const result = cleanupSpatialRegions(
      [1, 1, 1, 1, 0, 1, 1, 1, 1],
      3,
      3,
      solidSource('#FFFFFF', 3, 3),
      palette,
      new Uint8Array(9),
      'balanced',
    )

    expect(result.cells[4]).toBe(0)
  })

  it('never cleans a fragment of a connected region larger than the preset', () => {
    const cells = [1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1]
    const result = cleanupSpatialRegions(
      cells,
      4,
      3,
      solidSource('#FFFFFF', 4, 3),
      palette,
      new Uint8Array(12),
      'balanced',
    )

    expect(result.cells).toEqual(cells)
    expect(result.replacedCellCount).toBe(0)
  })
})
