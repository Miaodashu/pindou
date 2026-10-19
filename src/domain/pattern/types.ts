export const PATTERN_DOCUMENT_VERSION = 1 as const

export interface PatternDocument {
  version: typeof PATTERN_DOCUMENT_VERSION
  id: string
  title: string
  paletteId: string
  width: number
  height: number
  /** 0 means empty; positive values are one-based palette color indexes. */
  cells: number[]
  createdAt: string
  updatedAt: string
}

export interface CellEdit {
  index: number
  before: number
  after: number
}
