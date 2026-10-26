import { describe, expect, it } from 'vitest'

import { downscalePattern } from '@/core/downscalePattern'

describe('downscalePattern', () => {
  it('reduces a large edited pattern by overlap area', () => {
    const cells = [1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 4, 4, 3, 3, 4, 4]

    expect(downscalePattern(cells, 4, 4, 2, 2)).toEqual([1, 2, 3, 4])
  })

  it('keeps a boundary detail when reducing a refined large pattern', () => {
    const cells = [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2]

    expect(downscalePattern(cells, 4, 4, 2, 2)).toEqual([1, 2, 1, 2])
  })

  it('rejects a target larger than the refined source pattern', () => {
    expect(() => downscalePattern([1, 1, 1, 1], 2, 2, 3, 2)).toThrow(
      '不能超过当前图纸',
    )
  })
})
