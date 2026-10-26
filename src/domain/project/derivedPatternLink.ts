import { z } from 'zod'

export const DERIVED_PATTERN_LINK_VERSION = 1 as const

export interface DerivedPatternLink {
  version: typeof DERIVED_PATTERN_LINK_VERSION
  derivedPatternId: string
  sourcePatternId: string
  createdAt: string
}

const derivedPatternLinkSchema = z.object({
  version: z.literal(DERIVED_PATTERN_LINK_VERSION),
  derivedPatternId: z.string().min(1),
  sourcePatternId: z.string().min(1),
  createdAt: z.iso.datetime(),
})

export function createDerivedPatternLink(
  derivedPatternId: string,
  sourcePatternId: string,
): DerivedPatternLink {
  return derivedPatternLinkSchema.parse({
    version: DERIVED_PATTERN_LINK_VERSION,
    derivedPatternId,
    sourcePatternId,
    createdAt: new Date().toISOString(),
  })
}

export function parseDerivedPatternLink(value: unknown) {
  return derivedPatternLinkSchema.parse(value)
}

export function safeParseDerivedPatternLink(value: unknown) {
  const parsed = derivedPatternLinkSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

const legacyDerivedPatternLinkSchema = z.object({
  derivedPatternId: z.string().min(1),
  sourcePatternId: z.string().min(1),
})

export function migrateLegacyDerivedPatternLink(value: unknown) {
  const parsed = legacyDerivedPatternLinkSchema.safeParse(value)
  if (!parsed.success) return undefined
  return createDerivedPatternLink(
    parsed.data.derivedPatternId,
    parsed.data.sourcePatternId,
  )
}
