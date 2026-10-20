import { describe, expect, it } from 'vitest'

import { genericDigitalPalette } from '@/domain/palette/genericPalette'
import { createPattern } from '@/domain/pattern/createPattern'

import { createReconstructionSvg } from './reconstructionSvg'

describe('createReconstructionSvg', () => {
  it('creates real vector cells, codes, coordinates, and major guides', () => {
    const pattern = createPattern(2, 1, genericDigitalPalette.id)
    pattern.cells = [1, 0]
    const svg = createReconstructionSvg(pattern, genericDigitalPalette)

    expect(svg).toContain('<svg')
    expect(svg).toContain('<rect')
    expect(svg).toContain(genericDigitalPalette.colors[0]!.code)
    expect(svg).toContain('stroke="#c84f5a"')
    expect(svg).not.toContain('<image')
  })
})
