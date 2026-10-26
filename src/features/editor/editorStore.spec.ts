import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const persistence = vi.hoisted(() => ({
  deleteDerivedPatternLink: vi.fn(async () => undefined),
  getDerivedPatternLink: vi.fn(async () => undefined),
  getInventory: vi.fn(async () => undefined),
  getLatestPattern: vi.fn(async () => undefined),
  getPalette: vi.fn(async () => undefined),
  getPattern: vi.fn(async () => undefined),
  getTracingAsset: vi.fn(async () => undefined),
  saveInventory: vi.fn(async () => undefined),
  saveDerivedPattern: vi.fn(async () => undefined),
  saveDerivedPatternLink: vi.fn(async () => undefined),
  savePalette: vi.fn(async () => undefined),
  savePattern: vi.fn(async () => undefined),
  saveTracingAsset: vi.fn(async () => undefined),
}))

vi.mock('@/infrastructure/persistence/patternRepository', () => persistence)

import { useEditorStore } from '@/features/editor/editorStore'

describe('editorStore persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('flushes a pending pattern save immediately and cancels the debounce', async () => {
    const store = useEditorStore()
    store.applyEdits([{ index: 0, before: 0, after: 1 }])

    expect(persistence.savePattern).not.toHaveBeenCalled()
    await store.flushPersistence()

    expect(persistence.savePattern).toHaveBeenCalledTimes(1)
    expect(persistence.savePattern).toHaveBeenCalledWith(
      expect.objectContaining({ cells: expect.arrayContaining([1]) }),
    )

    await vi.advanceTimersByTimeAsync(500)
    expect(persistence.savePattern).toHaveBeenCalledTimes(1)
  })

  it('migrates the legacy derived-pattern relationship before hydrating', async () => {
    window.localStorage.setItem(
      'pindou-derived-pattern-link-v1',
      JSON.stringify({
        derivedPatternId: 'small-pattern',
        sourcePatternId: 'large-pattern',
      }),
    )
    const store = useEditorStore()

    await store.hydrate()

    expect(persistence.saveDerivedPatternLink).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        derivedPatternId: 'small-pattern',
        sourcePatternId: 'large-pattern',
      }),
    )
    expect(
      window.localStorage.getItem('pindou-derived-pattern-link-v1'),
    ).toBeNull()
  })

  it('removes an orphaned derived-pattern relationship', async () => {
    persistence.getDerivedPatternLink.mockResolvedValueOnce({
      version: 1,
      derivedPatternId: 'small-pattern',
      sourcePatternId: 'missing-pattern',
      createdAt: '2026-10-26T00:00:00.000Z',
    })
    const store = useEditorStore()

    await expect(
      store.getDerivedSourceSnapshot('small-pattern'),
    ).resolves.toBeUndefined()

    expect(persistence.deleteDerivedPatternLink).toHaveBeenCalledWith(
      'small-pattern',
    )
  })

  it('keeps newer tracing settings dirty while an older save is in flight', async () => {
    let resolveFirstSave: (() => void) | undefined
    persistence.saveTracingAsset.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstSave = resolve
        }),
    )
    const store = useEditorStore()
    store.setTracingImage(
      new File(['image'], 'reference.png', { type: 'image/png' }),
    )

    const firstFlush = store.flushPersistence()
    await vi.waitFor(() => {
      expect(persistence.saveTracingAsset).toHaveBeenCalledTimes(1)
    })
    store.updateTracingSettings({ opacity: 0.7 })
    resolveFirstSave?.()
    await firstFlush
    await store.flushPersistence()

    expect(persistence.saveTracingAsset).toHaveBeenCalledTimes(2)
    expect(persistence.saveTracingAsset).toHaveBeenLastCalledWith(
      expect.objectContaining({ opacity: 0.7 }),
    )
  })

  it('surfaces a failed flush and keeps the persistence status in error', async () => {
    persistence.savePattern.mockRejectedValueOnce(new Error('quota exceeded'))
    const store = useEditorStore()
    store.applyEdits([{ index: 0, before: 0, after: 1 }])

    await expect(store.flushPersistence()).rejects.toThrow('本地草稿保存失败')

    expect(store.persistenceStatus).toBe('error')
  })

  it('persists a source, derived pattern, and their link atomically', async () => {
    const store = useEditorStore()

    await store.createDerivedPattern(1, 1, [1], '小图')

    expect(persistence.saveDerivedPattern).toHaveBeenCalledTimes(1)
    expect(persistence.saveDerivedPattern).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String) }),
      expect.objectContaining({ title: '小图', cells: [1] }),
      expect.objectContaining({
        version: 1,
        derivedPatternId: expect.any(String),
        sourcePatternId: expect.any(String),
      }),
    )
  })
})
