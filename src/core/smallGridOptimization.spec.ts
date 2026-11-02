import { describe, expect, it } from 'vitest'

import {
  finalizeSmallGridCells,
  finalizeSmallGridResult,
  resolveSmallGridOptimization,
} from '@/core/smallGridOptimization'

describe('small-grid optimization', () => {
  it('uses a two-times balanced intermediate grid for automatic clarity', () => {
    expect(
      resolveSmallGridOptimization('auto', {
        width: 29,
        height: 31,
        strategy: 'few-colors',
        contentMode: 'photo',
        maxColors: 20,
      }),
    ).toMatchObject({
      processingWidth: 58,
      processingHeight: 62,
      strategy: 'balanced',
      contentMode: 'photo',
      maxColors: 12,
    })
  })

  it('offers distinct outline and color-block profiles', () => {
    expect(
      resolveSmallGridOptimization('outline', {
        width: 29,
        height: 31,
        strategy: 'balanced',
        contentMode: 'photo',
        maxColors: 16,
      }),
    ).toMatchObject({
      strategy: 'closest',
      contentMode: 'illustration',
    })
    expect(
      resolveSmallGridOptimization('blocks', {
        width: 29,
        height: 31,
        strategy: 'balanced',
        contentMode: 'photo',
        maxColors: 16,
      }),
    ).toMatchObject({
      strategy: 'few-colors',
      contentMode: 'illustration',
      maxColors: 8,
    })
  })

  it('caps the intermediate grid while preserving its aspect ratio', () => {
    expect(
      resolveSmallGridOptimization('auto', {
        width: 200,
        height: 100,
        strategy: 'balanced',
        contentMode: 'photo',
        maxColors: 12,
      }),
    ).toMatchObject({ processingWidth: 300, processingHeight: 150 })
  })

  it('compresses the intermediate result back to the requested dimensions', () => {
    const result = finalizeSmallGridCells(
      [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2],
      4,
      4,
      2,
      2,
    )

    expect(result).toEqual([1, 2, 1, 2])
  })

  it('reports metrics in final-grid units after two-stage conversion', () => {
    const result = finalizeSmallGridResult(
      [1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2],
      4,
      4,
      2,
      2,
      {
        lowConfidenceCells: 8,
        cleanedCells: 4,
        structuralChanges: 12,
        ditheredCells: 2,
        alignmentOffsetX: 0.5,
        alignmentOffsetY: -0.25,
      },
    )

    expect(result).toEqual({
      cells: [1, 2, 1, 2],
      colorCount: 2,
      lowConfidenceCells: 2,
      cleanedCells: 1,
      structuralChanges: 3,
      ditheredCells: 1,
      alignmentOffsetX: 0.25,
      alignmentOffsetY: -0.125,
    })
  })
})
