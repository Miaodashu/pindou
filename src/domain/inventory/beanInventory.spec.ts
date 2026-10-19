import { describe, expect, it } from 'vitest'

import { mard221Palette } from '@/domain/palette/mardPalette'
import { calculateInventory, normalizeStock } from './beanInventory'

describe('bean inventory', () => {
  it('separates usable remaining stock from shortages', () => {
    const first = mard221Palette.colors[0]!
    const second = mard221Palette.colors[1]!
    const result = calculateInventory(
      mard221Palette,
      { [first.id]: 10, [second.id]: 2 },
      [
        { colorIndex: 1, count: 4 },
        { colorIndex: 2, count: 5 },
      ],
    )

    expect(result.totalStock).toBe(12)
    expect(result.totalUsed).toBe(9)
    expect(result.totalRemaining).toBe(6)
    expect(result.totalShortage).toBe(3)
  })

  it('normalizes invalid and fractional stock values', () => {
    expect(normalizeStock(-3)).toBe(0)
    expect(normalizeStock('12.8')).toBe(12)
    expect(normalizeStock('not-a-number')).toBe(0)
  })
})
