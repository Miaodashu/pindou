import type { BeadPalette } from '@/domain/palette/types'
import type { PatternDocument } from '@/domain/pattern/types'

export interface ReconstructionSvgOptions {
  showCodes?: boolean
  showCoordinates?: boolean
  majorEvery?: number
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function createReconstructionSvg(
  pattern: PatternDocument,
  palette: BeadPalette,
  options: ReconstructionSvgOptions = {},
) {
  const cellSize = 24
  const margin = options.showCoordinates === false ? 8 : 32
  const majorEvery = Math.max(1, options.majorEvery ?? 10)
  const contentWidth = pattern.width * cellSize
  const contentHeight = pattern.height * cellSize
  const width = contentWidth + margin + 8
  const height = contentHeight + margin + 8
  const fragments: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#fffdfd"/>',
    `<rect x="${margin}" y="${margin}" width="${contentWidth}" height="${contentHeight}" fill="#ffffff"/>`,
  ]

  pattern.cells.forEach((colorIndex, index) => {
    if (colorIndex <= 0) return
    const color = palette.colors[colorIndex - 1]
    if (!color) return
    const column = index % pattern.width
    const row = Math.floor(index / pattern.width)
    const x = margin + column * cellSize
    const y = margin + row * cellSize
    fragments.push(
      `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${escapeXml(color.hex)}"/>`,
    )
    if (options.showCodes !== false) {
      const luminance =
        color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114
      fragments.push(
        `<text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 2.4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="6" font-weight="700" fill="${luminance < 135 ? '#ffffff' : '#2d3436'}">${escapeXml(color.code)}</text>`,
      )
    }
  })

  for (let column = 0; column <= pattern.width; column += 1) {
    const x = margin + column * cellSize
    const major = column % majorEvery === 0
    fragments.push(
      `<line x1="${x}" y1="${margin}" x2="${x}" y2="${margin + contentHeight}" stroke="${major ? '#c84f5a' : '#ded6d6'}" stroke-width="${major ? 1.4 : 0.55}"/>`,
    )
    if (options.showCoordinates !== false && column < pattern.width) {
      fragments.push(
        `<text x="${x + cellSize / 2}" y="${margin - 10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="6" fill="#62686a">${column + 1}</text>`,
      )
    }
  }

  for (let row = 0; row <= pattern.height; row += 1) {
    const y = margin + row * cellSize
    const major = row % majorEvery === 0
    fragments.push(
      `<line x1="${margin}" y1="${y}" x2="${margin + contentWidth}" y2="${y}" stroke="${major ? '#c84f5a' : '#ded6d6'}" stroke-width="${major ? 1.4 : 0.55}"/>`,
    )
    if (options.showCoordinates !== false && row < pattern.height) {
      fragments.push(
        `<text x="${margin - 10}" y="${y + cellSize / 2 + 2.4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="6" fill="#62686a">${row + 1}</text>`,
      )
    }
  }

  fragments.push('</svg>')
  return fragments.join('')
}
