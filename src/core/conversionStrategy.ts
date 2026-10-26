export type ConversionStrategy = 'balanced' | 'closest' | 'few-colors'

export interface ConversionStrategyPreset {
  usesFullPalette: boolean
  filterSigmaColor: number
  maximumRegionSize: number
  maximumErrorIncrease: number
  protectedEdgeStrength: number
  structuralIterations: number
  smoothnessWeight: number
  edgeContrastWeight: number
  ditheringStrength: number
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
    structuralIterations: 2,
    smoothnessWeight: 0.5,
    edgeContrastWeight: 2.2,
    ditheringStrength: 0.2,
  },
  balanced: {
    usesFullPalette: false,
    filterSigmaColor: 28,
    maximumRegionSize: 2,
    maximumErrorIncrease: 4,
    protectedEdgeStrength: 148,
    structuralIterations: 3,
    smoothnessWeight: 1.35,
    edgeContrastWeight: 1.8,
    ditheringStrength: 0.1,
  },
  'few-colors': {
    usesFullPalette: false,
    filterSigmaColor: 38,
    maximumRegionSize: 3,
    maximumErrorIncrease: 7,
    protectedEdgeStrength: 174,
    structuralIterations: 3,
    smoothnessWeight: 2.5,
    edgeContrastWeight: 1.2,
    ditheringStrength: 0,
  },
}
