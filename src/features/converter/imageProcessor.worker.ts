/// <reference lib="webworker" />

import cvModule from '@techstark/opencv-js'

import {
  computeSourceEdgeMask,
  edgePreservingFilter,
  sampleImageToGrid,
  selectAdaptiveEdgeThresholds,
  selectAdaptiveSampleSize,
} from '@/core/adaptiveSampling'
import { removeEdgeBackground } from '@/core/backgroundRemoval'
import { conversionStrategyPresets } from '@/core/conversionStrategy'
import { assessDetailCapacity } from '@/core/detailCapacity'
import { selectGridAlignment } from '@/core/gridAlignment'
import { quantizeToPalette } from '@/core/quantize'
import { cleanupSpatialRegions } from '@/core/spatialCleanup'
import {
  applyControlledDithering,
  measurePatternError,
  optimizePatternStructure,
} from '@/core/structuralOptimization'
import type { ConvertImageRequest, ConvertImageResponse } from './types'

type OpenCv = typeof import('@techstark/opencv-js')

let openCvPromise: Promise<OpenCv> | undefined

function hasStructuralCapabilities(
  pipelineVersion: ConvertImageRequest['pipelineVersion'],
) {
  return (
    pipelineVersion === 'v3-structural' || pipelineVersion === 'v4-line-aware'
  )
}

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
  const original = sourceImageData(request)
  const filtered =
    request.contentMode === 'pixel-art'
      ? original
      : edgePreservingFilter(
          original,
          conversionStrategyPresets[request.strategy].filterSigmaColor,
        )
  const source = cv.matFromImageData(filtered)
  const grayscale = new cv.Mat()
  const edges = new cv.Mat()

  try {
    cv.cvtColor(source, grayscale, cv.COLOR_RGBA2GRAY)
    const sourceEdges = computeSourceEdgeMask(filtered)
    const thresholds = hasStructuralCapabilities(request.pipelineVersion)
      ? selectAdaptiveEdgeThresholds(sourceEdges)
      : { low: 54, high: 118 }
    cv.Canny(grayscale, edges, thresholds.low, thresholds.high)
    for (let index = 0; index < sourceEdges.length; index += 1) {
      sourceEdges[index] = Math.max(
        sourceEdges[index] ?? 0,
        edges.data[index] ?? 0,
      )
    }

    const alignment = hasStructuralCapabilities(request.pipelineVersion)
      ? selectGridAlignment(
          sourceEdges,
          filtered.width,
          filtered.height,
          request.target.width,
          request.target.height,
        )
      : { offsetX: 0, offsetY: 0, score: 0, gain: 0 }
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
          request.contentMode,
        ),
        offsetX: alignment.offsetX,
        offsetY: alignment.offsetY,
        collectCellFeatures: hasStructuralCapabilities(request.pipelineVersion),
        contentMode: request.contentMode,
      },
    )

    return {
      pixels: sampled.imageData.data,
      edges: sampled.edgeMask,
      cellFeatures: sampled.cellFeatures,
      alignment,
    }
  } finally {
    source.delete()
    grayscale.delete()
    edges.delete()
  }
}

function processAdaptiveFallback(request: ConvertImageRequest) {
  const original = sourceImageData(request)
  const filtered =
    request.contentMode === 'pixel-art'
      ? original
      : edgePreservingFilter(
          original,
          conversionStrategyPresets[request.strategy].filterSigmaColor,
        )
  const sourceEdges = computeSourceEdgeMask(filtered)
  const alignment = hasStructuralCapabilities(request.pipelineVersion)
    ? selectGridAlignment(
        sourceEdges,
        filtered.width,
        filtered.height,
        request.target.width,
        request.target.height,
      )
    : { offsetX: 0, offsetY: 0, score: 0, gain: 0 }
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
        request.contentMode,
      ),
      offsetX: alignment.offsetX,
      offsetY: alignment.offsetY,
      collectCellFeatures: hasStructuralCapabilities(request.pipelineVersion),
      contentMode: request.contentMode,
    },
  )

  return {
    pixels: sampled.imageData.data,
    edges: sampled.edgeMask,
    cellFeatures: sampled.cellFeatures,
    alignment,
  }
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
      cellFeatures: undefined,
      alignment: { offsetX: 0, offsetY: 0, score: 0, gain: 0 },
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
  return {
    pixels: image.data,
    edges: computeSourceEdgeMask(image),
    cellFeatures: undefined,
    alignment: { offsetX: 0, offsetY: 0, score: 0, gain: 0 },
  }
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
      const pipelineVersion = request.pipelineVersion ?? 'v4-line-aware'
      request.pipelineVersion = pipelineVersion
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
        refinePalette: pipelineVersion !== 'v1-legacy',
        cellFeatures: hasStructuralCapabilities(pipelineVersion)
          ? result.cellFeatures
          : undefined,
        contentMode: request.contentMode,
      })
      const protectedDetails = Uint8Array.from(
        result.cellFeatures?.map((feature) =>
          (request.contentMode === 'illustration' && feature.protectedDetail) ||
          (request.contentMode === 'photo' && feature.edgeStrength >= 96)
            ? 1
            : 0,
        ) ?? [],
      )
      const structured = hasStructuralCapabilities(pipelineVersion)
        ? optimizePatternStructure(
            quantized.cells,
            quantized.candidateAssignments,
            request.target.width,
            request.target.height,
            sampledImage,
            request.palette,
            result.edges,
            request.strategy,
            protectedDetails,
          )
        : { cells: quantized.cells, changedCells: 0 }
      const cleaned =
        pipelineVersion !== 'v1-legacy'
          ? cleanupSpatialRegions(
              structured.cells,
              request.target.width,
              request.target.height,
              sampledImage,
              request.palette,
              result.edges,
              request.strategy,
              protectedDetails,
              request.contentMode === 'photo',
            )
          : {
              cells: quantized.cells,
              replacedCellCount: 0,
              averageDeltaE: quantized.averageDeltaE,
              maximumDeltaE: quantized.maximumDeltaE,
            }
      const dithered =
        hasStructuralCapabilities(pipelineVersion) &&
        request.contentMode !== 'pixel-art'
          ? applyControlledDithering(
              cleaned.cells,
              quantized.candidateAssignments,
              result.cellFeatures ?? [],
              request.target.width,
              request.target.height,
              result.edges,
              request.palette,
              request.strategy,
            )
          : { cells: cleaned.cells, ditheredCells: 0 }
      const measured = measurePatternError(
        dithered.cells,
        sampledImage,
        request.palette,
      )
      const capacity = assessDetailCapacity(
        result.edges,
        quantized.lowConfidenceCells,
        request.target.width,
        request.target.height,
      )
      const cells = Uint16Array.from(dithered.cells)
      const selectedColorIndexes = [
        ...new Set(
          dithered.cells.filter((cell) => cell > 0).map((cell) => cell - 1),
        ),
      ].sort((first, second) => first - second)

      const response: ConvertImageResponse = {
        id: request.id,
        type: 'success',
        engine,
        cells: cells.buffer,
        selectedColorIndexes,
        averageDeltaE: measured.averageDeltaE,
        maximumDeltaE: measured.maximumDeltaE,
        lowConfidenceCells: quantized.lowConfidenceCells,
        pipelineVersion,
        cleanedCells: cleaned.replacedCellCount,
        structuralChanges: structured.changedCells,
        ditheredCells: dithered.ditheredCells,
        alignmentOffsetX: result.alignment.offsetX,
        alignmentOffsetY: result.alignment.offsetY,
        detailScore: capacity.score,
        recommendedWidth: capacity.recommendedWidth,
        recommendedHeight: capacity.recommendedHeight,
        shouldRecommendLargerGrid: capacity.shouldRecommendLargerGrid,
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
