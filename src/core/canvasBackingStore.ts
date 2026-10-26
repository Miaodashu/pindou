const MAX_CANVAS_EDGE = 8192
const MAX_CANVAS_PIXELS = 16_777_216

export interface CanvasBackingStore {
  width: number
  height: number
  pixelRatio: number
}

export function calculateCanvasBackingStore(
  logicalWidth: number,
  logicalHeight: number,
  requestedPixelRatio: number,
): CanvasBackingStore {
  const safeWidth = Math.max(1, logicalWidth)
  const safeHeight = Math.max(1, logicalHeight)
  const safePixelRatio =
    Number.isFinite(requestedPixelRatio) && requestedPixelRatio > 0
      ? requestedPixelRatio
      : 1
  const pixelRatio = Math.min(
    safePixelRatio,
    MAX_CANVAS_EDGE / safeWidth,
    MAX_CANVAS_EDGE / safeHeight,
    Math.sqrt(MAX_CANVAS_PIXELS / (safeWidth * safeHeight)),
  )
  const width = Math.max(1, Math.floor(safeWidth * pixelRatio))
  const height = Math.max(1, Math.floor(safeHeight * pixelRatio))

  return {
    width,
    height,
    pixelRatio: Math.min(width / safeWidth, height / safeHeight),
  }
}

export function calculateCanvasExportCellSize(
  gridWidth: number,
  gridHeight: number,
  desiredCellSize: number,
) {
  const budget = calculateCanvasBackingStore(
    gridWidth * desiredCellSize,
    gridHeight * desiredCellSize,
    1,
  )
  return Math.max(
    1,
    Math.min(desiredCellSize, Math.floor(desiredCellSize * budget.pixelRatio)),
  )
}
