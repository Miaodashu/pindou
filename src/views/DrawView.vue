<script setup lang="ts">
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Eraser,
  Eye,
  EyeOff,
  Hand,
  ImagePlus,
  Minus,
  Move,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Scan,
  Search,
  Trash2,
  Undo2,
} from '@lucide/vue'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'

import type { SelectionMode } from '@/core/selection'
import ColorReplaceDialog from '@/features/editor/ColorReplaceDialog.vue'
import PatternCanvas from '@/features/editor/PatternCanvas.vue'
import { useEditorStore, type EditorTool } from '@/features/editor/editorStore'

type CreateMode = 'blank' | 'trace'
type PatternViewMode = 'construction' | 'color-block'
type RightPanel = 'palette' | 'usage'

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
  tracingScaleX,
  tracingScaleY,
} = storeToRefs(store)

const canvas = ref<PatternCanvasApi>()
const canvasScroll = ref<HTMLDivElement>()
const tracingInput = ref<HTMLInputElement>()
const createMode = ref<CreateMode>('blank')
const tracingDragEnabled = ref(false)
const tracingScaleLinked = ref(true)
const rightPanel = ref<RightPanel>('palette')
const zoom = ref(0.8)
const viewMode = ref<PatternViewMode>('color-block')
const showGrid = ref(true)
const showGuides = ref(false)
const selection = ref<number[]>([])
const selectionMode = ref<SelectionMode>('rectangle')
const newWidth = ref(40)
const newHeight = ref(40)
const colorQuery = ref('')
const replaceFrom = ref<number>()
const toast = ref('')
let temporaryTool: EditorTool | undefined

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

const persistenceLabel = computed(() => {
  const labels = {
    idle: '本地草稿',
    saving: '保存中…',
    saved: '已自动保存',
    error: '保存失败',
  }
  return labels[persistenceStatus.value]
})

const activeColor = computed(
  () => palette.value.colors[selectedColor.value - 1],
)

const tracingOffsetLabel = computed(
  () =>
    `${formatOffset(tracingOffsetX.value)}，${formatOffset(tracingOffsetY.value)}`,
)

const filteredColors = computed(() => {
  const query = colorQuery.value.trim().toLowerCase()
  if (!query) return palette.value.colors
  return palette.value.colors.filter((color) =>
    [color.code, color.name, color.hex].some((value) =>
      value.toLowerCase().includes(query),
    ),
  )
})

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
  }, 3000)
}

function formatOffset(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatScale(value: number) {
  const percentage = Math.round(value * 1000) / 10
  return Number.isInteger(percentage)
    ? `${percentage.toFixed(0)}%`
    : `${percentage.toFixed(1)}%`
}

function updateTracingScale(axis: 'x' | 'y', rawPercentage: number) {
  const scale = Math.max(0.25, Math.min(4, rawPercentage / 100))
  if (tracingScaleLinked.value) {
    store.updateTracingSettings({ scaleX: scale, scaleY: scale })
    return
  }
  store.updateTracingSettings(
    axis === 'x' ? { scaleX: scale } : { scaleY: scale },
  )
}

function setTracingScaleLinked(linked: boolean) {
  tracingScaleLinked.value = linked
  if (linked) {
    store.updateTracingSettings({ scaleY: tracingScaleX.value })
  }
}

function resetTracingCalibration() {
  store.updateTracingSettings({ scaleX: 1, scaleY: 1 })
}

function setCreateMode(mode: CreateMode) {
  createMode.value = mode
  if (mode === 'blank') {
    tracingDragEnabled.value = false
    store.updateTracingSettings({ visible: false })
  } else if (tracingImageUrl.value) {
    store.updateTracingSettings({ visible: true })
    tracingDragEnabled.value = true
  }
}

function createBlankPattern() {
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
  store.updateTracingSettings({ visible: false })
  notify(`已创建 ${width} × ${height} 空白画布`)
}

function uploadTracing(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    notify('请选择 PNG、JPEG 或 WebP 图片')
  } else if (file.size > 25 * 1024 * 1024) {
    notify('临摹图片不能超过 25 MB')
  } else {
    store.setTracingImage(file)
    store.updateTracingSettings({ visible: true })
    createMode.value = 'trace'
    tracingDragEnabled.value = true
    notify('临摹图片已放到画布下方')
  }
  target.value = ''
}

function moveTracing(dx: number, dy: number) {
  store.updateTracingSettings({
    offsetX: tracingOffsetX.value + dx,
    offsetY: tracingOffsetY.value + dy,
  })
}

function moveTracingByDrag(delta: { x: number; y: number }) {
  store.updateTracingSettings({
    offsetX: tracingOffsetX.value + delta.x,
    offsetY: tracingOffsetY.value + delta.y,
  })
}

function selectTool(nextTool: EditorTool) {
  tracingDragEnabled.value = false
  tool.value = nextTool
}

function selectColor(colorIndex: number) {
  selectedColor.value = colorIndex
  tracingDragEnabled.value = false
  tool.value = 'pencil'
}

function pickColor(colorIndex: number) {
  const color = palette.value.colors[colorIndex - 1]
  if (!color) return
  selectColor(colorIndex)
  notify(`已吸取 ${color.code}，已切换到画笔`)
}

function fillSelection() {
  if (!selection.value.length) return
  store.applyEdits(
    selection.value.map((index) => ({
      index,
      before: pattern.value.cells[index] ?? 0,
      after: selectedColor.value,
    })),
  )
  notify(`已填充 ${selection.value.length} 格`)
}

function eraseSelection() {
  if (!selection.value.length) return
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
  notify(`已清空 ${changed.length} 格`)
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

function replaceColor(payload: {
  toColorIndex: number
  selectionOnly: boolean
}) {
  const from = replaceFrom.value
  if (from === undefined || from === payload.toColorIndex) return
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
  notify('颜色已替换，可撤销')
}

function panCanvas(delta: { x: number; y: number }) {
  canvasScroll.value?.scrollBy(delta.x, delta.y)
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
  if (!canvas.value) return
  const suffix = mode === 'construction' ? '施工图' : '色块图'
  const result = await canvas.value.exportPng(
    mode,
    mode === 'construction' || showGrid.value,
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
  notify('用量 CSV 已导出')
}

function isFormTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  )
}

function handleKeydown(event: KeyboardEvent) {
  if (isFormTarget(event.target)) return
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
  else if (key === 'i') selectTool('picker')
  else if (key === 's') selectTool('select')
  else if (key === 'f' && selection.value.length) fillSelection()
  else if (
    (event.key === 'Backspace' || event.key === 'Delete') &&
    selection.value.length
  ) {
    event.preventDefault()
    eraseSelection()
  } else if (event.key === 'Escape') {
    selection.value = []
  }
}

function handleKeyup(event: KeyboardEvent) {
  if (event.code !== 'Space' || !temporaryTool) return
  tool.value = temporaryTool
  temporaryTool = undefined
}

watch(
  () => [pattern.value.width, pattern.value.height],
  () => {
    selection.value = []
    newWidth.value = pattern.value.width
    newHeight.value = pattern.value.height
  },
)

onMounted(async () => {
  await store.hydrate()
  newWidth.value = pattern.value.width
  newHeight.value = pattern.value.height
  createMode.value = tracingImageUrl.value ? 'trace' : 'blank'
  tool.value = 'pencil'
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
})
</script>

<template>
  <div class="draw-page" :aria-busy="!store.isHydrated">
    <header class="draw-commandbar">
      <div class="project-name">
        <input
          :value="pattern.title"
          aria-label="图纸名称"
          maxlength="120"
          @change="store.rename(($event.target as HTMLInputElement).value)"
        />
        <span>
          {{ pattern.width }} × {{ pattern.height }} · {{ persistenceLabel }}
        </span>
      </div>
      <div class="export-actions">
        <button type="button" @click="exportPng('construction')">
          导出施工图
        </button>
        <button type="button" @click="exportMaterialsCsv">导出用量 CSV</button>
        <button class="primary" type="button" @click="exportPng('color-block')">
          导出色块图
        </button>
      </div>
    </header>

    <main class="draw-workspace">
      <aside class="setup-panel" aria-label="创作画布设置">
        <div class="panel-title">
          <p>CREATION BOARD</p>
          <h1>创作画板</h1>
        </div>

        <div class="mode-switch" aria-label="创作模式">
          <button
            type="button"
            :class="{ active: createMode === 'blank' }"
            :aria-pressed="createMode === 'blank'"
            @click="setCreateMode('blank')"
          >
            空白创作
          </button>
          <button
            type="button"
            :class="{ active: createMode === 'trace' }"
            :aria-pressed="createMode === 'trace'"
            @click="setCreateMode('trace')"
          >
            临摹创作
          </button>
        </div>

        <section class="setup-section">
          <div class="section-heading">
            <strong>画布尺寸</strong>
            <small>最大 300 × 300 格</small>
          </div>
          <div class="size-fields">
            <label>
              <span>宽度（格）</span>
              <input
                v-model.number="newWidth"
                :disabled="!store.isHydrated"
                aria-label="新图纸宽度"
                type="number"
                min="1"
                max="300"
              />
            </label>
            <label>
              <span>高度（格）</span>
              <input
                v-model.number="newHeight"
                :disabled="!store.isHydrated"
                aria-label="新图纸高度"
                type="number"
                min="1"
                max="300"
              />
            </label>
          </div>
          <label class="template-field">
            <span>画布模板</span>
            <select aria-label="画布模板">
              <option>方形画布</option>
            </select>
          </label>
          <button
            class="create-button"
            type="button"
            :disabled="!store.isHydrated"
            @click="createBlankPattern"
          >
            新建空白画布
          </button>
        </section>

        <section
          v-if="createMode === 'trace'"
          class="setup-section trace-section"
        >
          <div class="section-heading">
            <strong>临摹图片</strong>
            <small>仅覆盖画布，不会导出</small>
          </div>
          <button
            class="trace-upload"
            type="button"
            @click="tracingInput?.click()"
          >
            <ImagePlus :size="23" aria-hidden="true" />
            <span>
              <strong>{{
                tracingImageUrl ? '更换临摹图片' : '选择临摹图片'
              }}</strong>
              <small>{{ tracingFileName || 'PNG / JPEG / WebP' }}</small>
            </span>
          </button>
          <input
            ref="tracingInput"
            class="visually-hidden"
            aria-label="上传临摹图片"
            type="file"
            accept="image/*"
            @change="uploadTracing"
          />

          <button
            class="visibility-button"
            type="button"
            :disabled="!tracingImageUrl"
            :aria-pressed="tracingVisible"
            @click="store.updateTracingSettings({ visible: !tracingVisible })"
          >
            <Eye v-if="tracingVisible" :size="17" aria-hidden="true" />
            <EyeOff v-else :size="17" aria-hidden="true" />
            {{ tracingVisible ? '显示临摹图' : '临摹图已隐藏' }}
          </button>

          <label class="range-field" :class="{ disabled: !tracingImageUrl }">
            <span
              ><strong>透明度</strong
              ><b>{{ Math.round(tracingOpacity * 100) }}%</b></span
            >
            <input
              :value="tracingOpacity * 100"
              :disabled="!tracingImageUrl"
              aria-label="临摹图片透明度"
              type="range"
              min="5"
              max="100"
              @input="
                store.updateTracingSettings({
                  opacity:
                    Number(($event.target as HTMLInputElement).value) / 100,
                })
              "
            />
          </label>

          <div
            class="trace-calibration"
            :class="{ disabled: !tracingImageUrl }"
          >
            <div class="calibration-heading">
              <span
                ><strong>底图网格校准</strong
                ><small>让底图格线与画布重合</small></span
              >
              <label>
                <input
                  :checked="tracingScaleLinked"
                  :disabled="!tracingImageUrl"
                  type="checkbox"
                  @change="
                    setTracingScaleLinked(
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                宽高联动
              </label>
            </div>
            <label class="calibration-range">
              <span
                >横向格宽 <b>{{ formatScale(tracingScaleX) }}</b></span
              >
              <input
                :value="tracingScaleX * 100"
                :disabled="!tracingImageUrl"
                aria-label="临摹图横向网格大小"
                type="range"
                min="25"
                max="400"
                step="0.1"
                @input="
                  updateTracingScale(
                    'x',
                    Number(($event.target as HTMLInputElement).value),
                  )
                "
              />
            </label>
            <label class="calibration-range">
              <span
                >纵向格高 <b>{{ formatScale(tracingScaleY) }}</b></span
              >
              <input
                :value="tracingScaleY * 100"
                :disabled="!tracingImageUrl || tracingScaleLinked"
                aria-label="临摹图纵向网格大小"
                type="range"
                min="25"
                max="400"
                step="0.1"
                @input="
                  updateTracingScale(
                    'y',
                    Number(($event.target as HTMLInputElement).value),
                  )
                "
              />
            </label>
            <p>先调格距，再用下方拖拽或方向键对齐一条横线和一条竖线。</p>
            <button
              class="reset-calibration"
              type="button"
              :disabled="
                !tracingImageUrl || (tracingScaleX === 1 && tracingScaleY === 1)
              "
              @click="resetTracingCalibration"
            >
              复位网格大小
            </button>
          </div>

          <div class="trace-alignment" :class="{ disabled: !tracingImageUrl }">
            <span>位置微调</span>
            <button
              class="trace-drag-toggle"
              type="button"
              aria-label="拖拽调整临摹图位置"
              :aria-pressed="tracingDragEnabled"
              :class="{ active: tracingDragEnabled }"
              :disabled="!tracingImageUrl || !tracingVisible"
              @click="tracingDragEnabled = !tracingDragEnabled"
            >
              <Move :size="16" aria-hidden="true" />
              {{ tracingDragEnabled ? '拖拽调整中' : '拖拽调整位置' }}
            </button>
            <small
              >开启后直接拖动画布中的临摹图；选择绘图工具后自动退出。</small
            >
            <div class="direction-pad">
              <button
                type="button"
                aria-label="临摹图上移"
                :disabled="!tracingImageUrl"
                @click="moveTracing(0, -1)"
              >
                <ArrowUp :size="15" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="临摹图左移"
                :disabled="!tracingImageUrl"
                @click="moveTracing(-1, 0)"
              >
                <ArrowLeft :size="15" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="临摹图右移"
                :disabled="!tracingImageUrl"
                @click="moveTracing(1, 0)"
              >
                <ArrowRight :size="15" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="临摹图下移"
                :disabled="!tracingImageUrl"
                @click="moveTracing(0, 1)"
              >
                <ArrowDown :size="15" aria-hidden="true" />
              </button>
            </div>
            <button
              class="reset-position"
              type="button"
              :disabled="
                !tracingImageUrl || (!tracingOffsetX && !tracingOffsetY)
              "
              @click="store.updateTracingSettings({ offsetX: 0, offsetY: 0 })"
            >
              复位 · {{ tracingOffsetLabel }}
            </button>
          </div>
        </section>

        <div v-else class="blank-tip">
          <Pencil :size="18" aria-hidden="true" />
          <p>
            <strong>从第一颗豆开始</strong
            ><span>选择颜色后，在画布上点击或拖动绘制。</span>
          </p>
        </div>
      </aside>

      <section class="canvas-panel" aria-label="拼豆绘图区域">
        <div class="canvas-toolbar">
          <div class="drawing-tools" aria-label="绘图工具">
            <button
              v-for="item in tools"
              :key="item.id"
              type="button"
              :class="{ active: tool === item.id }"
              :aria-pressed="tool === item.id"
              :aria-label="`${item.label} ${item.shortcut}`"
              :title="`${item.label} (${item.shortcut})`"
              @click="selectTool(item.id)"
            >
              <component :is="item.icon" :size="18" aria-hidden="true" />
              <span>{{ item.label }}</span>
              <kbd>{{ item.shortcut }}</kbd>
            </button>
          </div>

          <div class="history-tools" aria-label="历史记录">
            <button
              type="button"
              :disabled="!canUndo"
              aria-label="撤销"
              @click="store.undo"
            >
              <Undo2 :size="18" aria-hidden="true" />
            </button>
            <button
              type="button"
              :disabled="!canRedo"
              aria-label="重做"
              @click="store.redo"
            >
              <Redo2 :size="18" aria-hidden="true" />
            </button>
          </div>

          <div class="zoom-tools" aria-label="缩放">
            <button
              type="button"
              aria-label="缩小"
              @click="zoom = Math.max(0.4, zoom - 0.1)"
            >
              <Minus :size="17" aria-hidden="true" />
            </button>
            <span>{{ Math.round(zoom * 100) }}%</span>
            <button
              type="button"
              aria-label="放大"
              @click="zoom = Math.min(3, zoom + 0.1)"
            >
              <Plus :size="17" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="canvas-options">
          <div class="view-modes" aria-label="画布显示模式">
            <button
              type="button"
              :class="{ active: viewMode === 'color-block' }"
              @click="viewMode = 'color-block'"
            >
              色块
            </button>
            <button
              type="button"
              :class="{ active: viewMode === 'construction' }"
              @click="viewMode = 'construction'"
            >
              施工
            </button>
          </div>
          <label><input v-model="showGrid" type="checkbox" />显示网格</label>
          <label
            ><input v-model="showGuides" type="checkbox" />中心参考线</label
          >
          <span>{{ pattern.width }} × {{ pattern.height }}</span>
          <button
            class="clear-canvas-button"
            type="button"
            :disabled="filledCellCount === 0"
            @click="clearCanvas"
          >
            <Trash2 :size="14" aria-hidden="true" />一键清空画布
          </button>
        </div>

        <div
          v-if="tool === 'select' || selection.length"
          class="selection-actions"
        >
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
          <strong>{{
            selection.length ? `已选择 ${selection.length} 格` : '拖动创建选区'
          }}</strong>
          <button
            type="button"
            :disabled="!selection.length"
            @click="fillSelection"
          >
            <PaintBucket :size="15" aria-hidden="true" />填充
          </button>
          <button
            type="button"
            :disabled="!selection.length"
            @click="eraseSelection"
          >
            <Trash2 :size="15" aria-hidden="true" />清空
          </button>
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
            :tracing-image-url="tracingImageUrl"
            :tracing-visible="createMode === 'trace' && tracingVisible"
            :tracing-opacity="tracingOpacity"
            :tracing-offset-x="tracingOffsetX"
            :tracing-offset-y="tracingOffsetY"
            :tracing-scale-x="tracingScaleX"
            :tracing-scale-y="tracingScaleY"
            :tracing-draggable="tracingDragEnabled"
            @apply="store.applyEdits"
            @pick-color="pickColor"
            @selection-change="selection = $event"
            @pan="panCanvas"
            @tracing-move="moveTracingByDrag"
          />
        </div>
      </section>

      <aside class="color-sidebar" aria-label="颜色与用量">
        <section class="current-color-card">
          <span
            class="current-swatch"
            :style="{ backgroundColor: activeColor?.hex }"
          />
          <div>
            <small>当前颜色</small>
            <strong>{{ activeColor?.code }} {{ activeColor?.name }}</strong>
          </div>
        </section>

        <section class="color-panel">
          <div class="panel-tabs" role="tablist" aria-label="颜色面板">
            <button
              type="button"
              role="tab"
              :aria-selected="rightPanel === 'palette'"
              :class="{ active: rightPanel === 'palette' }"
              @click="rightPanel = 'palette'"
            >
              颜色面板
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="rightPanel === 'usage'"
              :class="{ active: rightPanel === 'usage' }"
              @click="rightPanel = 'usage'"
            >
              色号用量
            </button>
          </div>

          <template v-if="rightPanel === 'palette'">
            <label class="color-search">
              <Search :size="15" aria-hidden="true" />
              <input
                v-model="colorQuery"
                type="search"
                placeholder="搜索色号或名称"
              />
            </label>
            <div class="palette-summary">
              <span>{{ palette.name }}</span
              ><b>{{ filteredColors.length }} 色</b>
            </div>
            <div class="color-grid">
              <button
                v-for="color in filteredColors"
                :key="color.id"
                type="button"
                :class="{ active: color.id === activeColor?.id }"
                :title="`${color.code} · ${color.name}`"
                :aria-label="`${color.code} ${color.name}`"
                @click="selectColor(palette.colors.indexOf(color) + 1)"
              >
                <span :style="{ backgroundColor: color.hex }" />
                <b>{{ color.code }}</b>
              </button>
            </div>
          </template>

          <template v-else>
            <div class="usage-summary">
              <div>
                <strong>{{ filledCellCount }}</strong
                ><span>已放豆子</span>
              </div>
              <div>
                <strong>{{ colorUsage.length }}</strong
                ><span>使用颜色</span>
              </div>
            </div>
            <div class="usage-list">
              <div
                v-for="entry in editorUsage"
                :key="entry.colorIndex"
                class="usage-row"
              >
                <button
                  type="button"
                  class="usage-main"
                  :disabled="entry.colorIndex === 0"
                  @click="entry.colorIndex > 0 && selectColor(entry.colorIndex)"
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
                  <span
                    ><strong>{{ entry.color?.code ?? '透明背景' }}</strong
                    ><small>{{
                      entry.color?.name ?? '未放置豆子'
                    }}</small></span
                  >
                  <b>{{ entry.count }}</b>
                </button>
                <button
                  type="button"
                  class="replace-button"
                  :aria-label="`替换 ${entry.color?.code ?? '透明背景'}`"
                  @click="replaceFrom = entry.colorIndex"
                >
                  <ArrowLeftRight :size="15" aria-hidden="true" />
                </button>
              </div>
            </div>
          </template>
        </section>
      </aside>
    </main>

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
.draw-page {
  min-height: calc(100vh - 78px);
  background: #f8f0f0;
}

.draw-commandbar,
.export-actions,
.mode-switch,
.section-heading,
.size-fields,
.canvas-toolbar,
.drawing-tools,
.history-tools,
.zoom-tools,
.canvas-options,
.view-modes,
.selection-actions,
.current-color-card,
.panel-tabs,
.color-search,
.palette-summary,
.usage-main {
  display: flex;
  align-items: center;
}

.draw-commandbar {
  position: sticky;
  z-index: 12;
  top: 0;
  justify-content: space-between;
  gap: 20px;
  min-height: 76px;
  padding: 12px clamp(22px, 3vw, 48px);
  border-bottom: 1px solid var(--border);
  background: rgb(255 250 250 / 95%);
  box-shadow: 0 8px 26px rgb(77 45 50 / 7%);
  backdrop-filter: blur(16px);
}

.project-name {
  display: grid;
  gap: 2px;
  min-width: 210px;
}

.project-name input {
  width: 100%;
  padding: 0;
  border: 0;
  color: var(--text);
  background: transparent;
  font-size: 1rem;
  font-weight: 800;
  outline: none;
}

.project-name span {
  color: var(--text-muted);
  font-size: 0.67rem;
}

.export-actions {
  gap: 8px;
}

.export-actions button,
.canvas-toolbar button,
.canvas-options button,
.selection-actions button,
.direction-pad button,
.visibility-button,
.trace-drag-toggle,
.create-button,
.reset-position {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  background: #fffdfd;
  font-size: 0.72rem;
  font-weight: 800;
}

.trace-calibration {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.calibration-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.calibration-heading > span {
  display: grid;
  gap: 3px;
}

.calibration-heading strong {
  font-size: 0.68rem;
}

.calibration-heading small,
.trace-calibration p {
  color: var(--text-muted);
  font-size: 0.58rem;
  line-height: 1.5;
}

.calibration-heading label {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 0.58rem;
  font-weight: 700;
}

.calibration-heading input,
.calibration-range input {
  accent-color: var(--rose-strong);
}

.calibration-range {
  display: grid;
  gap: 4px;
  margin-top: 10px;
}

.calibration-range span {
  display: flex;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 0.61rem;
}

.calibration-range input {
  width: 100%;
}

.trace-calibration p {
  margin: 8px 0 0;
}

.reset-calibration {
  width: 100%;
  min-height: 30px;
  margin-top: 7px;
  border: 0;
  border-radius: 8px;
  color: var(--rose-strong);
  background: var(--rose-pale);
  font-size: 0.63rem;
  font-weight: 800;
}

.export-actions .primary,
.create-button {
  border-color: var(--rose-strong);
  color: white;
  background: var(--rose-strong);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.draw-workspace {
  display: grid;
  min-width: 0;
  height: calc(100vh - 154px);
  min-height: 650px;
  grid-template-columns: 290px minmax(500px, 1fr) 310px;
  gap: 12px;
  padding: 14px;
}

.setup-panel,
.canvas-panel,
.current-color-card,
.color-panel {
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.setup-panel {
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  border-radius: 18px;
}

.panel-title p,
.panel-title h1 {
  margin: 0;
}

.panel-title p {
  color: var(--rose-strong);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.15em;
}

.panel-title h1 {
  margin-top: 4px;
  font-family: 'Cormorant Garamond', 'Noto Serif SC', serif;
  font-size: 1.7rem;
}

.mode-switch {
  margin-top: 18px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface-muted);
}

.mode-switch button {
  flex: 1;
  min-height: 40px;
  border: 0;
  border-radius: 8px;
  color: var(--text-muted);
  background: transparent;
  font-size: 0.76rem;
  font-weight: 800;
}

.mode-switch button.active {
  color: white;
  background: var(--rose-strong);
  box-shadow: 0 7px 18px rgb(146 77 86 / 18%);
}

.setup-section {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.section-heading {
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.section-heading strong {
  font-size: 0.8rem;
}

.section-heading small {
  color: var(--text-muted);
  font-size: 0.61rem;
}

.size-fields {
  gap: 10px;
}

.size-fields label,
.template-field,
.range-field {
  display: grid;
  flex: 1;
  gap: 6px;
}

.size-fields span,
.template-field > span,
.range-field span {
  color: var(--text-muted);
  font-size: 0.64rem;
  font-weight: 700;
}

.size-fields input,
.template-field select {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fffdfd;
  outline: none;
}

.template-field {
  margin-top: 12px;
}

.create-button {
  width: 100%;
  margin-top: 12px;
}

.trace-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 82px;
  padding: 12px;
  border: 1px dashed #d7bfc0;
  border-radius: 12px;
  color: var(--rose-strong);
  background: #fffafa;
}

.trace-upload span,
.blank-tip p {
  display: grid;
  gap: 3px;
  margin: 0;
  text-align: left;
}

.trace-upload small,
.blank-tip span {
  max-width: 165px;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.61rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.visibility-button {
  justify-content: flex-start;
  width: 100%;
  margin-top: 10px;
}

.range-field {
  margin-top: 14px;
}

.range-field span {
  display: flex;
  justify-content: space-between;
}

.range-field input {
  width: 100%;
  accent-color: var(--rose-strong);
}

.trace-alignment {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.trace-alignment > span {
  color: var(--text-muted);
  font-size: 0.64rem;
  font-weight: 700;
}

.trace-drag-toggle {
  width: 100%;
  margin-top: 10px;
}

.trace-drag-toggle.active {
  border-color: var(--rose-strong);
  color: var(--rose-strong);
  background: var(--rose-pale);
}

.trace-alignment > small {
  display: block;
  margin-top: 7px;
  color: var(--text-muted);
  font-size: 0.62rem;
  line-height: 1.55;
}

.direction-pad {
  display: grid;
  grid-template-columns: repeat(3, 38px);
  grid-template-rows: repeat(2, 38px);
  justify-content: center;
  gap: 5px;
  margin-top: 10px;
}

.direction-pad button {
  min-height: 38px;
  padding: 0;
}

.direction-pad button:nth-child(1) {
  grid-column: 2;
}
.direction-pad button:nth-child(2) {
  grid-column: 1;
  grid-row: 2;
}
.direction-pad button:nth-child(3) {
  grid-column: 3;
  grid-row: 2;
}
.direction-pad button:nth-child(4) {
  grid-column: 2;
  grid-row: 2;
}

.reset-position {
  width: 100%;
  margin-top: 8px;
  min-height: 30px;
  padding: 5px;
  border: 0;
  color: var(--rose-strong);
  background: transparent;
}

.disabled {
  opacity: 0.5;
}

.blank-tip {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 20px;
  padding: 13px;
  border-radius: 12px;
  color: var(--sage-dark);
  background: var(--sage-pale);
}

.blank-tip strong {
  font-size: 0.72rem;
}

.canvas-panel {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  overflow: hidden;
  border-radius: 18px;
}

.canvas-toolbar {
  gap: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  scrollbar-width: thin;
}

.canvas-toolbar button {
  flex: 0 0 auto;
  white-space: nowrap;
}

.drawing-tools,
.history-tools,
.zoom-tools {
  gap: 5px;
}

.drawing-tools button.active,
.view-modes button.active,
.selection-actions button.active {
  border-color: var(--rose-strong);
  color: var(--rose-strong);
  background: var(--rose-pale);
}

.drawing-tools kbd {
  color: var(--text-muted);
  font-size: 0.56rem;
}

.history-tools {
  padding-left: 8px;
  border-left: 1px solid var(--border);
}

.zoom-tools {
  margin-left: auto;
  padding-left: 8px;
  border-left: 1px solid var(--border);
}

.zoom-tools button {
  width: 36px;
  padding: 0;
}

.zoom-tools span {
  min-width: 44px;
  color: var(--text-muted);
  font-size: 0.68rem;
  text-align: center;
}

.canvas-options {
  justify-content: flex-end;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  background: #fffafa;
}

.view-modes {
  gap: 4px;
  margin-right: auto;
}

.canvas-options button,
.selection-actions button {
  min-height: 30px;
  padding: 5px 9px;
}

.canvas-options label,
.canvas-options > span {
  color: var(--text-muted);
  font-size: 0.64rem;
  font-weight: 700;
}

.canvas-options label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.canvas-options input {
  accent-color: var(--rose-strong);
}

.canvas-options .clear-canvas-button {
  border-color: #dcaaa5;
  color: #a43b32;
  background: #fff5f3;
}

.selection-actions {
  gap: 6px;
  padding: 7px 12px;
  border-bottom: 1px solid #e8cecc;
  background: #fff7f4;
}

.selection-actions strong {
  margin-right: auto;
  font-size: 0.68rem;
}

.canvas-scroll {
  min-width: 0;
  min-height: 0;
  padding: 24px;
  overflow: auto;
  background: #e7e1dc;
  overscroll-behavior: contain;
}

.color-sidebar {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.current-color-card,
.color-panel {
  border-radius: 18px;
}

.current-color-card {
  gap: 12px;
  padding: 14px;
}

.current-swatch {
  width: 52px;
  height: 52px;
  flex: none;
  border: 1px solid rgb(41 31 28 / 14%);
  border-radius: 13px;
}

.current-color-card div {
  display: grid;
  gap: 4px;
}

.current-color-card small {
  color: var(--text-muted);
  font-size: 0.64rem;
}

.current-color-card strong {
  font-size: 0.82rem;
}

.color-panel {
  min-height: 0;
  padding: 14px;
  overflow: hidden;
}

.panel-tabs {
  gap: 4px;
  border-bottom: 1px solid var(--border);
}

.panel-tabs button {
  position: relative;
  flex: 1;
  min-height: 42px;
  border: 0;
  color: var(--text-muted);
  background: transparent;
  font-size: 0.75rem;
  font-weight: 800;
}

.panel-tabs button.active {
  color: var(--rose-strong);
}

.panel-tabs button.active::after {
  position: absolute;
  right: 8px;
  bottom: -1px;
  left: 8px;
  height: 2px;
  background: var(--rose-strong);
  content: '';
}

.color-search {
  gap: 7px;
  margin-top: 12px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text-muted);
}

.color-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  color: var(--text);
  background: transparent;
  font-size: 0.7rem;
  outline: none;
}

.palette-summary {
  justify-content: space-between;
  margin: 11px 1px 8px;
  color: var(--text-muted);
  font-size: 0.64rem;
}

.color-grid {
  display: grid;
  max-height: calc(100% - 112px);
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  padding-right: 3px;
  overflow-y: auto;
  scrollbar-color: #caa9ad transparent;
  scrollbar-width: thin;
}

.color-grid button {
  display: grid;
  gap: 3px;
  place-items: center;
  min-width: 0;
  padding: 4px 2px 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--text-muted);
  background: transparent;
  font-size: 0.6rem;
}

.color-grid button > span {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid rgb(38 30 26 / 13%);
  border-radius: 9px;
}

.color-grid button.active,
.color-grid button:hover {
  border-color: var(--rose-strong);
  color: var(--rose-strong);
  background: var(--rose-pale);
}

.usage-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 12px 0;
}

.usage-summary div {
  display: grid;
  gap: 3px;
  padding: 11px;
  border-radius: 11px;
  background: var(--surface-muted);
}

.usage-summary strong {
  font-size: 1rem;
}

.usage-summary span {
  color: var(--text-muted);
  font-size: 0.61rem;
}

.usage-list {
  display: grid;
  max-height: calc(100% - 112px);
  gap: 6px;
  overflow-y: auto;
}

.usage-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  gap: 5px;
}

.usage-main,
.replace-button {
  border: 1px solid var(--border);
  border-radius: 9px;
  background: #fffdfd;
}

.usage-main {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 8px;
  padding: 5px;
  text-align: left;
}

.usage-main > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.usage-main small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.59rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.usage-swatch {
  width: 34px;
  height: 34px;
  border: 1px solid rgb(38 30 26 / 13%);
  border-radius: 7px;
}

.transparent {
  background: conic-gradient(#ddd 25%, white 0 50%, #ddd 0 75%, white 0) 0 0 /
    10px 10px;
}

.replace-button {
  display: grid;
  place-items: center;
  color: var(--text-muted);
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
  font-size: 0.75rem;
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

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 1400px) {
  .draw-workspace {
    grid-template-columns: 270px minmax(460px, 1fr) 290px;
  }

  .drawing-tools kbd {
    display: none;
  }

  .canvas-toolbar button {
    padding-inline: 9px;
  }
}

@media (max-width: 1240px) {
  .draw-workspace {
    grid-template-columns: 250px minmax(440px, 1fr) 270px;
  }

  .drawing-tools button span {
    display: none;
  }

  .drawing-tools button {
    width: 38px;
    padding: 0;
  }
}

@media (max-width: 980px) {
  .draw-commandbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .export-actions {
    max-width: 100%;
    overflow-x: auto;
  }

  .draw-workspace {
    height: auto;
    min-height: 0;
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .canvas-panel {
    min-height: 680px;
  }

  .color-sidebar {
    align-items: start;
    grid-column: 1 / -1;
    grid-template-rows: auto;
    grid-template-columns: 250px minmax(0, 1fr);
  }

  .current-color-card {
    width: 100%;
  }

  .color-panel {
    width: 100%;
    height: min(620px, 70vh);
    min-height: 360px;
  }

  .color-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .draw-page {
    min-height: calc(100vh - 68px);
  }

  .draw-workspace {
    grid-template-columns: 1fr;
    padding: 9px;
  }

  .setup-panel,
  .canvas-panel,
  .color-sidebar {
    grid-column: 1;
  }

  .setup-panel {
    overflow: visible;
  }

  .canvas-panel {
    min-height: 620px;
  }

  .canvas-toolbar,
  .canvas-options,
  .selection-actions {
    flex-wrap: wrap;
  }

  .zoom-tools {
    margin-left: 0;
  }

  .color-sidebar {
    grid-template-columns: 1fr;
  }

  .color-panel {
    height: min(620px, 70vh);
    min-height: 420px;
  }

  .color-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>
