import { describe, expect, it } from 'vitest'

import { findFloodFillIndexes } from './floodFill'

describe('findFloodFillIndexes', () => {
  it('returns only the connected region', () => {
    const cells = [1, 1, 0, 1, 0, 0, 2, 2, 0]
    expect(findFloodFillIndexes(cells, 3, 3, 0).sort()).toEqual([0, 1, 3])
  })
})
