import { describe, expect, it } from 'vitest'

import {
  computeSourceEdgeMask,
  edgePreservingFilter,
  sampleImageToGrid,
  selectAdaptiveEdgeThresholds,
  selectAdaptiveSampleSize,
} from '@/core/adaptiveSampling'

function image(
  width: number,
  height: number,
  pixel: (x: number, y: number) => readonly [number, number, number, number],
) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      data.set(pixel(x, y), offset)
    }
  }
  return new ImageData(data, width, height)
}

describe('sampleImageToGrid', () => {
  it('adapts sample density to the number of source pixels per bead', () => {
    expect(selectAdaptiveSampleSize(2048, 2048, 75, 65)).toBe(7)
    expect(selectAdaptiveSampleSize(1200, 1200, 200, 200)).toBe(5)
    expect(selectAdaptiveSampleSize(1200, 1200, 40, 40, 'illustration')).toBe(
      11,
    )
  })

  it('selects deterministic edge thresholds from source contrast', () => {
    const thresholds = selectAdaptiveEdgeThresholds(
      new Uint8Array([0, 12, 40, 64, 90, 120, 160, 220]),
    )

    expect(thresholds.low).toBeLessThan(thresholds.high)
    expect(thresholds.high).toBeGreaterThanOrEqual(72)
  })

  it('does not bleed hidden transparent RGB into opaque artwork', () => {
    const source = image(3, 1, (x) =>
      x === 0 ? [255, 0, 0, 0] : [255, 255, 255, 255],
    )
    const filtered = edgePreservingFilter(source, 38)

    expect([...filtered.data.slice(4, 8)]).toEqual([255, 255, 255, 255])
    expect([...filtered.data.slice(0, 4)]).toEqual([255, 0, 0, 0])
  })

  it('keeps flat source colors stable', () => {
    const source = image(21, 21, () => [42, 128, 220, 255])
    const sampled = sampleImageToGrid(
      source,
      3,
      3,
      computeSourceEdgeMask(source),
    )

    expect([...sampled.imageData.data.slice(0, 4)]).toEqual([42, 128, 220, 255])
    expect([...sampled.edgeMask]).toEqual(new Array(9).fill(0))
    expect(sampled.cellFeatures[0]?.candidates[0]).toMatchObject({
      red: 42,
      green: 128,
      blue: 220,
      weight: 1,
    })
  })

  it('skips V3 feature allocation for legacy-compatible sampling', () => {
    const source = image(21, 21, () => [42, 128, 220, 255])
    const sampled = sampleImageToGrid(
      source,
      3,
      3,
      computeSourceEdgeMask(source),
      { collectCellFeatures: false },
    )

    expect(sampled.cellFeatures).toEqual([])
  })

  it('preserves a thin high-contrast detail crossing the cell center', () => {
    const source = image(21, 21, (x) =>
      x >= 9 && x <= 11 ? [12, 12, 12, 255] : [245, 245, 245, 255],
    )
    const sampled = sampleImageToGrid(
      source,
      1,
      1,
      computeSourceEdgeMask(source),
    )

    expect(sampled.imageData.data[0]).toBeLessThan(40)
    expect(sampled.edgeMask[0]).toBeGreaterThan(50)
  })

  it('protects an off-center dark stroke in illustration mode', () => {
    const source = image(33, 33, (x, y) =>
      y >= 7 && y <= 9 && x >= 3 && x <= 29
        ? [35, 32, 32, 255]
        : [246, 224, 213, 255],
    )
    const sampled = sampleImageToGrid(
      source,
      1,
      1,
      computeSourceEdgeMask(source),
      { sampleSize: 11, contentMode: 'illustration' },
    )

    expect(sampled.imageData.data[0]).toBeLessThan(90)
    expect(sampled.cellFeatures[0]?.protectedDetail).toBe(true)
    expect(sampled.cellFeatures[0]?.lineStrength).toBeGreaterThan(0.15)
  })

  it('leaves cells empty when transparent coverage is dominant', () => {
    const source = image(21, 21, (x, y) =>
      x === 10 && y === 10 ? [255, 0, 0, 255] : [0, 0, 0, 0],
    )
    const sampled = sampleImageToGrid(
      source,
      1,
      1,
      computeSourceEdgeMask(source),
    )

    expect([...sampled.imageData.data]).toEqual([0, 0, 0, 0])
  })
})
