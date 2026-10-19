export type ImageFit = 'crop' | 'cover' | 'contain'

export interface ImageCropSettings {
  zoom: number
  offsetX: number
  offsetY: number
}

export interface ImagePlacement {
  drawWidth: number
  drawHeight: number
  drawX: number
  drawY: number
}

const MAX_SOURCE_EDGE = 2048

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function calculateImagePlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  fit: ImageFit,
  crop: ImageCropSettings = { zoom: 1, offsetX: 0, offsetY: 0 },
): ImagePlacement {
  const baseScale =
    fit === 'contain'
      ? Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
      : Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const zoom = fit === 'crop' ? clamp(crop.zoom, 1, 4) : 1
  const drawWidth = sourceWidth * baseScale * zoom
  const drawHeight = sourceHeight * baseScale * zoom
  const maxOffsetX = Math.max(0, (drawWidth - targetWidth) / 2)
  const maxOffsetY = Math.max(0, (drawHeight - targetHeight) / 2)

  return {
    drawWidth,
    drawHeight,
    drawX:
      (targetWidth - drawWidth) / 2 +
      (fit === 'crop' ? clamp(crop.offsetX, -1, 1) * maxOffsetX : 0),
    drawY:
      (targetHeight - drawHeight) / 2 +
      (fit === 'crop' ? clamp(crop.offsetY, -1, 1) * maxOffsetY : 0),
  }
}

async function decodeFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function rasterizeImageFile(
  file: File,
  targetWidth: number,
  targetHeight: number,
  fit: ImageFit,
  crop?: ImageCropSettings,
): Promise<ImageData> {
  const source = await decodeFile(file)
  const sourceWidth = source.width
  const sourceHeight = source.height
  const targetAspect = targetWidth / targetHeight
  const canvasWidth =
    targetAspect >= 1
      ? MAX_SOURCE_EDGE
      : Math.round(MAX_SOURCE_EDGE * targetAspect)
  const canvasHeight =
    targetAspect >= 1
      ? Math.round(MAX_SOURCE_EDGE / targetAspect)
      : MAX_SOURCE_EDGE
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法读取这张图片。')

  context.clearRect(0, 0, canvasWidth, canvasHeight)
  const { drawX, drawY, drawWidth, drawHeight } = calculateImagePlacement(
    sourceWidth,
    sourceHeight,
    canvasWidth,
    canvasHeight,
    fit,
    crop,
  )
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight)

  return context.getImageData(0, 0, canvasWidth, canvasHeight)
}
