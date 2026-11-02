import { downscalePattern } from '@/core/downscalePattern'
import type { ImageContentMode } from '@/core/imageContentMode'
import type { QuantizeStrategy } from '@/core/quantize'

export type SmallGridOptimizationMode = 'off' | 'auto' | 'outline' | 'blocks'

export interface SmallGridGenerationInput {
  width: number
  height: number
  strategy: QuantizeStrategy
  contentMode: ImageContentMode
  maxColors: number
}

export interface SmallGridOptimizationPlan {
  mode: SmallGridOptimizationMode
  processingWidth: number
  processingHeight: number
  strategy: QuantizeStrategy
  contentMode: ImageContentMode
  maxColors: number
}

export interface SmallGridProcessingMetrics {
  lowConfidenceCells: number
  cleanedCells: number
  structuralChanges: number
  ditheredCells: number
  alignmentOffsetX: number
  alignmentOffsetY: number
}

export interface FinalizedSmallGridResult {
  cells: number[]
  colorCount: number
  lowConfidenceCells: number
  cleanedCells: number
  structuralChanges: number
  ditheredCells: number
  alignmentOffsetX: number
  alignmentOffsetY: number
}

export const smallGridOptimizationOptions = [
  {
    id: 'auto',
    label: '自动清晰',
    description: '平衡轮廓和色块，减少直接生成小图时的细节损失。',
  },
  {
    id: 'outline',
    label: '轮廓优先',
    description: '适合动漫和线稿，尽量保留眼睛、五官与细线。',
  },
  {
    id: 'blocks',
    label: '色块优先',
    description: '适合复杂背景，压缩颜色和碎点，让主体更干净。',
  },
] as const satisfies ReadonlyArray<{
  id: Exclude<SmallGridOptimizationMode, 'off'>
  label: string
  description: string
}>

export function resolveSmallGridOptimization(
  mode: SmallGridOptimizationMode,
  input: SmallGridGenerationInput,
): SmallGridOptimizationPlan {
  if (mode === 'off') {
    return {
      mode,
      processingWidth: input.width,
      processingHeight: input.height,
      strategy: input.strategy,
      contentMode: input.contentMode,
      maxColors: input.maxColors,
    }
  }

  const scale = Math.max(1, Math.min(2, 300 / input.width, 300 / input.height))
  const base = {
    mode,
    processingWidth: Math.max(1, Math.round(input.width * scale)),
    processingHeight: Math.max(1, Math.round(input.height * scale)),
  }
  if (mode === 'outline') {
    return {
      ...base,
      strategy: 'closest',
      contentMode: 'illustration',
      maxColors: input.maxColors,
    }
  }
  if (mode === 'blocks') {
    return {
      ...base,
      strategy: 'few-colors',
      contentMode: 'illustration',
      maxColors: Math.min(8, input.maxColors),
    }
  }
  return {
    ...base,
    strategy: 'balanced',
    contentMode: input.contentMode,
    maxColors: Math.min(12, input.maxColors),
  }
}

export function finalizeSmallGridCells(
  cells: readonly number[],
  processingWidth: number,
  processingHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (processingWidth === targetWidth && processingHeight === targetHeight) {
    if (cells.length !== targetWidth * targetHeight) {
      throw new Error('小图优化结果尺寸不匹配。')
    }
    return [...cells]
  }
  return downscalePattern(
    cells,
    processingWidth,
    processingHeight,
    targetWidth,
    targetHeight,
    { preserveDetails: true },
  )
}

export function finalizeSmallGridResult(
  cells: readonly number[],
  processingWidth: number,
  processingHeight: number,
  targetWidth: number,
  targetHeight: number,
  metrics: SmallGridProcessingMetrics,
): FinalizedSmallGridResult {
  const finalizedCells = finalizeSmallGridCells(
    cells,
    processingWidth,
    processingHeight,
    targetWidth,
    targetHeight,
  )
  const targetCellRatio =
    (targetWidth * targetHeight) / (processingWidth * processingHeight)

  return {
    cells: finalizedCells,
    colorCount: new Set(finalizedCells.filter((cell) => cell > 0)).size,
    lowConfidenceCells: Math.round(
      metrics.lowConfidenceCells * targetCellRatio,
    ),
    cleanedCells: Math.round(metrics.cleanedCells * targetCellRatio),
    structuralChanges: Math.round(metrics.structuralChanges * targetCellRatio),
    ditheredCells: Math.round(metrics.ditheredCells * targetCellRatio),
    alignmentOffsetX:
      metrics.alignmentOffsetX * (targetWidth / processingWidth),
    alignmentOffsetY:
      metrics.alignmentOffsetY * (targetHeight / processingHeight),
  }
}
