import type { BeadPalette } from '@/domain/palette/types'
import type { QuantizeStrategy } from '@/core/quantize'

export type BackgroundMode = 'preserve' | 'remove-edge'

export interface ConvertImageRequest {
  id: string
  type: 'resize'
  source: {
    width: number
    height: number
    data: ArrayBuffer
  }
  target: {
    width: number
    height: number
  }
  palette: BeadPalette
  maxColors: number
  strategy: QuantizeStrategy
  backgroundMode: BackgroundMode
}

export interface ConvertImageSuccess {
  id: string
  type: 'success'
  engine: 'opencv-wasm' | 'canvas-fallback'
  cells: ArrayBuffer
  selectedColorIndexes: number[]
  averageDeltaE: number
  maximumDeltaE: number
  lowConfidenceCells: number
}

export interface ConvertImageFailure {
  id: string
  type: 'failure'
  message: string
}

export type ConvertImageResponse = ConvertImageSuccess | ConvertImageFailure
