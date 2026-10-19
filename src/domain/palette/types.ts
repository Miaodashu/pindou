export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface LabColor {
  l: number
  a: number
  b: number
}

export interface PaletteColor {
  id: string
  code: string
  name: string
  hex: string
  rgb: RgbColor
  lab: LabColor
  symbol: string
}

export interface BeadPalette {
  id: string
  brand: string
  name: string
  version: string
  source: 'official' | 'measured' | 'digital-reference'
  disclaimer?: string
  colors: PaletteColor[]
}
