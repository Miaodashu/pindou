export type ConversionStrategy = 'balanced' | 'closest' | 'few-colors'

export interface ConversionStrategyPreset {
  usesFullPalette: boolean
  filterSigmaColor: number
  maximumRegionSize: number
  maximumErrorIncrease: number
  protectedEdgeStrength: number
}

export const conversionStrategyPresets: Record<
  ConversionStrategy,
  ConversionStrategyPreset
> = {
  closest: {
    usesFullPalette: true,
    filterSigmaColor: 20,
    maximumRegionSize: 1,
    maximumErrorIncrease: 1.25,
    protectedEdgeStrength: 118,
  },
  balanced: {
    usesFullPalette: false,
    filterSigmaColor: 28,
    maximumRegionSize: 2,
    maximumErrorIncrease: 4,
    protectedEdgeStrength: 148,
  },
  'few-colors': {
    usesFullPalette: false,
    filterSigmaColor: 38,
    maximumRegionSize: 3,
    maximumErrorIncrease: 7,
    protectedEdgeStrength: 174,
  },
}
