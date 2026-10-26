import { describe, expect, it } from 'vitest'

import { assessDetailCapacity } from '@/core/detailCapacity'

describe('assessDetailCapacity', () => {
  it('keeps a quiet image at the selected dimensions', () => {
    expect(assessDetailCapacity(new Uint8Array(100), 0, 10, 10)).toEqual({
      score: 100,
      recommendedWidth: 10,
      recommendedHeight: 10,
      shouldRecommendLargerGrid: false,
    })
  })

  it('recommends a larger grid when edges and uncertain matches are dense', () => {
    const result = assessDetailCapacity(
      new Uint8Array(100).fill(180),
      40,
      10,
      10,
    )

    expect(result.score).toBeLessThan(72)
    expect(result.recommendedWidth).toBeGreaterThan(10)
    expect(result.recommendedHeight).toBeGreaterThan(10)
  })
})
