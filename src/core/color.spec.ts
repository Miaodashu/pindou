import { describe, expect, it } from 'vitest'

import { deltaE2000, hexToRgb, rgbToLab } from './color'

describe('color utilities', () => {
  it('parses hex colors and converts white to Lab', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(rgbToLab({ r: 255, g: 255, b: 255 }).l).toBeCloseTo(100, 3)
  })

  it('matches the published CIEDE2000 reference pair', () => {
    expect(
      deltaE2000(
        { l: 50, a: 2.6772, b: -79.7751 },
        { l: 50, a: 0, b: -82.7485 },
      ),
    ).toBeCloseTo(2.0425, 4)
  })
})
