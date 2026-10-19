import { hexToRgb, rgbToLab } from '@/core/color'
import type { BeadPalette, PaletteColor } from './types'

const entries = [
  ['D01', '纯白', '#F7F5EF'],
  ['D02', '浅灰', '#C7C9C7'],
  ['D03', '中灰', '#7E8382'],
  ['D04', '炭黑', '#252525'],
  ['D05', '奶油黄', '#F4D06F'],
  ['D06', '明黄', '#F0B429'],
  ['D07', '橙色', '#E97932'],
  ['D08', '朱红', '#D94A38'],
  ['D09', '深红', '#982F35'],
  ['D10', '樱花粉', '#F0A6B6'],
  ['D11', '玫红', '#CF4A78'],
  ['D12', '淡紫', '#B8A0D9'],
  ['D13', '紫色', '#76549E'],
  ['D14', '浅蓝', '#8FC9E8'],
  ['D15', '湖蓝', '#3498C8'],
  ['D16', '深蓝', '#285487'],
  ['D17', '薄荷绿', '#8CC9AE'],
  ['D18', '草绿', '#56A34A'],
  ['D19', '深绿', '#286344'],
  ['D20', '米色', '#D8C6A5'],
  ['D21', '浅棕', '#B98A62'],
  ['D22', '棕色', '#7E5138'],
  ['D23', '深棕', '#4B342B'],
  ['D24', '肤色', '#E8B895'],
] as const

const colors: PaletteColor[] = entries.map(([code, name, hex], index) => {
  const rgb = hexToRgb(hex)
  return {
    id: `generic-${code.toLowerCase()}`,
    code,
    name,
    hex,
    rgb,
    lab: rgbToLab(rgb),
    symbol: String(index + 1),
  }
})

export const genericDigitalPalette: BeadPalette = {
  id: 'generic-digital-v1',
  brand: '通用',
  name: '数字参考色卡',
  version: '1.0.0',
  source: 'digital-reference',
  disclaimer:
    '此色卡用于编辑器和转换算法验证，不对应任何品牌官方色号。正式制作前请导入或选择经过校验的品牌色卡。',
  colors,
}
