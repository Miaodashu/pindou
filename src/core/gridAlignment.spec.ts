import { describe, expect, it } from 'vitest'

import { selectGridAlignment } from '@/core/gridAlignment'

describe('selectGridAlignment', () => {
  it('keeps the neutral phase when the source has no contours', () => {
    expect(selectGridAlignment(new Uint8Array(144), 12, 12, 3, 3)).toEqual({
      offsetX: 0,
      offsetY: 0,
      score: 0,
      gain: 0,
    })
  })

  it('moves a strong vertical contour closer to a bead boundary', () => {
    const edges = new Uint8Array(12 * 12)
    for (let y = 1; y < 11; y += 1) edges[y * 12 + 6] = 255

    const alignment = selectGridAlignment(edges, 12, 12, 3, 3)

    expect(alignment.offsetX).not.toBe(0)
    expect(alignment.gain).toBeGreaterThan(0)
  })
})
