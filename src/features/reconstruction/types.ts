import type { BeadPalette } from '@/domain/palette/types'

export interface GridBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export interface GridCalibration extends GridBounds {
  columns: number
  rows: number
}

export interface ReconstructionRequest {
  id: string
  type: 'reconstruct'
  source: {
    width: number
    height: number
    data: ArrayBuffer
  }
  palette: BeadPalette
  columns: number
  rows: number
  allowedPaletteIndexes: number[]
}

export interface ReconstructionSuccess {
  id: string
  type: 'success'
  cells: ArrayBuffer
  confidence: ArrayBuffer
  uncertainCells: ArrayBuffer
  averageDeltaE: number
  maximumDeltaE: number
}

export interface ReconstructionFailure {
  id: string
  type: 'failure'
  message: string
}

export type ReconstructionResponse =
  ReconstructionSuccess | ReconstructionFailure
