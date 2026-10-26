export interface GridAlignment {
  offsetX: number
  offsetY: number
  score: number
  gain: number
}

const ALIGNMENT_OFFSETS = [0, -1 / 3, 1 / 3] as const

function boundaryCloseness(value: number) {
  const fraction = value - Math.floor(value)
  return 1 - Math.min(fraction, 1 - fraction) * 2
}

function scoreAlignment(
  edgeMask: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  offsetX: number,
  offsetY: number,
) {
  const stride = Math.max(
    1,
    Math.ceil(Math.sqrt((sourceWidth * sourceHeight) / 12_000)),
  )
  let weightedScore = 0
  let edgeWeight = 0

  for (let y = stride; y < sourceHeight - stride; y += stride) {
    for (let x = stride; x < sourceWidth - stride; x += stride) {
      const edge = edgeMask[y * sourceWidth + x] ?? 0
      if (edge < 24) continue
      const gridX = ((x + 0.5) / sourceWidth) * targetWidth - offsetX
      const gridY = ((y + 0.5) / sourceHeight) * targetHeight - offsetY
      const horizontal = boundaryCloseness(gridX)
      const vertical = boundaryCloseness(gridY)
      const alignment =
        Math.max(horizontal, vertical) + Math.min(horizontal, vertical) * 0.2
      const weight = Math.pow(edge / 255, 1.35)
      weightedScore += alignment * weight
      edgeWeight += weight
    }
  }

  return edgeWeight === 0 ? 0 : weightedScore / edgeWeight
}

/**
 * Selects a deterministic sub-cell phase that places strong source contours
 * closer to bead boundaries. This prevents a half-cell crop offset from
 * dissolving one-cell eyes, outlines, and text strokes during sampling.
 */
export function selectGridAlignment(
  edgeMask: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): GridAlignment {
  if (edgeMask.length !== sourceWidth * sourceHeight) {
    throw new Error('网格对齐的边缘数据尺寸不匹配。')
  }
  const baseline = scoreAlignment(
    edgeMask,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    0,
    0,
  )
  let best: GridAlignment = {
    offsetX: 0,
    offsetY: 0,
    score: baseline,
    gain: 0,
  }

  for (const offsetY of ALIGNMENT_OFFSETS) {
    for (const offsetX of ALIGNMENT_OFFSETS) {
      if (offsetX === 0 && offsetY === 0) continue
      const score = scoreAlignment(
        edgeMask,
        sourceWidth,
        sourceHeight,
        targetWidth,
        targetHeight,
        offsetX,
        offsetY,
      )
      if (score > best.score + 0.005) {
        best = {
          offsetX,
          offsetY,
          score,
          gain: score - baseline,
        }
      }
    }
  }

  return best
}
