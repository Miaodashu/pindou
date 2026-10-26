import { describe, expect, it } from 'vitest'

import {
  createDerivedPatternLink,
  migrateLegacyDerivedPatternLink,
  safeParseDerivedPatternLink,
} from '@/domain/project/derivedPatternLink'

describe('derived pattern links', () => {
  it('creates a versioned relationship between a source and derived pattern', () => {
    expect(
      createDerivedPatternLink('small-pattern', 'large-pattern'),
    ).toMatchObject({
      version: 1,
      derivedPatternId: 'small-pattern',
      sourcePatternId: 'large-pattern',
    })
  })

  it('rejects unversioned persisted relationships', () => {
    expect(
      safeParseDerivedPatternLink({
        derivedPatternId: 'small-pattern',
        sourcePatternId: 'large-pattern',
      }),
    ).toBeUndefined()
  })

  it('migrates a valid legacy relationship to the current version', () => {
    expect(
      migrateLegacyDerivedPatternLink({
        derivedPatternId: 'small-pattern',
        sourcePatternId: 'large-pattern',
      }),
    ).toMatchObject({
      version: 1,
      derivedPatternId: 'small-pattern',
      sourcePatternId: 'large-pattern',
    })
  })
})
