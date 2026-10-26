<script setup lang="ts">
import {
  ArrowLeftRight,
  Eye,
  EyeOff,
  Eraser,
  Hand,
  Minus,
  Minimize2,
  PaintBucket,
  Palette,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  RotateCcw,
  Scan,
  Trash2,
  Undo2,
  X,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'

import type { SelectionMode } from '@/core/selection'
import { downscalePattern } from '@/core/downscalePattern'
import type { PatternDocument } from '@/domain/pattern/types'
import ImageImportPanel from '@/features/converter/ImageImportPanel.vue'
import ColorReplaceDialog from '@/features/editor/ColorReplaceDialog.vue'
import PatternCanvas from '@/features/editor/PatternCanvas.vue'
import { useEditorStore, type EditorTool } from '@/features/editor/editorStore'
import PalettePanel from '@/features/palette/PalettePanel.vue'
import TracingImagePanel from '@/features/tracing/TracingImagePanel.vue'

type PatternViewMode = 'construction' | 'color-block'

interface PatternCanvasApi {
  exportPng: (
    viewMode: PatternViewMode,
    showGrid?: boolean,
    showGuides?: boolean,
  ) => Promise<{ blob: Blob; cellSize: number }>
}

const store = useEditorStore()
const {
  pattern,
  palette,
  selectedColor,
  tool,
  revision,
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
} = storeToRefs(store)

const canvas = ref<PatternCanvasApi>()
const canvasScroll = ref<HTMLDivElement>()
const editorOpen = ref(false)
const paletteOpen = ref(false)
const zoom = ref(1)
const viewMode = ref<PatternViewMode>('color-block')
const showGrid = ref(true)
const showGuides = ref(false)
const selection = ref<number[]>([])
const selectionMode = ref<SelectionMode>('rectangle')
const newWidth = ref(29)
const newHeight = ref(29)
const replaceFrom = ref<number>()
const toast = ref('')
const hiddenColorIndexes = ref<number[]>([])
const downscaleWidth = ref(20)
const downscaleHeight = ref(20)
const largePatternBackup = ref<PatternDocument>()
const downscaling = ref(false)
let temporaryTool: EditorTool | undefined

const persistenceLabel = computed(() => {
  const labels = {
    idle: '本地草稿',
    saving: '保存中…',
    saved: '已自动保存',
    error: '保存失败',
  }
  return labels[persistenceStatus.value]
})

const tools: Array<{
  id: EditorTool
  label: string
  shortcut: string
  icon: Component
}> = [
  { id: 'move', label: '移动', shortcut: 'H', icon: Hand },
  { id: 'pencil', label: '画笔', shortcut: 'P', icon: Pencil },
  { id: 'eraser', label: '橡皮', shortcut: 'E', icon: Eraser },
  { id: 'picker', label: '取色', shortcut: 'I', icon: Pipette },
  { id: 'select', label: '选区', shortcut: 'S', icon: Scan },
]

const viewModes: Array<{ id: PatternViewMode; label: string }> = [
  { id: 'color-block', label: '色块图' },
  { id: 'construction', label: '施工图' },
]

const editorUsage = computed(() => {
  const blankCount = pattern.value.cells.filter((cell) => cell === 0).length
  return [
    ...colorUsage.value,
    ...(blankCount > 0
      ? [{ colorIndex: 0, color: undefined, count: blankCount }]
      : []),
  ]
})
const activeReplaceEntry = computed(() =>
  editorUsage.value.find((entry) => entry.colorIndex === replaceFrom.value),
)
const usedColorIndexes = computed(() =>
  colorUsage.value.map((entry) => entry.colorIndex),
)

function notify(message: string) {
  toast.value = message
  window.setTimeout(() => {
    if (toast.value === message) toast.value = ''
  }, 3200)
}

function applyGenerated(payload: {
  width: number
  height: number
  cells: number[]
}) {
  if (
    pattern.value.width !== payload.width ||
    pattern.value.height !== payload.height
  ) {
    store.newPattern(payload.width, payload.height)
  }
  store.replaceCells(payload.cells)
  selection.value = []
  notify('生成结果已应用，可继续精修')
}

async function openEditor() {
  editorOpen.value = true
  paletteOpen.value = false
  tool.value = 'move'
  await nextTick()
  canvasScroll.value?.scrollTo({ left: 0, top: 0 })
}

function closeEditor() {
  editorOpen.value = false
  paletteOpen.value = false
  selection.value = []
}

function createNewPattern() {
  const width = Math.max(1, Math.min(300, Math.floor(newWidth.value)))
  const height = Math.max(1, Math.min(300, Math.floor(newHeight.value)))
  if (
    filledCellCount.value > 0 &&
    !window.confirm('新建空白图纸会替换当前画布，是否继续？')
  ) {
    return
  }
  store.newPattern(width, height)
  selection.value = []
  void openEditor()
  notify(`已创建 ${width} × ${height} 空白图纸`)
}

function safeFileName(extension: string) {
  const base =
    pattern.value.title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'pindou-pattern'
  return `${base}.${extension}`
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

async function exportPng(mode: PatternViewMode) {
  if (!canvas.value) await nextTick()
  if (!canvas.value) return
  const suffix = mode === 'construction' ? '施工图' : '色块图'
  const includeGrid =
    mode === 'construction' || (mode === 'color-block' && showGrid.value)
  const result = await canvas.value.exportPng(
    mode,
    includeGrid,
    showGuides.value,
  )
  download(result.blob, safeFileName(`${suffix}.png`))
  notify(
    result.cellSize < 36
      ? `${suffix} PNG 已按 ${result.cellSize}px/格安全导出`
      : `${suffix} PNG 已导出`,
  )
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function exportMaterialsCsv() {
  const rows = inventorySummary.value.rows.filter(
    (row) => row.used > 0 || row.stock > 0,
  )
  const header = ['色号', '名称', 'HEX', '使用', '库存', '剩余', '缺少']
  const body = rows.map((row) =>
    [
      row.color.code,
      row.color.name,
      row.color.hex,
      row.used,
      row.stock,
      row.remaining,
      row.shortage,
    ]
      .map(csvCell)
      .join(','),
  )
  download(
    new Blob([`\uFEFF${[header.join(','), ...body].join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    }),
    safeFileName('用量清单.csv'),
  )
  notify(`已导出 ${rows.length} 个色号的用量清单`)
}

function installPalette(value: unknown) {
  if (
    filledCellCount.value > 0 &&
    !window.confirm('更换色卡会新建一张空白图纸，是否继续？')
  ) {
    return
  }
  store.installPalette(value)
  selection.value = []
  notify(`已安装色卡：${palette.value.name}`)
}

function selectTool(nextTool: EditorTool) {
  tool.value = nextTool
}

function selectPaletteColor(colorIndex: number) {
  selectedColor.value = colorIndex
  hiddenColorIndexes.value = hiddenColorIndexes.value.filter(
    (index) => index !== colorIndex,
  )
  tool.value = 'pencil'
  paletteOpen.value = false
}

function toggleColorVisibility(colorIndex: number) {
  hiddenColorIndexes.value = hiddenColorIndexes.value.includes(colorIndex)
    ? hiddenColorIndexes.value.filter((index) => index !== colorIndex)
    : [...hiddenColorIndexes.value, colorIndex]
}

function isolateColor(colorIndex: number) {
  hiddenColorIndexes.value = colorUsage.value
    .map((entry) => entry.colorIndex)
    .filter((index) => index !== colorIndex)
}

function restoreAllColors() {
  hiddenColorIndexes.value = []
}

function fitDownscaleRatio() {
  const width = Math.max(
    1,
    Math.min(pattern.value.width, Math.round(downscaleWidth.value)),
  )
  downscaleWidth.value = width
  downscaleHeight.value = Math.max(
    1,
    Math.round((width / pattern.value.width) * pattern.value.height),
  )
}

async function createSmallerPattern() {
  if (downscaling.value) return
  const width = Math.max(
    1,
    Math.min(pattern.value.width, Math.round(downscaleWidth.value)),
  )
  const height = Math.max(
    1,
    Math.min(pattern.value.height, Math.round(downscaleHeight.value)),
  )
  if (width === pattern.value.width && height === pattern.value.height) {
    notify('请输入小于当前图纸的目标尺寸')
    return
  }
  if (
    !window.confirm(
      `将当前 ${pattern.value.width} × ${pattern.value.height} 精修图生成 ${width} × ${height} 小尺寸副本。大图原稿会保留，是否继续？`,
    )
  ) {
    return
  }
  downscaling.value = true
  try {
    const cells = downscalePattern(
      pattern.value.cells,
      pattern.value.width,
      pattern.value.height,
      width,
      height,
      { preserveDetails: true },
    )
    const sourceSnapshot = await store.createDerivedPattern(
      width,
      height,
      cells,
      `${pattern.value.title} · 小尺寸 ${width}×${height}`,
    )
    largePatternBackup.value = sourceSnapshot
    hiddenColorIndexes.value = []
    selection.value = []
    zoom.value = 1
    notify(`已生成 ${width} × ${height} 小尺寸副本，大图原稿已保留`)
  } catch (error) {
    console.error('Failed to create a smaller pattern', error)
    notify('生成小尺寸副本失败，请稍后重试')
  } finally {
    downscaling.value = false
  }
}

async function restoreLargePattern() {
  if (downscaling.value) return
  const backup = largePatternBackup.value
  if (!backup) return
  if (!window.confirm('恢复大图原稿会离开当前小尺寸副本，是否继续？')) return
  downscaling.value = true
  try {
    await store.restorePatternSnapshot(backup)
    largePatternBackup.value = undefined
    hiddenColorIndexes.value = []
    selection.value = []
    notify(`已恢复 ${backup.width} × ${backup.height} 大图原稿`)
  } catch (error) {
    console.error('Failed to restore the large pattern', error)
    notify('恢复大图原稿失败，请稍后重试')
  } finally {
    downscaling.value = false
  }
}

function pickColor(colorIndex: number) {
  const color = palette.value.colors[colorIndex - 1]
  if (!color) return
  selectedColor.value = colorIndex
  tool.value = 'pencil'
  notify(`已吸取 ${color.code}，已切换到画笔`)
}

function fillSelection() {
  if (selection.value.length === 0) return
  store.applyEdits(
    selection.value.map((index) => ({
      index,
      before: pattern.value.cells[index] ?? 0,
      after: selectedColor.value,
    })),
  )
  const color = palette.value.colors[selectedColor.value - 1]
  notify(`已用 ${color?.code ?? '当前颜色'} 填充 ${selection.value.length} 格`)
}

function eraseSelection() {
  if (selection.value.length === 0) return
  const changed = selection.value.filter(
    (index) => pattern.value.cells[index] !== 0,
  )
  store.applyEdits(
    changed.map((index) => ({
      index,
      before: pattern.value.cells[index] ?? 0,
      after: 0,
    })),
  )
  notify(`已清空选区中的 ${changed.length} 格`)
}

function clearSelection() {
  selection.value = []
}

function replaceColor(payload: {
  toColorIndex: number
  selectionOnly: boolean
}) {
  const from = replaceFrom.value
  if (from === undefined || from === payload.toColorIndex) return
  const fromLabel =
    from === 0 ? '透明背景' : (palette.value.colors[from - 1]?.code ?? '原颜色')
  const toLabel =
    payload.toColorIndex === 0
      ? '透明背景'
      : (palette.value.colors[payload.toColorIndex - 1]?.code ?? '新颜色')

  if (payload.selectionOnly) {
    const indexes = selection.value.filter(
      (index) => pattern.value.cells[index] === from,
    )
    store.applyEdits(
      indexes.map((index) => ({
        index,
        before: from,
        after: payload.toColorIndex,
      })),
    )
  } else {
    store.replaceColor(from, payload.toColorIndex)
  }
  replaceFrom.value = undefined
  notify(`已将 ${fromLabel} 替换为 ${toLabel} · 可撤销`)
}

function panCanvas(delta: { x: number; y: number }) {
  canvasScroll.value?.scrollBy(delta.x, delta.y)
}

function mirrorPattern(axis: 'horizontal' | 'vertical') {
  store.mirrorPattern(axis)
  selection.value = []
  notify(axis === 'horizontal' ? '图纸已水平翻转' : '图纸已垂直翻转')
}

function clearCanvas() {
  if (filledCellCount.value === 0) return
  if (
    !window.confirm(
      `确定要清空画布中的 ${filledCellCount.value} 颗豆子吗？此操作可撤销。`,
    )
  ) {
    return
  }
  const cleared = store.clearPattern()
  selection.value = []
  notify(`已清空 ${cleared} 格 · 可撤销`)
}

function isFormTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  )
}

function handleKeydown(event: KeyboardEvent) {
  if (!editorOpen.value || isFormTarget(event.target)) return
  const key = event.key.toLowerCase()
  if (event.code === 'Space' && !temporaryTool) {
    event.preventDefault()
    temporaryTool = tool.value
    tool.value = 'move'
    return
  }
  if ((event.metaKey || event.ctrlKey) && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) store.redo()
    else store.undo()
  } else if (key === 'h') selectTool('move')
  else if (key === 'p') selectTool('pencil')
  else if (key === 'e') selectTool('eraser')
  else if (key === 'f' && selection.value.length > 0) fillSelection()
  else if (key === 'i') selectTool('picker')
  else if (key === 's') selectTool('select')
  else if (
    (event.key === 'Backspace' || event.key === 'Delete') &&
    selection.value.length
  ) {
    event.preventDefault()
    eraseSelection()
  } else if (event.key === 'Escape') {
    if (paletteOpen.value) paletteOpen.value = false
    else if (selection.value.length) clearSelection()
    else closeEditor()
  }
}

function handleKeyup(event: KeyboardEvent) {
  if (event.code !== 'Space' || !temporaryTool) return
  tool.value = temporaryTool
  temporaryTool = undefined
}

watch(() => [pattern.value.width, pattern.value.height], clearSelection)
watch(
  () => pattern.value.id,
  async (patternId) => {
    hiddenColorIndexes.value = []
    downscaleWidth.value = Math.max(1, Math.round(pattern.value.width * 0.7))
    downscaleHeight.value = Math.max(1, Math.round(pattern.value.height * 0.7))
    largePatternBackup.value = undefined
    const snapshot = await store.getDerivedSourceSnapshot(patternId)
    if (pattern.value.id !== patternId) return
    if (snapshot) largePatternBackup.value = snapshot
  },
  { immediate: true },
)
watch(editorOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  store.hydrate()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="editor-page" :aria-busy="!store.isHydrated">
    <header class="editor-commandbar">
      <div class="document-title">
        <input
          :value="pattern.title"
          aria-label="图纸名称"
          maxlength="120"
          @change="store.rename(($event.target as HTMLInputElement).value)"
        />
        <span
          >{{ pattern.width }} × {{ pattern.height }} ·
          {{ persistenceLabel }}</span
        >
      </div>
      <div class="command-group">
        <button type="button" @click="openEditor">编辑当前图纸</button>
        <button type="button" @click="exportPng('construction')">
          导出施工图
        </button>
        <button type="button" @click="exportMaterialsCsv">导出用量 CSV</button>
        <button class="primary" type="button" @click="exportPng('color-block')">
          导出色块图
        </button>
      </div>
    </header>

    <ImageImportPanel
      :pattern="pattern"
      :palette="palette"
      :inventory-quantities="inventoryQuantities"
      @converted="applyGenerated"
      @open-editor="openEditor"
    />

    <Teleport to="body">
      <section
        v-show="editorOpen"
        class="editor-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="全屏图纸精修"
      >
        <header class="editor-toolbar">
          <div class="editor-title">
            <strong>图纸精修</strong>
            <span
              >{{ pattern.width }} × {{ pattern.height }} ·
              {{ persistenceLabel }}</span
            >
          </div>

          <div class="tool-group" aria-label="绘图工具">
            <button
              v-for="item in tools"
              :key="item.id"
              type="button"
              :class="{ active: tool === item.id }"
              :aria-pressed="tool === item.id"
              :title="`${item.label} (${item.shortcut})`"
              @click="selectTool(item.id)"
            >
              <component :is="item.icon" :size="17" aria-hidden="true" />
              <span>{{ item.label }}</span>
              <kbd>{{ item.shortcut }}</kbd>
            </button>
          </div>

          <div class="tool-group history-tools">
            <button
              type="button"
              :disabled="!canUndo"
              title="撤销 ⌘Z"
              @click="store.undo"
            >
              <Undo2 :size="17" aria-hidden="true" />
            </button>
            <button
              type="button"
              :disabled="!canRedo"
              title="重做 ⇧⌘Z"
              @click="store.redo"
            >
              <Redo2 :size="17" aria-hidden="true" />
            </button>
          </div>

          <div class="current-color-wrap">
            <button
              class="current-color"
              type="button"
              aria-haspopup="dialog"
              :aria-expanded="paletteOpen"
              @click="paletteOpen = !paletteOpen"
            >
              <Palette :size="17" aria-hidden="true" />
              <span
                class="current-swatch"
                :style="{
                  backgroundColor: palette.colors[selectedColor - 1]?.hex,
                }"
              />
              <strong>{{ palette.colors[selectedColor - 1]?.code }}</strong>
            </button>
            <div v-if="paletteOpen" class="palette-popover">
              <PalettePanel
                :model-value="selectedColor"
                :palette="palette"
                @update:model-value="selectPaletteColor"
                @install="installPalette"
              />
            </div>
          </div>

          <button class="done-button" type="button" @click="closeEditor">
            完成
          </button>
          <button
            class="close-button"
            type="button"
            aria-label="关闭精修"
            @click="closeEditor"
          >
            <X :size="20" aria-hidden="true" />
          </button>
        </header>

        <div
          v-if="tool === 'select' || selection.length > 0"
          class="selection-bar"
          aria-label="选区快捷操作"
        >
          <div class="selection-modes">
            <button
              type="button"
              :class="{ active: selectionMode === 'rectangle' }"
              @click="selectionMode = 'rectangle'"
            >
              矩形
            </button>
            <button
              type="button"
              :class="{ active: selectionMode === 'lasso' }"
              @click="selectionMode = 'lasso'"
            >
              套索
            </button>
          </div>
          <strong>{{
            selection.length
              ? `已选择 ${selection.length} 格`
              : '在画布上拖动创建选区'
          }}</strong>
          <button
            type="button"
            :disabled="!selection.length"
            @click="fillSelection"
          >
            <PaintBucket :size="16" aria-hidden="true" />填充选区
          </button>
          <button
            type="button"
            :disabled="!selection.length"
            @click="eraseSelection"
          >
            <Trash2 :size="16" aria-hidden="true" />清空豆子
          </button>
          <button
            type="button"
            :disabled="!selection.length"
            @click="clearSelection"
          >
            取消选区
          </button>
        </div>

        <div class="editor-body">
          <main class="canvas-pane">
            <div class="canvas-viewbar">
              <div class="view-switcher" aria-label="图纸显示模式">
                <button
                  v-for="mode in viewModes"
                  :key="mode.id"
                  type="button"
                  :class="{ active: viewMode === mode.id }"
                  :aria-pressed="viewMode === mode.id"
                  @click="viewMode = mode.id"
                >
                  {{ mode.label }}
                </button>
                <button
                  type="button"
                  :class="{ active: showGrid }"
                  :aria-pressed="showGrid"
                  @click="showGrid = !showGrid"
                >
                  网格
                </button>
                <button
                  type="button"
                  :class="{ active: showGuides }"
                  :aria-pressed="showGuides"
                  @click="showGuides = !showGuides"
                >
                  参考线
                </button>
              </div>
              <div class="canvas-actions">
                <button
                  class="danger-action"
                  type="button"
                  :disabled="filledCellCount === 0"
                  @click="clearCanvas"
                >
                  <Trash2 :size="15" aria-hidden="true" />一键清空画布
                </button>
                <button type="button" @click="mirrorPattern('horizontal')">
                  水平翻转
                </button>
                <button type="button" @click="mirrorPattern('vertical')">
                  垂直翻转
                </button>
                <div class="zoom-control">
                  <button
                    type="button"
                    aria-label="缩小"
                    @click="zoom = Math.max(0.4, zoom - 0.2)"
                  >
                    <Minus :size="16" aria-hidden="true" />
                  </button>
                  <span>{{ Math.round(zoom * 100) }}%</span>
                  <button
                    type="button"
                    aria-label="放大"
                    @click="zoom = Math.min(3, zoom + 0.2)"
                  >
                    <Plus :size="16" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <div ref="canvasScroll" class="canvas-scroll">
              <PatternCanvas
                ref="canvas"
                :pattern="pattern"
                :palette="palette"
                :revision="revision"
                :selected-color="selectedColor"
                :tool="tool"
                :zoom="zoom"
                :view-mode="viewMode"
                :show-grid="showGrid"
                :show-guides="showGuides"
                :selection="selection"
                :selection-mode="selectionMode"
                :hidden-color-indexes="hiddenColorIndexes"
                :tracing-image-url="tracingImageUrl"
                :tracing-visible="tracingVisible"
                :tracing-opacity="tracingOpacity"
                :tracing-offset-x="tracingOffsetX"
                :tracing-offset-y="tracingOffsetY"
                @apply="store.applyEdits"
                @pick-color="pickColor"
                @selection-change="selection = $event"
                @pan="panCanvas"
              />
            </div>
          </main>

          <aside class="editor-sidebar">
            <section class="side-section usage-section summary-panel">
              <div class="side-heading">
                <div>
                  <p>色号用量</p>
                  <h2>
                    {{ filledCellCount }} 颗 · {{ colorUsage.length }} 种颜色
                  </h2>
                </div>
                <div class="usage-heading-actions">
                  <button
                    v-if="hiddenColorIndexes.length"
                    type="button"
                    @click="restoreAllColors"
                  >
                    <Eye :size="14" aria-hidden="true" />显示全部
                  </button>
                  <RouterLink to="/inventory">豆仓</RouterLink>
                </div>
              </div>
              <div class="usage-list">
                <div
                  v-for="entry in editorUsage"
                  :key="entry.colorIndex"
                  class="usage-row"
                  :class="{
                    hidden: hiddenColorIndexes.includes(entry.colorIndex),
                  }"
                >
                  <button
                    type="button"
                    class="usage-main"
                    :disabled="entry.colorIndex === 0"
                    @click="
                      entry.colorIndex > 0 && (selectedColor = entry.colorIndex)
                    "
                  >
                    <span
                      class="usage-swatch"
                      :class="{ transparent: entry.colorIndex === 0 }"
                      :style="
                        entry.color
                          ? { backgroundColor: entry.color.hex }
                          : undefined
                      "
                    />
                    <span>
                      <strong>{{ entry.color?.code ?? '透明背景' }}</strong>
                      <small>{{ entry.color?.name ?? '未放置豆子' }}</small>
                    </span>
                    <b>{{ entry.count }}</b>
                  </button>
                  <button
                    v-if="entry.colorIndex > 0"
                    type="button"
                    class="visibility-button"
                    :aria-label="
                      hiddenColorIndexes.includes(entry.colorIndex)
                        ? `显示 ${entry.color?.code}`
                        : `隐藏 ${entry.color?.code}`
                    "
                    :title="
                      hiddenColorIndexes.includes(entry.colorIndex)
                        ? '显示当前颜色'
                        : '隐藏当前颜色'
                    "
                    @click="toggleColorVisibility(entry.colorIndex)"
                  >
                    <Eye
                      v-if="hiddenColorIndexes.includes(entry.colorIndex)"
                      :size="15"
                      aria-hidden="true"
                    />
                    <EyeOff v-else :size="15" aria-hidden="true" />
                  </button>
                  <button
                    v-if="entry.colorIndex > 0"
                    type="button"
                    class="visibility-button"
                    :aria-label="`只显示 ${entry.color?.code}`"
                    title="隐藏其他颜色，只看当前色号"
                    @click="isolateColor(entry.colorIndex)"
                  >
                    <Eye :size="15" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="replace-button"
                    :aria-label="`替换 ${entry.color?.code ?? '透明背景'}`"
                    @click="replaceFrom = entry.colorIndex"
                  >
                    <ArrowLeftRight :size="16" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </section>

            <details class="side-section downscale-section">
              <summary>大图转小图</summary>
              <div class="downscale-panel">
                <p>
                  建议先在大尺寸图纸中完成轮廓和色号精修，再生成小尺寸副本。系统会按区域占比采样，并增强边界细节；大图原稿不会被删除。
                </p>
                <div class="downscale-fields">
                  <input
                    v-model.number="downscaleWidth"
                    type="number"
                    min="1"
                    :max="pattern.width"
                    aria-label="小尺寸图纸宽度"
                  />
                  <span>×</span>
                  <input
                    v-model.number="downscaleHeight"
                    type="number"
                    min="1"
                    :max="pattern.height"
                    aria-label="小尺寸图纸高度"
                  />
                  <button
                    type="button"
                    title="按当前图纸比例计算高度"
                    @click="fitDownscaleRatio"
                  >
                    等比
                  </button>
                </div>
                <button
                  type="button"
                  class="create-small-pattern"
                  :disabled="downscaling"
                  @click="createSmallerPattern"
                >
                  <Minimize2 :size="15" aria-hidden="true" />{{
                    downscaling ? '处理中…' : '生成小尺寸副本'
                  }}
                </button>
                <button
                  v-if="largePatternBackup"
                  type="button"
                  class="restore-large-pattern"
                  :disabled="downscaling"
                  @click="restoreLargePattern"
                >
                  <RotateCcw :size="15" aria-hidden="true" />恢复大图原稿
                </button>
              </div>
            </details>

            <details class="side-section" open>
              <summary>临摹垫图</summary>
              <TracingImagePanel
                :image-url="tracingImageUrl"
                :file-name="tracingFileName"
                :visible="tracingVisible"
                :opacity="tracingOpacity"
                :offset-x="tracingOffsetX"
                :offset-y="tracingOffsetY"
                @upload="store.setTracingImage"
                @settings-change="store.updateTracingSettings"
              />
            </details>

            <details class="side-section">
              <summary>新建空白图纸</summary>
              <div class="new-pattern-fields">
                <input
                  v-model.number="newWidth"
                  aria-label="新图纸宽度"
                  type="number"
                  min="1"
                  max="300"
                />
                <span>×</span>
                <input
                  v-model.number="newHeight"
                  aria-label="新图纸高度"
                  type="number"
                  min="1"
                  max="300"
                />
                <button type="button" @click="createNewPattern">创建</button>
              </div>
            </details>
          </aside>
        </div>
      </section>
    </Teleport>

    <ColorReplaceDialog
      :open="replaceFrom !== undefined"
      :from-color-index="replaceFrom ?? 0"
      :count="activeReplaceEntry?.count ?? 0"
      :palette="palette"
      :used-color-indexes="usedColorIndexes"
      :inventory-quantities="inventoryQuantities"
      :selection-count="selection.length"
      @close="replaceFrom = undefined"
      @replace="replaceColor"
    />

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.editor-page {
  min-height: calc(100vh - 78px);
  background:
    radial-gradient(circle at 20% 0%, rgb(232 180 184 / 18%), transparent 34%),
    #f7f0f0;
}

.editor-commandbar,
.editor-toolbar,
.tool-group,
.selection-bar,
.canvas-viewbar,
.view-switcher,
.canvas-actions,
.zoom-control,
.side-heading,
.new-pattern-fields {
  display: flex;
  align-items: center;
}

.editor-commandbar {
  position: sticky;
  z-index: 12;
  top: 0;
  min-height: 66px;
  gap: 16px;
  padding: 10px clamp(20px, 3vw, 48px);
  border-bottom: 1px solid var(--border);
  background: rgb(255 250 250 / 94%);
  box-shadow: 0 7px 24px rgb(77 45 50 / 7%);
  backdrop-filter: blur(16px);
}

.document-title {
  display: grid;
  min-width: 220px;
  margin-right: auto;
}

.document-title input {
  padding: 0;
  border: 0;
  color: var(--text);
  background: transparent;
  font-size: 0.96rem;
  font-weight: 800;
  outline: none;
}

.document-title span,
.editor-title span {
  color: var(--text-muted);
  font-size: 0.66rem;
}

.command-group {
  display: flex;
  gap: 7px;
}

.command-group button,
.editor-toolbar button,
.selection-bar button,
.canvas-viewbar button,
.new-pattern-fields button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 8px 11px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  background: white;
  font-size: 0.73rem;
  font-weight: 800;
  cursor: pointer;
}

.command-group button.primary,
.editor-toolbar .done-button {
  border-color: var(--rose-strong);
  color: white;
  background: var(--rose-strong);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.editor-overlay {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  background: #f4eeee;
}

.editor-toolbar {
  position: relative;
  z-index: 3;
  gap: 10px;
  min-height: 70px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: rgb(255 253 253 / 96%);
  box-shadow: 0 5px 22px rgb(52 37 40 / 8%);
}

.editor-title {
  display: grid;
  min-width: 150px;
}

.tool-group {
  gap: 5px;
}

.tool-group button.active,
.view-switcher button.active,
.selection-modes button.active {
  border-color: var(--rose-strong);
  color: var(--rose-strong);
  background: var(--rose-pale);
}

kbd {
  color: var(--text-muted);
  font-size: 0.58rem;
}

.history-tools {
  padding-left: 9px;
  border-left: 1px solid var(--border);
}

.current-color-wrap {
  position: relative;
  margin-left: auto;
}

.editor-toolbar .current-color {
  min-width: 112px;
  border-color: #d29aa0;
}

.current-swatch {
  width: 25px;
  height: 25px;
  border: 1px solid rgb(40 35 32 / 18%);
  border-radius: 7px;
}

.palette-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: min(420px, 88vw);
  max-height: calc(100vh - 100px);
  overflow: auto;
  border-radius: 20px;
  box-shadow: 0 24px 70px rgb(51 34 36 / 22%);
}

.close-button {
  width: 38px;
  padding: 0 !important;
}

.selection-bar {
  position: relative;
  z-index: 2;
  gap: 8px;
  padding: 8px 18px;
  border-bottom: 1px solid #e4c8c9;
  background: #fff7f4;
}

.selection-bar strong {
  margin-right: auto;
  font-size: 0.76rem;
}

.selection-modes {
  display: flex;
  gap: 4px;
  padding-right: 8px;
  border-right: 1px solid var(--border);
}

.editor-body {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 12px;
  padding: 12px;
}

.canvas-pane {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #ded8d1;
  box-shadow: var(--shadow-small);
}

.canvas-viewbar {
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  background: #fffdfd;
}

.view-switcher,
.canvas-actions,
.zoom-control {
  gap: 5px;
}

.canvas-viewbar button {
  min-height: 32px;
  padding: 6px 9px;
}

.canvas-actions .danger-action {
  border-color: #dcaaa5;
  color: #a43b32;
  background: #fff5f3;
}

.zoom-control {
  margin-left: 6px;
  padding-left: 6px;
  border-left: 1px solid var(--border);
}

.zoom-control span {
  min-width: 48px;
  color: var(--text-muted);
  font-size: 0.7rem;
  text-align: center;
}

.canvas-scroll {
  min-width: 0;
  min-height: 0;
  padding: 34px;
  overflow: auto;
  overscroll-behavior: contain;
}

.editor-sidebar {
  min-height: 0;
  overflow-y: auto;
}

.side-section {
  margin-bottom: 10px;
  padding: 15px;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.side-heading {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.side-heading p,
.side-heading h2 {
  margin: 0;
}

.side-heading p {
  color: var(--text-muted);
  font-size: 0.67rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.side-heading h2 {
  margin-top: 4px;
  font-size: 0.9rem;
}

.side-heading a {
  color: var(--rose-strong);
  font-size: 0.72rem;
  font-weight: 800;
}

.usage-heading-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.usage-heading-actions button {
  display: inline-flex;
  padding: 5px 7px;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
  background: white;
  cursor: pointer;
  font-size: 0.64rem;
  font-weight: 800;
}

.usage-list {
  display: grid;
  gap: 7px;
  max-height: 43vh;
  overflow-y: auto;
}

.usage-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(3, 34px);
  gap: 5px;
}

.usage-row.hidden .usage-main {
  opacity: 0.48;
}

.usage-main,
.replace-button,
.visibility-button {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  cursor: pointer;
}

.replace-button {
  grid-column: 4;
}

.usage-main {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 5px;
  color: var(--text);
  text-align: left;
}

.usage-main > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.usage-main small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.62rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usage-swatch {
  width: 38px;
  height: 38px;
  border: 1px solid rgb(42 35 31 / 13%);
  border-radius: 8px;
}

.transparent {
  background: conic-gradient(#ddd 25%, white 0 50%, #ddd 0 75%, white 0) 0 0 /
    10px 10px;
}

.replace-button,
.visibility-button {
  display: grid;
  place-items: center;
  color: var(--text-muted);
}

.visibility-button:hover,
.visibility-button:focus-visible {
  color: var(--rose-strong);
  background: var(--rose-pale);
}

.downscale-panel {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.downscale-panel p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.55;
}

.downscale-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
}

.downscale-fields input {
  min-width: 0;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.downscale-fields button,
.create-small-pattern,
.restore-large-pattern {
  display: inline-flex;
  min-height: 34px;
  padding: 7px 9px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: white;
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 800;
}

.create-small-pattern {
  border-color: rgb(212 175 55 / 52%);
  color: #60490c;
  background: #fff7d7;
}

.restore-large-pattern {
  color: var(--rose-strong);
  background: var(--rose-pale);
}

details summary {
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 800;
}

details :deep(.panel) {
  margin-top: 12px;
  padding: 0;
  border: 0;
  box-shadow: none;
}

.new-pattern-fields {
  gap: 7px;
  margin-top: 12px;
}

.new-pattern-fields input {
  min-width: 0;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.toast {
  position: fixed;
  z-index: 100;
  right: 24px;
  bottom: 24px;
  padding: 12px 16px;
  border: 1px solid #b9d9c5;
  border-radius: 12px;
  color: #24563d;
  background: #edf8f1;
  box-shadow: var(--shadow-medium);
  font-size: 0.78rem;
  font-weight: 800;
}

.toast-enter-active,
.toast-leave-active {
  transition: 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 1100px) {
  .editor-toolbar {
    flex-wrap: wrap;
  }

  .editor-title {
    display: none;
  }

  .editor-body {
    grid-template-columns: minmax(0, 1fr) 300px;
  }

  .tool-group button span,
  .tool-group kbd {
    display: none;
  }
}

@media (max-width: 780px) {
  .editor-commandbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .command-group {
    max-width: 100%;
    overflow-x: auto;
  }

  .editor-body {
    grid-template-columns: 1fr;
  }

  .editor-sidebar {
    display: none;
  }

  .canvas-viewbar,
  .selection-bar {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .current-color-wrap {
    margin-left: 0;
  }

  .editor-toolbar .done-button {
    margin-left: auto;
  }
}
</style>
