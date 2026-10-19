import { describe, expect, it } from 'vitest'

import { parsePaletteDocument } from '@/domain/palette/parsePalette'
import { createPattern } from '@/domain/pattern/createPattern'
import {
  createProjectFile,
  parseProjectFile,
} from '@/domain/project/projectFile'

const rawPalette = {
  id: 'measured-test-v1',
  brand: '测试品牌',
  name: '实测色卡',
  version: '1.0.0',
  source: 'measured' as const,
  colors: [
    { code: 'A01', name: '红', hex: '#FF0000' },
    { code: 'A02', name: '白', hex: 'FFFFFF', symbol: 'W' },
  ],
}

describe('palette and project files', () => {
  it('normalizes imported palette colors and computes matching metadata', () => {
    const palette = parsePaletteDocument(rawPalette)

    expect(palette.colors[1]).toMatchObject({
      code: 'A02',
      hex: '#FFFFFF',
      symbol: 'W',
      rgb: { r: 255, g: 255, b: 255 },
    })
    expect(palette.colors[0]?.lab).toBeDefined()
  })

  it('round-trips a self-contained project with its palette snapshot', () => {
    const palette = parsePaletteDocument(rawPalette)
    const pattern = createPattern(2, 1, palette.id)
    pattern.cells = [1, 2]

    const file = createProjectFile(pattern, palette)
    const restored = parseProjectFile(JSON.parse(JSON.stringify(file)))

    expect(restored.pattern.cells).toEqual([1, 2])
    expect(restored.palette.colors.map((color) => color.code)).toEqual([
      'A01',
      'A02',
    ])
  })

  it('rejects duplicate color codes', () => {
    expect(() =>
      parsePaletteDocument({
        ...rawPalette,
        colors: [
          rawPalette.colors[0],
          { code: 'a01', name: '重复', hex: '#000000' },
        ],
      }),
    ).toThrow()
  })

  it('rejects cells that point outside the embedded palette', () => {
    const palette = parsePaletteDocument(rawPalette)
    const pattern = createPattern(1, 1, palette.id)
    pattern.cells = [3]

    expect(() => createProjectFile(pattern, palette)).toThrow(
      '图纸包含当前色卡中不存在的色号。',
    )
  })
})
