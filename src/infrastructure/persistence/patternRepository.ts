import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BeanInventoryRecord } from '@/domain/inventory/beanInventory'
import { parsePaletteDocument } from '@/domain/palette/parsePalette'
import type { BeadPalette } from '@/domain/palette/types'
import {
  parseDerivedPatternLink,
  safeParseDerivedPatternLink,
  type DerivedPatternLink,
} from '@/domain/project/derivedPatternLink'
import {
  parsePatternDocument,
  safeParsePatternDocument,
} from '@/domain/pattern/parsePattern'
import type { PatternDocument } from '@/domain/pattern/types'

export interface TracingAssetRecord {
  patternId: string
  image: ArrayBuffer | Blob
  mimeType?: string
  fileName: string
  visible: boolean
  opacity: number
  offsetX: number
  offsetY: number
  scaleX?: number
  scaleY?: number
  updatedAt: string
}

interface PindouDatabase extends DBSchema {
  patterns: {
    key: string
    value: PatternDocument
    indexes: { 'by-updated-at': string }
  }
  palettes: {
    key: string
    value: BeadPalette
  }
  inventories: {
    key: string
    value: BeanInventoryRecord
  }
  tracingAssets: {
    key: string
    value: TracingAssetRecord
  }
  derivedPatternLinks: {
    key: string
    value: DerivedPatternLink
  }
}

let databasePromise: Promise<IDBPDatabase<PindouDatabase>> | undefined

function getDatabase() {
  databasePromise ??= openDB<PindouDatabase>('pindou-studio', 5, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('patterns')) {
        const store = database.createObjectStore('patterns', { keyPath: 'id' })
        store.createIndex('by-updated-at', 'updatedAt')
      }
      if (!database.objectStoreNames.contains('palettes')) {
        database.createObjectStore('palettes', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('inventories')) {
        database.createObjectStore('inventories', { keyPath: 'paletteId' })
      }
      if (!database.objectStoreNames.contains('tracingAssets')) {
        database.createObjectStore('tracingAssets', { keyPath: 'patternId' })
      }
      if (!database.objectStoreNames.contains('derivedPatternLinks')) {
        database.createObjectStore('derivedPatternLinks', {
          keyPath: 'derivedPatternId',
        })
      }
    },
  })
  return databasePromise
}

export async function saveInventory(
  inventory: BeanInventoryRecord,
): Promise<void> {
  const database = await getDatabase()
  await database.put('inventories', inventory)
}

export async function getInventory(
  paletteId: string,
): Promise<BeanInventoryRecord | undefined> {
  const database = await getDatabase()
  return database.get('inventories', paletteId)
}

export async function saveTracingAsset(
  asset: TracingAssetRecord,
): Promise<void> {
  const database = await getDatabase()
  await database.put('tracingAssets', asset)
}

export async function getTracingAsset(
  patternId: string,
): Promise<TracingAssetRecord | undefined> {
  const database = await getDatabase()
  return database.get('tracingAssets', patternId)
}

export async function saveDerivedPatternLink(
  link: DerivedPatternLink,
): Promise<void> {
  const database = await getDatabase()
  await database.put('derivedPatternLinks', parseDerivedPatternLink(link))
}

export async function saveDerivedPattern(
  source: PatternDocument,
  derived: PatternDocument,
  link: DerivedPatternLink,
): Promise<void> {
  const parsedSource = parsePatternDocument(source)
  const parsedDerived = parsePatternDocument(derived)
  const parsedLink = parseDerivedPatternLink(link)
  const database = await getDatabase()
  const transaction = database.transaction(
    ['patterns', 'derivedPatternLinks'],
    'readwrite',
  )
  await Promise.all([
    transaction.objectStore('patterns').put(parsedSource),
    transaction.objectStore('patterns').put(parsedDerived),
    transaction.objectStore('derivedPatternLinks').put(parsedLink),
    transaction.done,
  ])
}

export async function getDerivedPatternLink(
  derivedPatternId: string,
): Promise<DerivedPatternLink | undefined> {
  const database = await getDatabase()
  const value = await database.get('derivedPatternLinks', derivedPatternId)
  return value ? safeParseDerivedPatternLink(value) : undefined
}

export async function deleteDerivedPatternLink(
  derivedPatternId: string,
): Promise<void> {
  const database = await getDatabase()
  await database.delete('derivedPatternLinks', derivedPatternId)
}

export async function savePattern(pattern: PatternDocument): Promise<void> {
  const parsed = parsePatternDocument(pattern)
  const database = await getDatabase()
  await database.put('patterns', parsed)
}

export async function getLatestPattern(): Promise<PatternDocument | undefined> {
  const database = await getDatabase()
  const transaction = database.transaction('patterns', 'readonly')
  const cursor = await transaction.store
    .index('by-updated-at')
    .openCursor(undefined, 'prev')
  await transaction.done
  if (!cursor) return undefined

  return safeParsePatternDocument(cursor.value)
}

export async function getPattern(
  patternId: string,
): Promise<PatternDocument | undefined> {
  const database = await getDatabase()
  const value = await database.get('patterns', patternId)
  if (!value) return undefined
  return safeParsePatternDocument(value)
}

export async function savePalette(palette: BeadPalette): Promise<void> {
  const parsed = parsePaletteDocument(palette)
  const database = await getDatabase()
  await database.put('palettes', parsed)
}

export async function getPalette(
  paletteId: string,
): Promise<BeadPalette | undefined> {
  const database = await getDatabase()
  const value = await database.get('palettes', paletteId)
  if (!value) return undefined
  try {
    return parsePaletteDocument(value)
  } catch {
    return undefined
  }
}
