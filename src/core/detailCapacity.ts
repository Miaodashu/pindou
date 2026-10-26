export interface DetailCapacityAssessment {
  score: number
  recommendedWidth: number
  recommendedHeight: number
  shouldRecommendLargerGrid: boolean
}

/**
 * Estimates whether the chosen bead grid has enough cells for the detected
 * contour density and ambiguous palette matches. It only recommends a size;
 * callers must never resize a user's project automatically.
 */
export function assessDetailCapacity(
  edgeMask: Uint8Array,
  lowConfidenceCells: number,
  width: number,
  height: number,
): DetailCapacityAssessment {
  const cellCount = Math.max(1, width * height)
  const edgeRatio =
    edgeMask.reduce((count, edge) => count + (edge >= 72 ? 1 : 0), 0) /
    cellCount
  const uncertaintyRatio = Math.min(1, lowConfidenceCells / cellCount)
  const score = Math.max(
    35,
    Math.min(100, Math.round(100 - edgeRatio * 65 - uncertaintyRatio * 35)),
  )
  const shouldRecommendLargerGrid = score < 72
  const scale = score < 52 ? 1.5 : shouldRecommendLargerGrid ? 1.25 : 1

  return {
    score,
    recommendedWidth: Math.min(300, Math.max(width, Math.round(width * scale))),
    recommendedHeight: Math.min(
      300,
      Math.max(height, Math.round(height * scale)),
    ),
    shouldRecommendLargerGrid,
  }
}
