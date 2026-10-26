import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/features/converter/ImageImportPanel.vue'),
  'utf8',
)

function cssBlock(selector: string) {
  const start = source.indexOf(`${selector} {`)
  expect(start, `${selector} should exist`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf('}', start)
  return source.slice(start, end + 1)
}

describe('crop modal scrolling layout', () => {
  it('constrains the modal body and gives the settings panel its own scroll', () => {
    expect(cssBlock('.crop-modal')).toContain(
      'grid-template-rows: auto minmax(0, 1fr) auto;',
    )
    expect(cssBlock('.crop-modal')).toContain('height: 94vh;')
    expect(cssBlock('.crop-modal-body')).toContain('overflow: hidden;')
    expect(cssBlock('.crop-settings')).toContain('min-height: 0;')
    expect(cssBlock('.crop-settings')).toContain('overflow-y: auto;')
    expect(cssBlock('.crop-settings')).toContain(
      'overscroll-behavior: contain;',
    )
  })
})
