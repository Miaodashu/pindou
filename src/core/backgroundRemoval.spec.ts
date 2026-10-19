import { describe, expect, it } from 'vitest'

import { removeEdgeBackground } from '@/core/backgroundRemoval'

describe('removeEdgeBackground', () => {
  it('removes an edge-connected near-solid background', () => {
    const pixels = new Uint8ClampedArray([
      250, 250, 250, 255, 248, 248, 248, 255, 250, 250, 250, 255, 249, 249, 249,
      255, 220, 20, 20, 255, 249, 249, 249, 255, 250, 250, 250, 255, 248, 248,
      248, 255, 250, 250, 250, 255,
    ])

    const result = removeEdgeBackground(pixels, 3, 3)

    expect(
      [0, 1, 2, 3, 5, 6, 7, 8].map((index) => result[index * 4 + 3]),
    ).toEqual(Array(8).fill(0))
    expect(result[4 * 4 + 3]).toBe(255)
  })

  it('preserves an enclosed area that matches the background color', () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4)
    for (let index = 0; index < 25; index += 1) {
      pixels.set([255, 255, 255, 255], index * 4)
    }
    for (const index of [6, 7, 8, 11, 13, 16, 17, 18]) {
      pixels.set([0, 0, 0, 255], index * 4)
    }

    const result = removeEdgeBackground(pixels, 5, 5)

    expect(result[0 * 4 + 3]).toBe(0)
    expect(result[12 * 4 + 3]).toBe(255)
  })
})
