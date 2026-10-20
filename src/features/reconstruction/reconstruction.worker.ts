/// <reference lib="webworker" />

import { reconstructPattern } from '@/core/patternReconstruction'
import type { ReconstructionRequest, ReconstructionResponse } from './types'

self.addEventListener(
  'message',
  (event: MessageEvent<ReconstructionRequest>) => {
    const request = event.data
    if (request.type !== 'reconstruct') return
    try {
      const result = reconstructPattern(
        new ImageData(
          new Uint8ClampedArray(request.source.data),
          request.source.width,
          request.source.height,
        ),
        request.palette,
        {
          columns: request.columns,
          rows: request.rows,
          allowedPaletteIndexes: request.allowedPaletteIndexes,
        },
      )
      const cells = Uint16Array.from(result.cells)
      const confidence = Float32Array.from(result.confidence)
      const uncertainCells = Uint32Array.from(result.uncertainCells)
      const response: ReconstructionResponse = {
        id: request.id,
        type: 'success',
        cells: cells.buffer,
        confidence: confidence.buffer,
        uncertainCells: uncertainCells.buffer,
        averageDeltaE: result.averageDeltaE,
        maximumDeltaE: result.maximumDeltaE,
      }
      self.postMessage(response, {
        transfer: [
          response.cells,
          response.confidence,
          response.uncertainCells,
        ],
      })
    } catch (error) {
      const response: ReconstructionResponse = {
        id: request.id,
        type: 'failure',
        message: error instanceof Error ? error.message : '图纸识别失败。',
      }
      self.postMessage(response)
    }
  },
)
