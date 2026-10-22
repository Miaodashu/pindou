import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  calculateInventory,
  normalizeStock,
} from '@/domain/inventory/beanInventory'
import { genericDigitalPalette } from '@/domain/palette/genericPalette'
import { mard221Palette } from '@/domain/palette/mardPalette'
import { parsePaletteDocument } from '@/domain/palette/parsePalette'
import type { BeadPalette } from '@/domain/palette/types'
import { createPattern } from '@/domain/pattern/createPattern'
import type { CellEdit, PatternDocument } from '@/domain/pattern/types'
import {
  getPalette,
  getLatestPattern,
  getInventory,
  getTracingAsset,
  saveInventory,
  savePalette,
  savePattern,
  saveTracingAsset,
} from '@/infrastructure/persistence/patternRepository'

export type EditorTool = 'move' | 'pencil' | 'eraser' | 'picker' | 'select'

const MAX_HISTORY = 100

export const useEditorStore = defineStore('editor', () => {
  const pattern = ref<PatternDocument>(createPattern())
  const palette = ref<BeadPalette>(mard221Palette)
  const selectedColor = ref(8)
  const tool = ref<EditorTool>('pencil')
  const revision = ref(0)
  const isHydrated = ref(false)
  const persistenceStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const undoStack = ref<CellEdit[][]>([])
  const redoStack = ref<CellEdit[][]>([])
  const inventoryQuantities = ref<Record<string, number>>({})
  const tracingImageUrl = ref('')
  const tracingFileName = ref('')
  const tracingVisible = ref(false)
  const tracingOpacity = ref(0.52)
  const tracingOffsetX = ref(0)
  const tracingOffsetY = ref(0)
  const tracingScaleX = ref(1)
  const tracingScaleY = ref(1)
  let tracingImageBlob: Blob | undefined
  let saveTimer: number | undefined
  let tracingSaveTimer: number | undefined

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const filledCellCount = computed(
    () => pattern.value.cells.filter((cell) => cell > 0).length,
  )
  const colorUsage = computed(() => {
    const counts = new Map<number, number>()
    pattern.value.cells.forEach((cell) => {
      if (cell > 0) counts.set(cell, (counts.get(cell) ?? 0) + 1)
    })
    return [...counts.entries()]
      .map(([colorIndex, count]) => ({
        colorIndex,
        color: palette.value.colors[colorIndex - 1],
        count,
      }))
      .filter((entry) => entry.color !== undefined)
      .sort((first, second) => second.count - first.count)
  })
  const inventorySummary = computed(() =>
    calculateInventory(
      palette.value,
      inventoryQuantities.value,
      colorUsage.value.map(({ colorIndex, count }) => ({ colorIndex, count })),
    ),
  )

  function touch() {
    pattern.value.updatedAt = new Date().toISOString()
    revision.value += 1
    scheduleSave()
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer)
    persistenceStatus.value = 'saving'
    saveTimer = window.setTimeout(async () => {
      try {
        await savePattern(pattern.value)
        persistenceStatus.value = 'saved'
      } catch (error) {
        console.error('Failed to persist pattern', error)
        persistenceStatus.value = 'error'
      }
    }, 450)
  }

  function persistPalette(value: BeadPalette) {
    void savePalette(value).catch((error: unknown) => {
      console.error('Failed to persist palette', error)
      persistenceStatus.value = 'error'
    })
  }

  async function loadInventoryForPalette(paletteId: string) {
    const saved = await getInventory(paletteId)
    inventoryQuantities.value = saved?.quantities ?? {}
  }

  function setInventoryStock(colorId: string, value: unknown) {
    const stock = normalizeStock(value)
    inventoryQuantities.value = {
      ...inventoryQuantities.value,
      [colorId]: stock,
    }
    const paletteId = palette.value.id
    const quantities = { ...inventoryQuantities.value }
    void saveInventory({
      paletteId,
      quantities,
      updatedAt: new Date().toISOString(),
    }).catch((error: unknown) => {
      console.error('Failed to persist bean inventory', error)
      persistenceStatus.value = 'error'
    })
  }

  function revokeTracingUrl() {
    if (tracingImageUrl.value) URL.revokeObjectURL(tracingImageUrl.value)
    tracingImageUrl.value = ''
  }

  function resetTracing() {
    window.clearTimeout(tracingSaveTimer)
    revokeTracingUrl()
    tracingImageBlob = undefined
    tracingFileName.value = ''
    tracingVisible.value = false
    tracingOpacity.value = 0.52
    tracingOffsetX.value = 0
    tracingOffsetY.value = 0
    tracingScaleX.value = 1
    tracingScaleY.value = 1
  }

  async function loadTracingForPattern(patternId: string) {
    resetTracing()
    const saved = await getTracingAsset(patternId)
    if (!saved) return
    tracingImageBlob =
      saved.image instanceof Blob
        ? saved.image
        : new Blob([saved.image], {
            type: saved.mimeType || 'application/octet-stream',
          })
    tracingImageUrl.value = URL.createObjectURL(tracingImageBlob)
    tracingFileName.value = saved.fileName
    tracingVisible.value = saved.visible
    tracingOpacity.value = saved.opacity
    tracingOffsetX.value = saved.offsetX
    tracingOffsetY.value = saved.offsetY
    tracingScaleX.value = saved.scaleX ?? 1
    tracingScaleY.value = saved.scaleY ?? 1
  }

  function scheduleTracingSave() {
    if (!tracingImageBlob) return
    window.clearTimeout(tracingSaveTimer)
    tracingSaveTimer = window.setTimeout(() => {
      const blob = tracingImageBlob
      if (!blob) return
      void blob
        .arrayBuffer()
        .then((image) =>
          saveTracingAsset({
            patternId: pattern.value.id,
            image,
            mimeType: blob.type,
            fileName: tracingFileName.value,
            visible: tracingVisible.value,
            opacity: tracingOpacity.value,
            offsetX: tracingOffsetX.value,
            offsetY: tracingOffsetY.value,
            scaleX: tracingScaleX.value,
            scaleY: tracingScaleY.value,
            updatedAt: new Date().toISOString(),
          }),
        )
        .catch((error: unknown) => {
          console.error('Failed to persist tracing image', error)
          persistenceStatus.value = 'error'
        })
    }, 300)
  }

  function setTracingImage(file: File) {
    revokeTracingUrl()
    // Keep a plain Blob in memory; persistence converts it to ArrayBuffer
    // because WebKit rejects Blob/File values in some IndexedDB environments.
    tracingImageBlob = file.slice(0, file.size, file.type)
    tracingImageUrl.value = URL.createObjectURL(tracingImageBlob)
    tracingFileName.value = file.name
    tracingVisible.value = true
    tracingOffsetX.value = 0
    tracingOffsetY.value = 0
    tracingScaleX.value = 1
    tracingScaleY.value = 1
    scheduleTracingSave()
  }

  function updateTracingSettings(
    settings: Partial<{
      visible: boolean
      opacity: number
      offsetX: number
      offsetY: number
      scaleX: number
      scaleY: number
    }>,
  ) {
    if (settings.visible !== undefined) tracingVisible.value = settings.visible
    if (settings.opacity !== undefined) {
      tracingOpacity.value = Math.max(0.05, Math.min(1, settings.opacity))
    }
    if (settings.offsetX !== undefined) {
      tracingOffsetX.value = Math.max(-300, Math.min(300, settings.offsetX))
    }
    if (settings.offsetY !== undefined) {
      tracingOffsetY.value = Math.max(-300, Math.min(300, settings.offsetY))
    }
    if (settings.scaleX !== undefined) {
      tracingScaleX.value = Math.max(0.25, Math.min(4, settings.scaleX))
    }
    if (settings.scaleY !== undefined) {
      tracingScaleY.value = Math.max(0.25, Math.min(4, settings.scaleY))
    }
    scheduleTracingSave()
  }

  function applyEdits(edits: CellEdit[], recordHistory = true) {
    const normalized = edits.filter(
      (edit) =>
        edit.index >= 0 &&
        edit.index < pattern.value.cells.length &&
        edit.before !== edit.after &&
        pattern.value.cells[edit.index] === edit.before,
    )
    if (normalized.length === 0) return

    normalized.forEach((edit) => {
      pattern.value.cells[edit.index] = edit.after
    })

    if (recordHistory) {
      undoStack.value.push(normalized)
      if (undoStack.value.length > MAX_HISTORY) undoStack.value.shift()
      redoStack.value = []
    }
    touch()
  }

  function undo() {
    const edits = undoStack.value.pop()
    if (!edits) return
    edits.forEach((edit) => {
      pattern.value.cells[edit.index] = edit.before
    })
    redoStack.value.push(edits)
    touch()
  }

  function redo() {
    const edits = redoStack.value.pop()
    if (!edits) return
    edits.forEach((edit) => {
      pattern.value.cells[edit.index] = edit.after
    })
    undoStack.value.push(edits)
    touch()
  }

  function replaceCells(cells: number[]) {
    if (cells.length !== pattern.value.width * pattern.value.height) {
      throw new Error('转换结果与当前网格尺寸不一致。')
    }
    applyEdits(
      cells.map((after, index) => ({
        index,
        before: pattern.value.cells[index] ?? 0,
        after,
      })),
    )
  }

  function replaceColor(fromColorIndex: number, toColorIndex: number) {
    if (fromColorIndex === toColorIndex) return
    replaceCells(
      pattern.value.cells.map((cell) =>
        cell === fromColorIndex ? toColorIndex : cell,
      ),
    )
  }

  function mirrorPattern(axis: 'horizontal' | 'vertical') {
    const { width, height, cells } = pattern.value
    const mirrored = new Array<number>(cells.length).fill(0)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = y * width + x
        const targetX = axis === 'horizontal' ? width - 1 - x : x
        const targetY = axis === 'vertical' ? height - 1 - y : y
        mirrored[targetY * width + targetX] = cells[sourceIndex] ?? 0
      }
    }
    replaceCells(mirrored)
  }

  function newPattern(width: number, height: number) {
    pattern.value = createPattern(width, height, palette.value.id)
    undoStack.value = []
    redoStack.value = []
    resetTracing()
    touch()
  }

  function loadReconstruction(
    width: number,
    height: number,
    cells: number[],
    title: string,
  ) {
    if (cells.length !== width * height) {
      throw new Error('重建结果与网格尺寸不一致。')
    }
    const reconstructed = createPattern(width, height, palette.value.id)
    reconstructed.title = title.trim().slice(0, 120) || '高清重建图纸'
    reconstructed.cells = [...cells]
    pattern.value = reconstructed
    undoStack.value = []
    redoStack.value = []
    resetTracing()
    touch()
  }

  function rename(title: string) {
    const normalized = title.trimStart().slice(0, 120)
    pattern.value.title = normalized || '未命名图纸'
    touch()
  }

  async function hydrate() {
    if (isHydrated.value) return
    try {
      const saved = await getLatestPattern()
      if (saved?.paletteId === mard221Palette.id) {
        palette.value = mard221Palette
        pattern.value = saved
      } else if (saved?.paletteId === genericDigitalPalette.id) {
        palette.value = genericDigitalPalette
        pattern.value = saved
      } else if (saved) {
        const savedPalette = await getPalette(saved.paletteId)
        if (savedPalette) {
          palette.value = savedPalette
          pattern.value = saved
        }
      } else {
        await savePattern(pattern.value)
      }
      await loadInventoryForPalette(palette.value.id)
      await loadTracingForPattern(pattern.value.id)
    } catch (error) {
      console.error('Failed to restore pattern', error)
      persistenceStatus.value = 'error'
    } finally {
      isHydrated.value = true
      revision.value += 1
    }
  }

  function installPalette(value: unknown) {
    const installed = parsePaletteDocument(value)
    palette.value = installed
    selectedColor.value = 1
    pattern.value = createPattern(
      pattern.value.width,
      pattern.value.height,
      installed.id,
    )
    undoStack.value = []
    redoStack.value = []
    persistPalette(installed)
    void loadInventoryForPalette(installed.id)
    resetTracing()
    touch()
  }

  return {
    pattern,
    palette,
    selectedColor,
    tool,
    revision,
    isHydrated,
    persistenceStatus,
    canUndo,
    canRedo,
    filledCellCount,
    colorUsage,
    inventoryQuantities,
    inventorySummary,
    tracingImageUrl,
    tracingFileName,
    tracingVisible,
    tracingOpacity,
    tracingOffsetX,
    tracingOffsetY,
    tracingScaleX,
    tracingScaleY,
    hydrate,
    applyEdits,
    replaceCells,
    replaceColor,
    mirrorPattern,
    undo,
    redo,
    newPattern,
    loadReconstruction,
    rename,
    installPalette,
    setInventoryStock,
    setTracingImage,
    updateTracingSettings,
  }
})
