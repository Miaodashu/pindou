import { describe, expect, it } from 'vitest'

import {
  computeSourceEdgeMask,
  edgePreservingFilter,
  sampleImageToGrid,
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
