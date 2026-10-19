import { z } from 'zod'

import {
  PATTERN_DOCUMENT_VERSION,
  type PatternDocument,
} from '@/domain/pattern/types'

const patternSchema = z.object({
  version: z.literal(PATTERN_DOCUMENT_VERSION),
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  paletteId: z.string().min(1),
  width: z.number().int().min(1).max(300),
  height: z.number().int().min(1).max(300),
  cells: z.array(z.number().int().min(0)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export function parsePatternDocument(value: unknown): PatternDocument {
  const parsed = patternSchema.parse(value)
  if (parsed.cells.length !== parsed.width * parsed.height) {
    throw new Error('图纸网格尺寸与单元格数量不一致。')
  }
  return parsed
}

export function safeParsePatternDocument(value: unknown) {
  const parsed = patternSchema.safeParse(value)
  if (
    !parsed.success ||
    parsed.data.cells.length !== parsed.data.width * parsed.data.height
  ) {
    return undefined
  }
  return parsed.data
}
