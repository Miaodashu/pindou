import { describe, expect, it } from 'vitest'

import { lassoSelection, rectangleSelection } from './selection'

describe('rectangleSelection', () => {
  it('normalizes a reverse drag into inclusive cell indexes', () => {
    expect(
      rectangleSelection(5, 4, { x: 3.8, y: 2.2 }, { x: 1.1, y: 1.4 }),
    ).toEqual([6, 7, 8, 11, 12, 13])
  })

  it('clamps a drag to the board', () => {
    expect(rectangleSelection(3, 2, { x: -4, y: -2 }, { x: 8, y: 9 })).toEqual([
      0, 1, 2, 3, 4, 5,
    ])
  })
})

describe('lassoSelection', () => {
  it('selects cells whose centers are inside the polygon', () => {
    expect(
      lassoSelection(4, 4, [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
        { x: 0, y: 2 },
      ]),
    ).toEqual([0, 1, 2, 4, 5, 6])
  })

  it('requires a closed shape with at least three points', () => {
    expect(
      lassoSelection(4, 4, [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toEqual([])
  })
})
