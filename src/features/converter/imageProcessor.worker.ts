/// <reference lib="webworker" />

import cvModule from '@techstark/opencv-js'

import {
  computeSourceEdgeMask,
  edgePreservingFilter,
  sampleImageToGrid,
  selectAdaptiveSampleSize,
} from '@/core/adaptiveSampling'
import { removeEdgeBackground } from '@/core/backgroundRemoval'
import { conversionStrategyPresets } from '@/core/conversionStrategy'
import { quantizeToPalette } from '@/core/quantize'
import { cleanupSpatialRegions } from '@/core/spatialCleanup'
import type { ConvertImageRequest, ConvertImageResponse } from './types'

type OpenCv = typeof import('@techstark/opencv-js')

let openCvPromise: Promise<OpenCv> | undefined

function getOpenCv(): Promise<OpenCv> {
  openCvPromise ??= (async () => {
    const candidate = cvModule as unknown as OpenCv | Promise<OpenCv>
    const cv = candidate instanceof Promise ? await candidate : candidate
    if (cv.Mat) return cv

    await new Promise<void>((resolve) => {
      cv.onRuntimeInitialized = () => resolve()
    })
    return cv
  })()
  return openCvPromise
}

function sourceImageData(request: ConvertImageRequest) {
  return new ImageData(
    new Uint8ClampedArray(request.source.data),
    request.source.width,
    request.source.height,
  )
}

async function processAdaptiveWithOpenCv(request: ConvertImageRequest) {
  const cv = await getOpenCv()
  const filtered = edgePreservingFilter(
    sourceImageData(request),
    conversionStrategyPresets[request.strategy].filterSigmaColor,
  )
  const source = cv.matFromImageData(filtered)
  const grayscale = new cv.Mat()
  const edges = new cv.Mat()

  try {
    cv.cvtColor(source, grayscale, cv.COLOR_RGBA2GRAY)
    cv.Canny(grayscale, edges, 54, 118)
    const sourceEdges = computeSourceEdgeMask(filtered)
    for (let index = 0; index < sourceEdges.length; index += 1) {
      sourceEdges[index] = Math.max(
        sourceEdges[index] ?? 0,
        edges.data[index] ?? 0,
      )
    }

    const sampled = sampleImageToGrid(
      filtered,
      request.target.width,
      request.target.height,
      sourceEdges,
      {
        sampleSize: selectAdaptiveSampleSize(
          filtered.width,
          filtered.height,
          request.target.width,
          request.target.height,
        ),
      },
    )

    return {
      pixels: sampled.imageData.data,
      edges: sampled.edgeMask,
    }
  } finally {
    source.delete()
    grayscale.delete()
    edges.delete()
  }
}

function processAdaptiveFallback(request: ConvertImageRequest) {
  const filtered = edgePreservingFilter(
    sourceImageData(request),
    conversionStrategyPresets[request.strategy].filterSigmaColor,
  )
  const sampled = sampleImageToGrid(
    filtered,
    request.target.width,
    request.target.height,
    computeSourceEdgeMask(filtered),
    {
      sampleSize: selectAdaptiveSampleSize(
        filtered.width,
        filtered.height,
        request.target.width,
        request.target.height,
      ),
    },
  )

  return { pixels: sampled.imageData.data, edges: sampled.edgeMask }
}

async function processLegacyWithOpenCv(request: ConvertImageRequest) {
  const cv = await getOpenCv()
  const source = cv.matFromImageData(sourceImageData(request))
  const resized = new cv.Mat()
  const grayscale = new cv.Mat()
  const edges = new cv.Mat()

  try {
    cv.resize(
      source,
      resized,
      new cv.Size(request.target.width, request.target.height),
      0,
      0,
      cv.INTER_AREA,
    )
    cv.cvtColor(resized, grayscale, cv.COLOR_RGBA2GRAY)
    cv.Canny(grayscale, edges, 60, 120)
    return {
      pixels: new Uint8ClampedArray(resized.data),
      edges: new Uint8Array(edges.data),
    }
  } finally {
    source.delete()
    resized.delete()
    grayscale.delete()
    edges.delete()
  }
}

function processLegacyFallback(request: ConvertImageRequest) {
  const sourceCanvas = new OffscreenCanvas(
    request.source.width,
    request.source.height,
  )
  const sourceContext = sourceCanvas.getContext('2d', {
    willReadFrequently: true,
  })
  if (!sourceContext) throw new Error('浏览器无法创建图片处理画布。')
  sourceContext.putImageData(sourceImageData(request), 0, 0)
  const targetCanvas = new OffscreenCanvas(
    request.target.width,
    request.target.height,
  )
  const targetContext = targetCanvas.getContext('2d', {
    willReadFrequently: true,
  })
  if (!targetContext) throw new Error('浏览器无法创建目标处理画布。')
  targetContext.imageSmoothingEnabled = true
  targetContext.imageSmoothingQuality = 'high'
  targetContext.drawImage(
    sourceCanvas,
    0,
    0,
    request.target.width,
    request.target.height,
  )
  const image = targetContext.getImageData(
    0,
    0,
    request.target.width,
    request.target.height,
  )
  return { pixels: image.data, edges: computeSourceEdgeMask(image) }
}

async function processWithOpenCv(request: ConvertImageRequest) {
  return request.pipelineVersion === 'v1-legacy'
    ? processLegacyWithOpenCv(request)
    : processAdaptiveWithOpenCv(request)
}

function processWithFallback(request: ConvertImageRequest) {
  return request.pipelineVersion === 'v1-legacy'
    ? processLegacyFallback(request)
    : processAdaptiveFallback(request)
}

self.addEventListener(
  'message',
  async (event: MessageEvent<ConvertImageRequest>) => {
    const request = event.data
    if (request.type !== 'resize') return

    try {
      const pipelineVersion = request.pipelineVersion ?? 'v2-adaptive'
      let engine: 'opencv-wasm' | 'canvas-fallback' = 'opencv-wasm'
      let result
      try {
        result = await processWithOpenCv(request)
      } catch (error) {
        console.warn('OpenCV.js failed; using Canvas fallback', error)
        engine = 'canvas-fallback'
        result = processWithFallback(request)
      }

      const pixels =
        request.backgroundMode === 'remove-edge'
          ? removeEdgeBackground(
              result.pixels,
              request.target.width,
              request.target.height,
            )
          : result.pixels
      const sampledImage = new ImageData(
        new Uint8ClampedArray(pixels),
        request.target.width,
        request.target.height,
      )
      const quantized = quantizeToPalette(sampledImage, request.palette, {
        maxColors: request.maxColors,
        strategy: request.strategy,
        edgeMask: result.edges,
        refinePalette: pipelineVersion === 'v2-adaptive',
      })
      const cleaned =
        pipelineVersion === 'v2-adaptive'
          ? cleanupSpatialRegions(
              quantized.cells,
              request.target.width,
              request.target.height,
              sampledImage,
              request.palette,
              result.edges,
              request.strategy,
            )
          : {
              cells: quantized.cells,
              replacedCellCount: 0,
              averageDeltaE: quantized.averageDeltaE,
              maximumDeltaE: quantized.maximumDeltaE,
            }
      const cells = Uint16Array.from(cleaned.cells)
      const selectedColorIndexes = [
        ...new Set(
          cleaned.cells.filter((cell) => cell > 0).map((cell) => cell - 1),
        ),
      ].sort((first, second) => first - second)

      const response: ConvertImageResponse = {
        id: request.id,
        type: 'success',
        engine,
        cells: cells.buffer,
        selectedColorIndexes,
        averageDeltaE: cleaned.averageDeltaE,
        maximumDeltaE: cleaned.maximumDeltaE,
        lowConfidenceCells: quantized.lowConfidenceCells,
        pipelineVersion,
        cleanedCells: cleaned.replacedCellCount,
      }
      self.postMessage(response, {
        transfer: [response.cells],
      })
    } catch (error) {
      const response: ConvertImageResponse = {
        id: request.id,
        type: 'failure',
        message: error instanceof Error ? error.message : '图片处理失败。',
      }
      self.postMessage(response)
    }
  },
)
