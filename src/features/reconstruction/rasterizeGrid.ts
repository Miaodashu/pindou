import type { GridBounds } from './types'

const MAX_EDGE = 2600

async function decodeFile(file: File) {
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

export async function rasterizeGridRegion(file: File, bounds: GridBounds) {
  const image = await decodeFile(file)
  const left = Math.max(0, Math.min(0.8, bounds.left / 100))
  const right = Math.max(0, Math.min(0.8, bounds.right / 100))
  const top = Math.max(0, Math.min(0.8, bounds.top / 100))
  const bottom = Math.max(0, Math.min(0.8, bounds.bottom / 100))
  const sourceWidth = Math.max(1, image.naturalWidth * (1 - left - right))
  const sourceHeight = Math.max(1, image.naturalHeight * (1 - top - bottom))
  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法读取图纸图片。')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    image.naturalWidth * left,
    image.naturalHeight * top,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  )
  return context.getImageData(0, 0, width, height)
}
