import { describe, expect, it } from 'vitest'

import {
  calculateCanvasBackingStore,
  calculateCanvasExportCellSize,
} from '@/core/canvasBackingStore'

describe('calculateCanvasBackingStore', () => {
  it('preserves the requested pixel ratio for ordinary canvases', () => {
    expect(calculateCanvasBackingStore(725, 725, 2)).toEqual({
      width: 1450,
      height: 1450,
      pixelRatio: 2,
    })
  })

  it('caps large high-DPI canvases to a safe pixel budget', () => {
    const result = calculateCanvasBackingStore(7500, 7500, 3)

    expect(result.width * result.height).toBeLessThanOrEqual(16_777_216)
    expect(result.width).toBeLessThanOrEqual(8192)
    expect(result.height).toBeLessThanOrEqual(8192)
    expect(result.pixelRatio).toBeLessThan(1)
  })

  it('keeps the backing-store aspect ratio when it applies a cap', () => {
    const result = calculateCanvasBackingStore(12_000, 3_000, 2)

    expect(result.width / result.height).toBeCloseTo(4, 2)
  })

  it('chooses an explicit safe export density for a 300-square grid', () => {
    expect(calculateCanvasExportCellSize(300, 300, 36)).toBe(13)
    expect(calculateCanvasExportCellSize(29, 29, 36)).toBe(36)
  })
})
