import type { BeadPalette } from '@/domain/palette/types'
import type { QuantizeStrategy } from '@/core/quantize'
import type { ImageContentMode } from '@/core/imageContentMode'

export type BackgroundMode = 'preserve' | 'remove-edge'
export type ConversionPipelineVersion =
  'v1-legacy' | 'v2-adaptive' | 'v3-structural' | 'v4-line-aware'

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
  contentMode: ImageContentMode
  pipelineVersion?: ConversionPipelineVersion
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
  pipelineVersion: ConversionPipelineVersion
  cleanedCells: number
  structuralChanges: number
  ditheredCells: number
  alignmentOffsetX: number
  alignmentOffsetY: number
  detailScore: number
  recommendedWidth: number
  recommendedHeight: number
  shouldRecommendLargerGrid: boolean
}

export interface ConvertImageFailure {
  id: string
  type: 'failure'
  message: string
}

export type ConvertImageResponse = ConvertImageSuccess | ConvertImageFailure
