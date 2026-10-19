import { z } from 'zod'

import { hexToRgb, rgbToLab } from '@/core/color'
import type { BeadPalette } from '@/domain/palette/types'

const colorSchema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(80),
  hex: z.string().regex(/^#?[0-9a-fA-F]{6}$/, '颜色必须是 6 位 HEX 值。'),
  symbol: z.string().trim().min(1).max(4).optional(),
})

const paletteSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    brand: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    version: z.string().trim().min(1).max(40),
    source: z.enum(['official', 'measured', 'digital-reference']),
    disclaimer: z.string().trim().max(500).optional(),
    colors: z.array(colorSchema).min(1).max(512),
  })
  .superRefine((palette, context) => {
    const codes = new Set<string>()
    palette.colors.forEach((color, index) => {
      const normalized = color.code.toLocaleUpperCase()
      if (codes.has(normalized)) {
        context.addIssue({
          code: 'custom',
          message: `色号 ${color.code} 重复。`,
          path: ['colors', index, 'code'],
        })
      }
      codes.add(normalized)
    })
  })

export function parsePaletteDocument(value: unknown): BeadPalette {
  const parsed = paletteSchema.parse(value)
  return {
    ...parsed,
    colors: parsed.colors.map((color, index) => {
      const hex = `#${color.hex.replace(/^#/, '').toUpperCase()}`
      const rgb = hexToRgb(hex)
      return {
        id: color.id ?? `${parsed.id}-${color.code}`,
        code: color.code,
        name: color.name,
        hex,
        rgb,
        lab: rgbToLab(rgb),
        symbol: color.symbol ?? String(index + 1),
      }
    }),
  }
}
