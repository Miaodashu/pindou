/// <reference lib="webworker" />

import cvModule from '@techstark/opencv-js'

import { removeEdgeBackground } from '@/core/backgroundRemoval'
import { quantizeToPalette } from '@/core/quantize'
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

async function processWithOpenCv(request: ConvertImageRequest) {
  const cv = await getOpenCv()
  const sourceImageData = new ImageData(
    new Uint8ClampedArray(request.source.data),
    request.source.width,
    request.source.height,
  )
  const source = cv.matFromImageData(sourceImageData)
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

async function processWithCanvas(request: ConvertImageRequest) {
  const sourceCanvas = new OffscreenCanvas(
    request.source.width,
    request.source.height,
  )
  const sourceContext = sourceCanvas.getContext('2d', {
    willReadFrequently: true,
  })
  if (!sourceContext) throw new Error('浏览器无法创建图片处理画布。')
  sourceContext.putImageData(
    new ImageData(
      new Uint8ClampedArray(request.source.data),
      request.source.width,
      request.source.height,
    ),
    0,
    0,
  )

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
  const edges = new Uint8Array(request.target.width * request.target.height)

  for (let y = 1; y < request.target.height - 1; y += 1) {
    for (let x = 1; x < request.target.width - 1; x += 1) {
      const pixel = y * request.target.width + x
      const left = image.data[(pixel - 1) * 4] ?? 0
      const right = image.data[(pixel + 1) * 4] ?? 0
      const top = image.data[(pixel - request.target.width) * 4] ?? 0
      const bottom = image.data[(pixel + request.target.width) * 4] ?? 0
      edges[pixel] = Math.min(
        255,
        Math.abs(right - left) + Math.abs(bottom - top),
      )
    }
  }

  return { pixels: image.data, edges }
}

self.addEventListener(
  'message',
  async (event: MessageEvent<ConvertImageRequest>) => {
    const request = event.data
    if (request.type !== 'resize') return

    try {
      let engine: 'opencv-wasm' | 'canvas-fallback' = 'opencv-wasm'
      let result
      try {
        result = await processWithOpenCv(request)
      } catch (error) {
        console.warn('OpenCV.js failed; using Canvas fallback', error)
        engine = 'canvas-fallback'
        result = await processWithCanvas(request)
      }

      const pixels =
        request.backgroundMode === 'remove-edge'
          ? removeEdgeBackground(
              result.pixels,
              request.target.width,
              request.target.height,
            )
          : result.pixels
      const quantized = quantizeToPalette(
        new ImageData(
          new Uint8ClampedArray(pixels),
          request.target.width,
          request.target.height,
        ),
        request.palette,
        {
          maxColors: request.maxColors,
          strategy: request.strategy,
          edgeMask: result.edges,
        },
      )
      const cells = Uint16Array.from(quantized.cells)

      const response: ConvertImageResponse = {
        id: request.id,
        type: 'success',
        engine,
        cells: cells.buffer,
        selectedColorIndexes: quantized.selectedColorIndexes,
        averageDeltaE: quantized.averageDeltaE,
        maximumDeltaE: quantized.maximumDeltaE,
        lowConfidenceCells: quantized.lowConfidenceCells,
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
