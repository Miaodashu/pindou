<script setup lang="ts">
import {
  Eraser,
  Minus,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Scan,
  Undo2,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { storeToRefs } from 'pinia'

import type { SelectionMode } from '@/core/selection'
import ImageImportPanel from '@/features/converter/ImageImportPanel.vue'
import PatternCanvas from '@/features/editor/PatternCanvas.vue'
import { useEditorStore, type EditorTool } from '@/features/editor/editorStore'
import BeanInventoryPanel from '@/features/inventory/BeanInventoryPanel.vue'
import PalettePanel from '@/features/palette/PalettePanel.vue'
import TracingImagePanel from '@/features/tracing/TracingImagePanel.vue'

type PatternViewMode = 'construction' | 'color-block' | 'bead-preview'
type DrawingTool = Exclude<EditorTool, 'picker'>

interface PatternCanvasApi {
  exportPng: (
    viewMode: PatternViewMode,
    showGrid?: boolean,
    showGuides?: boolean,
  ) => Promise<Blob>
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
  inventorySummary,
  tracingImageUrl,
  tracingFileName,
  tracingVisible,
  tracingOpacity,
  tracingOffsetX,
  tracingOffsetY,
} = storeToRefs(store)
const canvas = ref<PatternCanvasApi>()
const zoom = ref(1)
const viewMode = ref<PatternViewMode>('color-block')
const showGrid = ref(true)
const showGuides = ref(false)
const selection = ref<number[]>([])
const selectionMode = ref<SelectionMode>('rectangle')
const lastDrawingTool = ref<DrawingTool>('pencil')
const newWidth = ref(29)
const newHeight = ref(29)
const importInput = ref<HTMLInputElement>()
const toast = ref('')

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
  { id: 'pencil', label: '画笔', shortcut: 'P', icon: Pencil },
  { id: 'eraser', label: '橡皮', shortcut: 'E', icon: Eraser },
  { id: 'picker', label: '取色', shortcut: 'I', icon: Pipette },
  { id: 'select', label: '选区', shortcut: 'S', icon: Scan },
]

const viewModes: Array<{ id: PatternViewMode; label: string }> = [
  { id: 'construction', label: '施工图' },
  { id: 'color-block', label: '色块图' },
  { id: 'bead-preview', label: '成品预览' },
]

function notify(message: string) {
  toast.value = message
  window.setTimeout(() => {
    if (toast.value === message) toast.value = ''
  }, 2600)
}

function createNewPattern() {
  const width = Math.max(1, Math.min(300, Math.floor(newWidth.value)))
  const height = Math.max(1, Math.min(300, Math.floor(newHeight.value)))
  if (
    filledCellCount.value > 0 &&
    !window.confirm('新建图纸会替换当前画布。当前草稿已自动保存，是否继续？')
  ) {
    return
  }
  store.newPattern(width, height)
  selection.value = []
  notify(`已创建 ${width} × ${height} 图纸`)
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

function exportJson() {
  download(
    new Blob([JSON.stringify(store.exportProject(), null, 2)], {
      type: 'application/json',
    }),
    safeFileName('pindou.json'),
  )
  notify('项目文件已导出')
}

async function exportPng(mode: PatternViewMode) {
  if (!canvas.value) return
  const suffix =
    mode === 'construction'
      ? '施工图'
      : mode === 'bead-preview'
        ? '成品预览'
        : '色块图'
  const includeGrid =
    mode === 'construction' || (mode === 'color-block' && showGrid.value)
  download(
    await canvas.value.exportPng(mode, includeGrid, showGuides.value),
    safeFileName(`${suffix}.png`),
  )
  notify(`${suffix} PNG 已导出`)
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
  notify(`已导出 ${rows.length} 个色号的库存用量清单`)
}

async function importJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    store.importProject(JSON.parse(await file.text()))
    selection.value = []
    notify('项目文件已载入')
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '无法读取项目文件。')
  } finally {
    input.value = ''
  }
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
  if (nextTool !== 'picker') lastDrawingTool.value = nextTool
  tool.value = nextTool
}

function pickColor(colorIndex: number) {
  const color = palette.value.colors[colorIndex - 1]
  if (!color) return
  selectedColor.value = colorIndex
  if (tool.value === 'picker') tool.value = lastDrawingTool.value
  notify(`已吸取 ${color.code} · ${color.name}`)
}

function mirrorPattern(axis: 'horizontal' | 'vertical') {
  store.mirrorPattern(axis)
  selection.value = []
  notify(axis === 'horizontal' ? '图纸已水平翻转' : '图纸已垂直翻转')
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

function clearSelection() {
  selection.value = []
}

function replaceColor(fromColorIndex: number) {
  const from = palette.value.colors[fromColorIndex - 1]
  const to = palette.value.colors[selectedColor.value - 1]
  if (!from || !to || fromColorIndex === selectedColor.value) return
  store.replaceColor(fromColorIndex, selectedColor.value)
  notify(`已将 ${from.code} 全部替换为 ${to.code}`)
}

function handleKeydown(event: KeyboardEvent) {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLSelectElement
  ) {
    return
  }
  const key = event.key.toLowerCase()
  if ((event.metaKey || event.ctrlKey) && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) store.redo()
    else store.undo()
  } else if (key === 'p') selectTool('pencil')
  else if (key === 'e') selectTool('eraser')
  else if (key === 'f' && selection.value.length > 0) fillSelection()
  else if (key === 'i') selectTool('picker')
  else if (key === 's') selectTool('select')
  else if (event.key === 'Escape') clearSelection()
}

watch(() => [pattern.value.width, pattern.value.height], clearSelection)

onMounted(() => {
  store.hydrate()
  window.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
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

      <div class="command-group" aria-label="编辑操作">
        <button
          type="button"
          :disabled="!canUndo"
          title="撤销 ⌘Z"
          @click="store.undo"
        >
          <Undo2 :size="15" aria-hidden="true" />
          撤销
        </button>
        <button
          type="button"
          :disabled="!canRedo"
          title="重做 ⇧⌘Z"
          @click="store.redo"
        >
          <Redo2 :size="15" aria-hidden="true" />
          重做
        </button>
      </div>

      <div class="command-group">
        <button type="button" @click="importInput?.click()">载入项目</button>
        <input
          ref="importInput"
          class="visually-hidden"
          type="file"
          accept=".json,.pindou.json"
          @change="importJson"
        />
        <button type="button" @click="exportJson">导出项目</button>
        <button type="button" @click="exportPng('construction')">
          导出施工图
        </button>
        <button type="button" @click="exportMaterialsCsv">导出用量 CSV</button>
        <button type="button" @click="exportPng('bead-preview')">
          导出成品预览
        </button>
        <button class="primary" type="button" @click="exportPng('color-block')">
          导出色块图
        </button>
      </div>
    </header>

    <div class="editor-layout">
      <aside class="left-sidebar">
        <section class="panel new-pattern-panel">
          <p class="panel-label">画布规格</p>
          <div class="size-fields">
            <label
              >宽
              <input v-model.number="newWidth" type="number" min="1" max="300"
            /></label>
            <span>×</span>
            <label
              >高
              <input v-model.number="newHeight" type="number" min="1" max="300"
            /></label>
          </div>
          <div class="size-presets">
            <button type="button" @click="newWidth = newHeight = 29">29</button>
            <button type="button" @click="newWidth = newHeight = 58">58</button>
            <button type="button" @click="newWidth = newHeight = 87">87</button>
          </div>
          <button
            class="secondary-wide"
            type="button"
            @click="createNewPattern"
          >
            新建图纸
          </button>
        </section>

        <ImageImportPanel
          :pattern="pattern"
          :palette="palette"
          @converted="store.replaceCells"
        />
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
        <PalettePanel
          v-model="selectedColor"
          :palette="palette"
          @install="installPalette"
        />
      </aside>

      <section class="canvas-column">
        <div class="canvas-toolbar">
          <div class="tool-switcher" aria-label="绘图工具">
            <button
              v-for="item in tools"
              :key="item.id"
              type="button"
              :class="{ active: tool === item.id }"
              :aria-pressed="tool === item.id"
              :title="`${item.label} (${item.shortcut})`"
              @click="selectTool(item.id)"
            >
              <component :is="item.icon" :size="15" aria-hidden="true" />
              {{ item.label }} <kbd>{{ item.shortcut }}</kbd>
            </button>
          </div>
          <div
            v-if="tool === 'select' || selection.length > 0"
            class="selection-switcher"
            aria-label="选区方式"
          >
            <button
              type="button"
              :class="{ active: selectionMode === 'rectangle' }"
              :aria-pressed="selectionMode === 'rectangle'"
              @click="selectionMode = 'rectangle'"
            >
              矩形
            </button>
            <button
              type="button"
              :class="{ active: selectionMode === 'lasso' }"
              :aria-pressed="selectionMode === 'lasso'"
              @click="selectionMode = 'lasso'"
            >
              套索
            </button>
            <span role="status">{{
              selection.length ? `已选 ${selection.length} 格` : '拖动框选'
            }}</span>
            <button
              class="selection-fill"
              type="button"
              :disabled="selection.length === 0"
              title="快捷键 F"
              @click="fillSelection"
            >
              填充选区 <kbd>F</kbd>
            </button>
            <button
              type="button"
              :disabled="selection.length === 0"
              @click="clearSelection"
            >
              取消
            </button>
          </div>
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
              :class="{ active: showGrid && viewMode === 'color-block' }"
              :disabled="viewMode !== 'color-block'"
              :aria-pressed="showGrid"
              title="显示或隐藏色块图网格"
              @click="showGrid = !showGrid"
            >
              网格
            </button>
            <button
              type="button"
              :class="{ active: showGuides }"
              :aria-pressed="showGuides"
              title="显示或隐藏画布中心参考线"
              @click="showGuides = !showGuides"
            >
              参考线
            </button>
          </div>
          <div class="transform-switcher" aria-label="图纸变换">
            <button type="button" @click="mirrorPattern('horizontal')">
              水平翻转
            </button>
            <button type="button" @click="mirrorPattern('vertical')">
              垂直翻转
            </button>
          </div>
          <div class="zoom-control">
            <button
              type="button"
              aria-label="缩小"
              @click="zoom = Math.max(0.4, zoom - 0.2)"
            >
              <Minus :size="15" aria-hidden="true" />
            </button>
            <span>{{ Math.round(zoom * 100) }}%</span>
            <button
              type="button"
              aria-label="放大"
              @click="zoom = Math.min(2.4, zoom + 0.2)"
            >
              <Plus :size="15" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div class="canvas-scroll">
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
            :tracing-visible="tracingVisible"
            :tracing-opacity="tracingOpacity"
            :tracing-offset-x="tracingOffsetX"
            :tracing-offset-y="tracingOffsetY"
            @apply="store.applyEdits"
            @pick-color="pickColor"
            @selection-change="selection = $event"
          />
        </div>
      </section>

      <aside class="right-sidebar">
        <BeanInventoryPanel
          :palette="palette"
          :selected-color="selectedColor"
          :rows="inventorySummary.rows"
          :total-stock="inventorySummary.totalStock"
          :total-used="inventorySummary.totalUsed"
          :total-remaining="inventorySummary.totalRemaining"
          :total-shortage="inventorySummary.totalShortage"
          @set-stock="store.setInventoryStock"
        />
        <section class="panel summary-panel">
          <p class="panel-label">材料清单</p>
          <div class="metric-row">
            <div>
              <strong>{{ filledCellCount }}</strong
              ><span>已用拼豆</span>
            </div>
            <div>
              <strong>{{ colorUsage.length }}</strong
              ><span>使用颜色</span>
            </div>
          </div>
          <div v-if="colorUsage.length" class="usage-list">
            <div
              v-for="entry in colorUsage"
              :key="entry.colorIndex"
              class="usage-row"
            >
              <span
                class="usage-swatch"
                :style="{ backgroundColor: entry.color?.hex }"
              />
              <span class="usage-code">{{ entry.color?.code }}</span>
              <span class="usage-name">{{ entry.color?.name }}</span>
              <strong>{{ entry.count }}</strong>
              <button
                type="button"
                :disabled="entry.colorIndex === selectedColor"
                :aria-label="`将 ${entry.color?.code} 全部替换为当前颜色`"
                title="替换为当前画笔颜色"
                @click="replaceColor(entry.colorIndex)"
              >
                替换
              </button>
            </div>
          </div>
          <p v-else class="empty-state">
            开始绘制或导入图片后，这里会生成色号与数量清单。
          </p>
        </section>

        <section class="panel help-panel">
          <p class="panel-label">当前画笔</p>
          <div class="selected-color">
            <span
              :style="{
                backgroundColor: palette.colors[selectedColor - 1]?.hex,
              }"
            />
            <div>
              <strong>{{ palette.colors[selectedColor - 1]?.code }}</strong>
              <small>{{ palette.colors[selectedColor - 1]?.name }}</small>
            </div>
          </div>
          <ul>
            <li>拖动鼠标连续绘制</li>
            <li>取色工具或按住 Alt 吸取色号</li>
            <li>先建立矩形或套索选区，再填充选区</li>
            <li>每 29 格显示底板分界</li>
            <li>项目自动保存到当前浏览器</li>
          </ul>
        </section>
      </aside>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.editor-page {
  min-height: calc(100vh - 78px);
  background: #f3ebeb;
}

.editor-commandbar {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 66px;
  padding: 11px 20px;
  border-bottom: 1px solid var(--border);
  background: rgb(255 250 250 / 94%);
  box-shadow: 0 7px 24px rgb(77 45 50 / 7%);
  backdrop-filter: blur(14px);
}

.document-title {
  display: grid;
  min-width: 240px;
  margin-right: auto;
}

.document-title input {
  width: 100%;
  padding: 0;
  border: 0;
  color: var(--text);
  background: transparent;
  font-size: 1rem;
  font-weight: 800;
  outline: none;
}

.document-title span {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.command-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 8px 11px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text);
  background: var(--surface);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

button:hover:not(:disabled) {
  border-color: #c99ba0;
  background: var(--rose-pale);
  transform: translateY(-1px);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

button.primary {
  border-color: var(--gold-dark);
  color: var(--text);
  background: var(--gold);
  box-shadow: 0 8px 20px rgb(134 102 18 / 16%);
}

.editor-layout {
  display: grid;
  grid-template-columns: 278px minmax(420px, 1fr) 260px;
  gap: 16px;
  min-height: calc(100vh - 144px);
  padding: 16px;
}

.left-sidebar,
.right-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  padding: 17px;
  border: 1px solid var(--border);
  border-radius: 19px;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.panel-label {
  margin: 0 0 12px;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.size-fields {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: 7px;
}

.size-fields label {
  display: grid;
  gap: 4px;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.size-fields input {
  min-width: 0;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fffafa;
}

.size-presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 8px 0;
}

.secondary-wide {
  width: 100%;
}

.canvas-column {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: #dcd3cf;
  box-shadow: var(--shadow-medium);
}

.canvas-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid var(--border);
  background: rgb(255 250 250 / 96%);
}

.tool-switcher,
.selection-switcher,
.view-switcher,
.transform-switcher,
.zoom-control {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-switcher button.active,
.selection-switcher button.active,
.view-switcher button.active,
.transform-switcher button.active {
  border-color: var(--rose-strong);
  color: var(--accent-strong);
  background: var(--rose-pale);
}

.selection-switcher {
  align-items: center;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.selection-switcher span {
  min-width: 70px;
  padding: 0 4px;
  color: var(--text-muted);
  font-size: 0.68rem;
  text-align: center;
}

.selection-switcher .selection-fill:not(:disabled) {
  border-color: var(--gold-dark);
  color: var(--text);
  background: var(--gold);
}

kbd {
  color: var(--text-muted);
  font-size: 0.63rem;
}

.zoom-control {
  align-items: center;
}

.zoom-control span {
  min-width: 48px;
  color: var(--text-muted);
  font-size: 0.7rem;
  text-align: center;
}

.canvas-scroll {
  display: grid;
  place-items: start center;
  height: calc(100vh - 220px);
  padding: 48px;
  overflow: auto;
}

.metric-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.metric-row div {
  display: grid;
  gap: 3px;
  padding: 12px;
  border: 1px solid rgb(53 104 78 / 10%);
  border-radius: 12px;
  background: var(--sage-pale);
}

.metric-row strong {
  font-size: 1.35rem;
}

.metric-row span,
.empty-state {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.usage-list {
  display: grid;
  gap: 4px;
  max-height: 360px;
  margin-top: 12px;
  overflow: auto;
}

.usage-row {
  display: grid;
  grid-template-columns: 18px 36px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  font-size: 0.7rem;
}

.usage-row button {
  padding: 4px 6px;
  border-radius: 7px;
  font-size: 0.64rem;
}

.usage-swatch {
  width: 16px;
  height: 16px;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 50%;
}

.usage-code {
  font-family: ui-monospace, monospace;
  font-weight: 700;
}

.usage-name {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-color {
  display: flex;
  align-items: center;
  gap: 10px;
}

.selected-color > span {
  width: 34px;
  height: 34px;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 50%;
}

.selected-color div {
  display: grid;
}

.selected-color small,
.help-panel li {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.help-panel ul {
  display: grid;
  gap: 5px;
  margin: 14px 0 0;
  padding-left: 18px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.toast {
  position: fixed;
  z-index: 20;
  right: 24px;
  bottom: 24px;
  padding: 11px 16px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 12px;
  color: white;
  background: var(--text);
  box-shadow: 0 12px 40px rgb(0 0 0 / 24%);
  font-size: 0.78rem;
  font-weight: 700;
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
  .editor-layout {
    grid-template-columns: 240px minmax(420px, 1fr);
  }

  .right-sidebar {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .editor-commandbar {
    position: static;
    flex-wrap: wrap;
  }

  .document-title {
    width: 100%;
  }

  .editor-layout {
    display: flex;
    flex-direction: column;
    padding: 12px;
  }

  .left-sidebar {
    display: grid;
    grid-template-columns: 1fr;
  }

  .canvas-column {
    min-height: 620px;
    order: -1;
  }

  .canvas-scroll {
    height: 550px;
    padding: 28px;
  }

  .right-sidebar {
    display: flex;
  }

  .command-group {
    width: 100%;
  }

  .command-group button {
    flex: 1 1 auto;
  }
}
</style>
