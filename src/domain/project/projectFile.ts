import { genericDigitalPalette } from '@/domain/palette/genericPalette'
import { parsePaletteDocument } from '@/domain/palette/parsePalette'
import type { BeadPalette } from '@/domain/palette/types'
import { parsePatternDocument } from '@/domain/pattern/parsePattern'
import type { PatternDocument } from '@/domain/pattern/types'

export const PROJECT_FILE_VERSION = 1 as const

export interface ProjectFile {
  kind: 'pindou-project'
  version: typeof PROJECT_FILE_VERSION
  pattern: PatternDocument
  palette: BeadPalette
}

function verifyCompatibility(pattern: PatternDocument, palette: BeadPalette) {
  if (pattern.paletteId !== palette.id) {
    throw new Error('项目中的图纸与色卡标识不一致。')
  }
  if (pattern.cells.some((cell) => cell > palette.colors.length)) {
    throw new Error('图纸包含当前色卡中不存在的色号。')
  }
}

export function createProjectFile(
  patternValue: unknown,
  paletteValue: unknown,
): ProjectFile {
  const pattern = parsePatternDocument(patternValue)
  const palette = parsePaletteDocument(paletteValue)
  verifyCompatibility(pattern, palette)
  return {
    kind: 'pindou-project',
    version: PROJECT_FILE_VERSION,
    pattern,
    palette,
  }
}

export function parseProjectFile(value: unknown): ProjectFile {
  if (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'pindou-project'
  ) {
    if (!('version' in value) || value.version !== PROJECT_FILE_VERSION) {
      throw new Error('暂不支持这个项目文件版本。')
    }
    if (!('pattern' in value) || !('palette' in value)) {
      throw new Error('项目文件缺少图纸或色卡。')
    }
    return createProjectFile(value.pattern, value.palette)
  }

  const pattern = parsePatternDocument(value)
  if (pattern.paletteId !== genericDigitalPalette.id) {
    throw new Error('旧版项目未携带色卡，无法确认色号对应关系。')
  }
  return createProjectFile(pattern, genericDigitalPalette)
}
