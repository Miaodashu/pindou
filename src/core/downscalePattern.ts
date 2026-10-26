export interface DownscalePatternOptions {
  preserveDetails?: boolean
  opaqueCoverageThreshold?: number
}

function hasColorBoundary(
  cells: readonly number[],
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const value = cells[y * width + x] ?? 0
  const neighbors = [
    x > 0 ? cells[y * width + x - 1] : value,
    x < width - 1 ? cells[y * width + x + 1] : value,
    y > 0 ? cells[(y - 1) * width + x] : value,
    y < height - 1 ? cells[(y + 1) * width + x] : value,
  ]
  return neighbors.some((neighbor) => neighbor !== value)
}

/**
 * Reduces an edited bead pattern without rasterizing it back to an image.
 * Exact overlap area keeps large color regions stable, while boundary cells
 * receive a bounded boost so one-cell outlines survive more often.
 */
export function downscalePattern(
  cells: readonly number[],
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  options: DownscalePatternOptions = {},
) {
  if (cells.length !== sourceWidth * sourceHeight) {
    throw new Error('缩小图纸的源数据尺寸不匹配。')
  }
  if (
    targetWidth < 1 ||
    targetHeight < 1 ||
    targetWidth > sourceWidth ||
    targetHeight > sourceHeight
  ) {
    throw new Error('小尺寸图纸必须大于 0，且不能超过当前图纸。')
  }

  const preserveDetails = options.preserveDetails ?? true
  const opaqueCoverageThreshold = options.opaqueCoverageThreshold ?? 0.3
  const output = new Array<number>(targetWidth * targetHeight).fill(0)
  const scaleX = sourceWidth / targetWidth
  const scaleY = sourceHeight / targetHeight

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceTop = targetY * scaleY
    const sourceBottom = (targetY + 1) * scaleY
    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceLeft = targetX * scaleX
      const sourceRight = (targetX + 1) * scaleX
      const scores = new Map<number, number>()
      let opaqueArea = 0
      let totalArea = 0

      for (
        let sourceY = Math.floor(sourceTop);
        sourceY < Math.ceil(sourceBottom);
        sourceY += 1
      ) {
        const overlapY = Math.max(
          0,
          Math.min(sourceBottom, sourceY + 1) - Math.max(sourceTop, sourceY),
        )
        for (
          let sourceX = Math.floor(sourceLeft);
          sourceX < Math.ceil(sourceRight);
          sourceX += 1
        ) {
          const overlapX = Math.max(
            0,
            Math.min(sourceRight, sourceX + 1) - Math.max(sourceLeft, sourceX),
          )
          const area = overlapX * overlapY
          if (area <= 0) continue
          totalArea += area
          const colorIndex = cells[sourceY * sourceWidth + sourceX] ?? 0
          if (colorIndex <= 0) continue
          opaqueArea += area
          const boundaryBoost =
            preserveDetails &&
            hasColorBoundary(cells, sourceWidth, sourceHeight, sourceX, sourceY)
              ? 1.1
              : 0
          const centerX = (sourceLeft + sourceRight) / 2
          const centerY = (sourceTop + sourceBottom) / 2
          const centerBoost =
            preserveDetails &&
            centerX >= sourceX &&
            centerX < sourceX + 1 &&
            centerY >= sourceY &&
            centerY < sourceY + 1
              ? 0.75
              : 0
          scores.set(
            colorIndex,
            (scores.get(colorIndex) ?? 0) +
              area * (1 + boundaryBoost + centerBoost),
          )
        }
      }

      if (
        totalArea <= 0 ||
        opaqueArea / totalArea < opaqueCoverageThreshold ||
        scores.size === 0
      ) {
        continue
      }
      const winner = [...scores.entries()].sort(
        (first, second) => second[1] - first[1] || first[0] - second[0],
      )[0]
      output[targetY * targetWidth + targetX] = winner?.[0] ?? 0
    }
  }

  return output
}
