import { describe, expect, it } from 'vitest'

import { calculateImagePlacement } from './rasterizeImage'

describe('calculateImagePlacement', () => {
  it('centers an image when containing it', () => {
    expect(calculateImagePlacement(200, 100, 100, 100, 'contain')).toEqual({
      drawWidth: 100,
      drawHeight: 50,
      drawX: 0,
      drawY: 25,
    })
  })

  it('moves a cropped image across the available overflow', () => {
    expect(
      calculateImagePlacement(200, 100, 100, 100, 'crop', {
        zoom: 1,
        offsetX: 1,
        offsetY: 0,
      }),
    ).toEqual({
      drawWidth: 200,
      drawHeight: 100,
      drawX: 0,
      drawY: 0,
    })
  })

  it('applies crop zoom and both normalized offsets', () => {
    expect(
      calculateImagePlacement(200, 100, 100, 100, 'crop', {
        zoom: 2,
        offsetX: 0.5,
        offsetY: -0.5,
      }),
    ).toEqual({
      drawWidth: 400,
      drawHeight: 200,
      drawX: -75,
      drawY: -75,
    })
  })
})
