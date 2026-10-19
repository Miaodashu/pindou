import { PATTERN_DOCUMENT_VERSION, type PatternDocument } from './types'

export function createPattern(
  width = 29,
  height = 29,
  paletteId = 'mard-221-reference-v1',
): PatternDocument {
  const now = new Date().toISOString()

  return {
    version: PATTERN_DOCUMENT_VERSION,
    id: crypto.randomUUID(),
    title: '未命名图纸',
    paletteId,
    width,
    height,
    cells: Array.from({ length: width * height }, () => 0),
    createdAt: now,
    updatedAt: now,
  }
}
