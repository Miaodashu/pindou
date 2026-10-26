import type { ImageContentMode } from '@/core/imageContentMode'

export interface AdaptiveSamplingOptions {
  sampleSize?: 5 | 7 | 11
  alphaCoverageThreshold?: number
  offsetX?: number
  offsetY?: number
  collectCellFeatures?: boolean
  contentMode?: ImageContentMode
}

export interface SampledColorCandidate {
  red: number
  green: number
  blue: number
  weight: number
}

export interface SampledCellFeature {
  coverage: number
  variance: number
  edgeStrength: number
  lineStrength: number
  protectedDetail: boolean
  candidates: SampledColorCandidate[]
}

export interface AdaptiveSamplingResult {
  imageData: ImageData
  edgeMask: Uint8Array
  cellFeatures: SampledCellFeature[]
}

export function selectAdaptiveSampleSize(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  contentMode: ImageContentMode = 'photo',
): 5 | 7 | 11 {
  if (contentMode === 'illustration') return 11
  const sourcePixelsPerCell = Math.min(
    sourceWidth / Math.max(1, targetWidth),
    sourceHeight / Math.max(1, targetHeight),
  )
  return sourcePixelsPerCell >= 10 ? 7 : 5
}

interface ColorBucket {
  weight: number
  linearRed: number
  linearGreen: number
  linearBlue: number
  edgeWeight: number
}

const srgbToLinear = (value: number) => {
  const channel = value / 255
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4)
}

const linearToSrgb = (value: number) => {
  const channel =
    value <= 0.0031308
      ? value * 12.92
      : 1.055 * Math.pow(value, 1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
}

const luminance = (red: number, green: number, blue: number) =>
  red * 0.2126 + green * 0.7152 + blue * 0.0722

/**
 * Small alpha-aware bilateral filter shared by the OpenCV and fallback paths.
 * Transparent pixels never contribute hidden RGB values to an opaque neighbor,
 * preventing colored halos around PNG artwork.
 */
export function edgePreservingFilter(
  source: ImageData,
  sigmaColor: number,
): ImageData {
  const output = new Uint8ClampedArray(source.data)
  const colorDenominator = 2 * sigmaColor * sigmaColor
  const spatialWeights = [0.62, 1, 0.62, 1, 1.65, 1, 0.62, 1, 0.62]

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = y * source.width + x
      const offset = index * 4
      const alpha = source.data[offset + 3] ?? 0
      if (alpha < 16) continue
      const red = source.data[offset] ?? 0
      const green = source.data[offset + 1] ?? 0
      const blue = source.data[offset + 2] ?? 0
      let redTotal = 0
      let greenTotal = 0
      let blueTotal = 0
      let weightTotal = 0

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighborY = Math.min(source.height - 1, Math.max(0, y + offsetY))
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const neighborX = Math.min(source.width - 1, Math.max(0, x + offsetX))
          const neighborOffset = (neighborY * source.width + neighborX) * 4
          const neighborAlpha = source.data[neighborOffset + 3] ?? 0
          if (neighborAlpha < 16) continue
          const neighborRed = source.data[neighborOffset] ?? 0
          const neighborGreen = source.data[neighborOffset + 1] ?? 0
          const neighborBlue = source.data[neighborOffset + 2] ?? 0
          const colorDistance =
            Math.pow(neighborRed - red, 2) +
            Math.pow(neighborGreen - green, 2) +
            Math.pow(neighborBlue - blue, 2)
          const alphaWeight = 1 - Math.abs(neighborAlpha - alpha) / 255
          const spatialIndex = (offsetY + 1) * 3 + offsetX + 1
          const weight =
            (spatialWeights[spatialIndex] ?? 1) *
            Math.exp(-colorDistance / colorDenominator) *
            alphaWeight
          redTotal += neighborRed * weight
          greenTotal += neighborGreen * weight
          blueTotal += neighborBlue * weight
          weightTotal += weight
        }
      }

      if (weightTotal > 0) {
        output[offset] = Math.round(redTotal / weightTotal)
        output[offset + 1] = Math.round(greenTotal / weightTotal)
        output[offset + 2] = Math.round(blueTotal / weightTotal)
      }
    }
  }

  return new ImageData(output, source.width, source.height)
}

/**
 * Produces an edge mask before the source is reduced to bead resolution.
 * Alpha boundaries count as edges so transparent artwork does not acquire a
 * blended fringe during sampling.
 */
export function computeSourceEdgeMask(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData
  const grayscale = new Float32Array(width * height)
  const edges = new Uint8Array(width * height)

  for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
    const offset = pixel * 4
    const alpha = (data[offset + 3] ?? 0) / 255
    grayscale[pixel] =
      luminance(
        data[offset] ?? 0,
        data[offset + 1] ?? 0,
        data[offset + 2] ?? 0,
      ) * alpha
  }

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      const topLeft = grayscale[index - width - 1] ?? 0
      const top = grayscale[index - width] ?? 0
      const topRight = grayscale[index - width + 1] ?? 0
      const left = grayscale[index - 1] ?? 0
      const right = grayscale[index + 1] ?? 0
      const bottomLeft = grayscale[index + width - 1] ?? 0
      const bottom = grayscale[index + width] ?? 0
      const bottomRight = grayscale[index + width + 1] ?? 0
      const gradientX =
        -topLeft - 2 * left - bottomLeft + topRight + 2 * right + bottomRight
      const gradientY =
        -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight
      const colorGradient = Math.hypot(gradientX, gradientY) / 4

      const alphaOffset = index * 4 + 3
      const alphaGradient = Math.max(
        Math.abs((data[alphaOffset - 4] ?? 0) - (data[alphaOffset + 4] ?? 0)),
        Math.abs(
          (data[alphaOffset - width * 4] ?? 0) -
            (data[alphaOffset + width * 4] ?? 0),
        ),
      )
      edges[index] = Math.min(255, Math.max(colorGradient, alphaGradient))
    }
  }

  return edges
}

export function selectAdaptiveEdgeThresholds(edgeMask: Uint8Array) {
  const histogram = new Uint32Array(256)
  let count = 0
  edgeMask.forEach((value) => {
    if (value < 4) return
    histogram[value] = (histogram[value] ?? 0) + 1
    count += 1
  })
  if (count === 0) return { low: 48, high: 112 }

  const percentile = (ratio: number) => {
    const target = count * ratio
    let total = 0
    for (let value = 0; value < histogram.length; value += 1) {
      total += histogram[value] ?? 0
      if (total >= target) return value
    }
    return 255
  }
  const high = Math.max(72, Math.min(180, percentile(0.82)))
  return {
    low: Math.max(28, Math.round(high * 0.46)),
    high,
  }
}

/**
 * Samples the source area represented by every bead cell. Smooth areas use a
 * linear-RGB average; high-variance and contour cells use a real, dominant
 * source color so opposite sides of an edge are not blended into a new color.
 */
export function sampleImageToGrid(
  source: ImageData,
  targetWidth: number,
  targetHeight: number,
  sourceEdges: Uint8Array,
  options: AdaptiveSamplingOptions = {},
): AdaptiveSamplingResult {
  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('目标图纸尺寸必须大于 0。')
  }
  if (sourceEdges.length !== source.width * source.height) {
    throw new Error('原图边缘数据尺寸不匹配。')
  }

  const sampleSize = options.sampleSize ?? 7
  const alphaCoverageThreshold = options.alphaCoverageThreshold ?? 0.32
  const offsetX = Math.max(-0.5, Math.min(0.5, options.offsetX ?? 0))
  const offsetY = Math.max(-0.5, Math.min(0.5, options.offsetY ?? 0))
  const collectCellFeatures = options.collectCellFeatures ?? true
  const contentMode = options.contentMode ?? 'photo'
  const output = new Uint8ClampedArray(targetWidth * targetHeight * 4)
  const targetEdges = new Uint8Array(targetWidth * targetHeight)
  const cellFeatures: SampledCellFeature[] = collectCellFeatures
    ? Array.from({ length: targetWidth * targetHeight }, () => ({
        coverage: 0,
        variance: 0,
        edgeStrength: 0,
        lineStrength: 0,
        protectedDetail: false,
        candidates: [],
      }))
    : []
  const edgeProbeRadius = Math.max(
    1,
    Math.floor(
      Math.min(source.width / targetWidth, source.height / targetHeight) /
        sampleSize /
        2,
    ),
  )

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const buckets = new Map<number, ColorBucket>()
      let totalSampleWeight = 0
      let opaqueWeight = 0
      let linearRed = 0
      let linearGreen = 0
      let linearBlue = 0
      let squaredLuminance = 0
      let edgeTotal = 0
      let maximumEdge = 0
      let totalEdgeWeight = 0
      let centerKey = -1

      for (let sampleY = 0; sampleY < sampleSize; sampleY += 1) {
        for (let sampleX = 0; sampleX < sampleSize; sampleX += 1) {
          const normalizedX = (sampleX + 0.5) / sampleSize
          const normalizedY = (sampleY + 0.5) / sampleSize
          const sourceX = Math.max(
            0,
            Math.min(
              source.width - 1,
              Math.floor(
                ((targetX + normalizedX + offsetX) / targetWidth) *
                  source.width,
              ),
            ),
          )
          const sourceY = Math.max(
            0,
            Math.min(
              source.height - 1,
              Math.floor(
                ((targetY + normalizedY + offsetY) / targetHeight) *
                  source.height,
              ),
            ),
          )
          const sourceIndex = sourceY * source.width + sourceX
          const offset = sourceIndex * 4
          const alpha = (source.data[offset + 3] ?? 0) / 255
          const distanceFromCenter = Math.hypot(
            normalizedX - 0.5,
            normalizedY - 0.5,
          )
          const spatialWeight =
            1 + Math.max(0, 1 - distanceFromCenter * 2) * 1.5
          totalSampleWeight += spatialWeight
          if (alpha < 0.04) continue

          const weight = spatialWeight * alpha
          const red = source.data[offset] ?? 0
          const green = source.data[offset + 1] ?? 0
          const blue = source.data[offset + 2] ?? 0
          const lr = srgbToLinear(red)
          const lg = srgbToLinear(green)
          const lb = srgbToLinear(blue)
          const light = luminance(lr, lg, lb)
          const edge = Math.max(
            sourceEdges[sourceIndex] ?? 0,
            sourceEdges[
              sourceY * source.width + Math.max(0, sourceX - edgeProbeRadius)
            ] ?? 0,
            sourceEdges[
              sourceY * source.width +
                Math.min(source.width - 1, sourceX + edgeProbeRadius)
            ] ?? 0,
            sourceEdges[
              Math.max(0, sourceY - edgeProbeRadius) * source.width + sourceX
            ] ?? 0,
            sourceEdges[
              Math.min(source.height - 1, sourceY + edgeProbeRadius) *
                source.width +
                sourceX
            ] ?? 0,
          )
          const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4)
          const bucket = buckets.get(key) ?? {
            weight: 0,
            linearRed: 0,
            linearGreen: 0,
            linearBlue: 0,
            edgeWeight: 0,
          }
          bucket.weight += weight
          bucket.linearRed += lr * weight
          bucket.linearGreen += lg * weight
          bucket.linearBlue += lb * weight
          bucket.edgeWeight += weight * (edge / 255)
          buckets.set(key, bucket)

          opaqueWeight += weight
          linearRed += lr * weight
          linearGreen += lg * weight
          linearBlue += lb * weight
          squaredLuminance += light * light * weight
          edgeTotal += edge * spatialWeight
          maximumEdge = Math.max(maximumEdge, edge)
          totalEdgeWeight += weight * (edge / 255)
          if (
            sampleX === Math.floor(sampleSize / 2) &&
            sampleY === Math.floor(sampleSize / 2)
          ) {
            centerKey = key
          }
        }
      }

      const targetIndex = targetY * targetWidth + targetX
      const outputOffset = targetIndex * 4
      const coverage =
        totalSampleWeight === 0 ? 0 : opaqueWeight / totalSampleWeight
      if (coverage < alphaCoverageThreshold || opaqueWeight === 0) continue

      const averageRed = linearRed / opaqueWeight
      const averageGreen = linearGreen / opaqueWeight
      const averageBlue = linearBlue / opaqueWeight
      const averageLuminance = luminance(averageRed, averageGreen, averageBlue)
      const variance = Math.max(
        0,
        squaredLuminance / opaqueWeight - averageLuminance * averageLuminance,
      )
      const averageEdge = edgeTotal / Math.max(1, totalSampleWeight)
      const useDominantColor =
        contentMode === 'pixel-art' || variance > 0.006 || maximumEdge > 58

      let winner: ColorBucket | undefined
      let candidates: SampledColorCandidate[] = []
      let lineStrength = 0
      let protectedDetail = false
      if (useDominantColor) {
        if (collectCellFeatures) {
          const rankedBuckets = [...buckets.entries()]
            .map(([key, bucket]) => {
              const centerShare =
                key === centerKey ? bucket.weight / opaqueWeight : 0
              const centerBoost =
                maximumEdge > 72 && centerShare >= 0.035 ? 1.1 : 0
              const bucketLuminance = luminance(
                bucket.linearRed / bucket.weight,
                bucket.linearGreen / bucket.weight,
                bucket.linearBlue / bucket.weight,
              )
              const share = bucket.weight / opaqueWeight
              const darknessContrast = Math.max(
                0,
                averageLuminance - bucketLuminance,
              )
              const edgeShare =
                totalEdgeWeight <= 0 ? 0 : bucket.edgeWeight / totalEdgeWeight
              const strokeCandidate =
                contentMode === 'illustration' &&
                maximumEdge >= 42 &&
                share >= 0.008 &&
                darknessContrast >= 0.035 &&
                edgeShare >= 0.08
              const strokeBoost = strokeCandidate
                ? opaqueWeight *
                  Math.min(3.5, darknessContrast * 3.6 + edgeShare * 0.75)
                : 0
              return {
                bucket,
                share,
                strokeCandidate,
                strokeStrength: strokeCandidate
                  ? Math.min(1, darknessContrast * 1.8 + edgeShare * 0.55)
                  : 0,
                score: bucket.weight + opaqueWeight * centerBoost + strokeBoost,
              }
            })
            .sort((first, second) => second.score - first.score)
          winner = rankedBuckets[0]?.bucket
          const winningBucket = rankedBuckets[0]
          lineStrength = winningBucket?.strokeStrength ?? 0
          protectedDetail = Boolean(
            winningBucket?.strokeCandidate &&
            winningBucket.share <= 0.46 &&
            lineStrength >= 0.16,
          )
          candidates = rankedBuckets.slice(0, 4).map(({ bucket, score }) => ({
            red: linearToSrgb(bucket.linearRed / bucket.weight),
            green: linearToSrgb(bucket.linearGreen / bucket.weight),
            blue: linearToSrgb(bucket.linearBlue / bucket.weight),
            weight: score,
          }))
        } else {
          let winnerScore = Number.NEGATIVE_INFINITY
          for (const [key, bucket] of buckets) {
            const centerShare =
              key === centerKey ? bucket.weight / opaqueWeight : 0
            const centerBoost =
              maximumEdge > 72 && centerShare >= 0.035 ? 1.1 : 0
            const score = bucket.weight + opaqueWeight * centerBoost
            if (score > winnerScore) {
              winner = bucket
              winnerScore = score
            }
          }
        }
      } else if (collectCellFeatures) {
        candidates = [
          {
            red: linearToSrgb(averageRed),
            green: linearToSrgb(averageGreen),
            blue: linearToSrgb(averageBlue),
            weight: 1,
          },
        ]
      }
      if (collectCellFeatures) {
        const candidateWeight = candidates.reduce(
          (total, candidate) => total + candidate.weight,
          0,
        )
        candidates.forEach((candidate) => {
          candidate.weight =
            candidateWeight === 0 ? 0 : candidate.weight / candidateWeight
        })
      }

      let resultRed = averageRed
      let resultGreen = averageGreen
      let resultBlue = averageBlue
      if (useDominantColor && winner) {
        resultRed = winner.linearRed / winner.weight
        resultGreen = winner.linearGreen / winner.weight
        resultBlue = winner.linearBlue / winner.weight
      }

      output[outputOffset] = linearToSrgb(resultRed)
      output[outputOffset + 1] = linearToSrgb(resultGreen)
      output[outputOffset + 2] = linearToSrgb(resultBlue)
      output[outputOffset + 3] = 255
      targetEdges[targetIndex] = Math.min(
        255,
        Math.round(maximumEdge * 0.65 + averageEdge * 0.35),
      )
      if (collectCellFeatures) {
        cellFeatures[targetIndex] = {
          coverage,
          variance,
          edgeStrength: targetEdges[targetIndex] ?? 0,
          lineStrength,
          protectedDetail,
          candidates,
        }
      }
    }
  }

  return {
    imageData: new ImageData(output, targetWidth, targetHeight),
    edgeMask: targetEdges,
    cellFeatures,
  }
}
