import { hexToRgb, rgbToLab } from '@/core/color'
import rawColors from './mard221.data.json'
import type { BeadPalette, PaletteColor } from './types'

const seriesNames: Record<string, string> = {
  A: '黄橙系',
  B: '绿色系',
  C: '蓝青系',
  D: '紫色系',
  E: '粉色系',
  F: '红色系',
  G: '棕肤系',
  H: '中性色',
  M: '莫兰迪系',
}

const colors: PaletteColor[] = rawColors.map(({ code, hex }) => {
  const rgb = hexToRgb(hex)
  const series = code.charAt(0)
  return {
    id: `mard-221-${code.toLowerCase()}`,
    code,
    name: `${seriesNames[series] ?? 'Mard'} ${code}`,
    hex,
    rgb,
    lab: rgbToLab(rgb),
    symbol: code,
  }
})

export const mard221Palette: BeadPalette = {
  id: 'mard-221-reference-v1',
  brand: 'Mard',
  name: 'Mard 221 色卡',
  version: '2026.10-reference.2',
  source: 'digital-reference',
  disclaimer:
    '色号与屏幕参考值核对自 2026 修订版 Mard 色卡；批次、光线与显示设备会造成差异，正式备料请用实物色卡复核。',
  colors,
}
