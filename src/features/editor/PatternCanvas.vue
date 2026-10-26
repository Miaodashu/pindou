<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  calculateCanvasBackingStore,
  calculateCanvasExportCellSize,
} from '@/core/canvasBackingStore'
import {
  lassoSelection,
  rectangleSelection,
  type GridPoint,
  type SelectionMode,
} from '@/core/selection'
import type { BeadPalette } from '@/domain/palette/types'
import type { CellEdit, PatternDocument } from '@/domain/pattern/types'
import type { EditorTool } from './editorStore'

type PatternViewMode = 'construction' | 'color-block'

interface CanvasExportResult {
  blob: Blob
  cellSize: number
}

const props = withDefaults(
  defineProps<{
    pattern: PatternDocument
    palette: BeadPalette
    revision: number
    zoom: number
    tool: EditorTool
    selectedColor: number
    viewMode: PatternViewMode
    showGrid: boolean
    showGuides: boolean
    selection: number[]
    selectionMode: SelectionMode
    tracingImageUrl: string
    tracingVisible: boolean
    tracingOpacity: number
    tracingOffsetX: number
    tracingOffsetY: number
    tracingScaleX?: number
    tracingScaleY?: number
    tracingDraggable?: boolean
    hiddenColorIndexes?: number[]
  }>(),
  {
    tracingScaleX: 1,
    tracingScaleY: 1,
    tracingDraggable: false,
    hiddenColorIndexes: () => [],
  },
)

const emit = defineEmits<{
  apply: [edits: CellEdit[]]
  pickColor: [colorIndex: number]
  selectionChange: [indexes: number[]]
  pan: [delta: { x: number; y: number }]
  tracingMove: [delta: { x: number; y: number }]
}>()

const canvas = ref<HTMLCanvasElement>()
const draft = new Map<number, number>()
let drawing = false
let lastCell: { x: number; y: number } | undefined
let selecting = false
let selectionStart: GridPoint | undefined
let selectionEnd: GridPoint | undefined
let lassoPoints: GridPoint[] = []
let panning:
  | {
      x: number
      y: number
    }
  | undefined
let tracingDragging:
  | {
      x: number
      y: number
    }
  | undefined
let tracingDragDelta = { x: 0, y: 0 }
let tracingImage: HTMLImageElement | undefined
let tracingLoadToken = 0
let renderFrame: number | undefined

const BASE_CELL_SIZE = 25
const AXIS_SIZE = 30
const cellSize = computed(() => BASE_CELL_SIZE * props.zoom)
const coordinateStep = computed(() => {
  if (cellSize.value >= 18) return 1
  if (cellSize.value >= 11) return 2
  return 5
})
const xCoordinates = computed(() =>
  Array.from(
    { length: Math.ceil(props.pattern.width / coordinateStep.value) },
    (_, index) => index * coordinateStep.value + 1,
  ),
)
const yCoordinates = computed(() =>
  Array.from(
    { length: Math.ceil(props.pattern.height / coordinateStep.value) },
    (_, index) => index * coordinateStep.value + 1,
  ),
)
const boardStyle = computed(() => ({
  width: `${props.pattern.width * cellSize.value + AXIS_SIZE}px`,
  height: `${props.pattern.height * cellSize.value + AXIS_SIZE}px`,
}))

function drawGrid(
  target: HTMLCanvasElement,
  cellSize: number,
  pixelRatio: number,
  viewMode: PatternViewMode,
  showGrid: boolean,
  showGuides: boolean,
  draftCells?: ReadonlyMap<number, number>,
  hiddenColorIndexes?: ReadonlySet<number>,
) {
  const logicalWidth = props.pattern.width * cellSize
  const logicalHeight = props.pattern.height * cellSize
  const backingStore = calculateCanvasBackingStore(
    logicalWidth,
    logicalHeight,
    pixelRatio,
  )
  if (target.width !== backingStore.width) target.width = backingStore.width
  if (target.height !== backingStore.height) target.height = backingStore.height
  const styleWidth = `${logicalWidth}px`
  const styleHeight = `${logicalHeight}px`
  if (target.style.width !== styleWidth) target.style.width = styleWidth
  if (target.style.height !== styleHeight) target.style.height = styleHeight

  const context = target.getContext('2d')
  if (!context) return backingStore.pixelRatio
  context.setTransform(
    backingStore.pixelRatio,
    0,
    0,
    backingStore.pixelRatio,
    0,
    0,
  )
  context.fillStyle = '#fffdf9'
  context.fillRect(0, 0, logicalWidth, logicalHeight)

  for (let index = 0; index < props.pattern.cells.length; index += 1) {
    const colorIndex = draftCells?.get(index) ?? props.pattern.cells[index] ?? 0
    if (colorIndex <= 0) continue
    if (hiddenColorIndexes?.has(colorIndex)) continue
    const color = props.palette.colors[colorIndex - 1]
    if (!color) continue
    const x = (index % props.pattern.width) * cellSize
    const y = Math.floor(index / props.pattern.width) * cellSize
    context.fillStyle = color.hex
    context.fillRect(x, y, cellSize, cellSize)

    if (viewMode === 'construction' && cellSize >= 10) {
      const brightness =
        (color.rgb.r * 299 + color.rgb.g * 587 + color.rgb.b * 114) / 1000
      context.fillStyle = brightness < 135 ? '#ffffff' : '#251e18'
      const fontSize = Math.max(
        6,
        Math.min(
          cellSize * 0.32,
          cellSize / Math.max(1, color.code.length * 0.58),
        ),
      )
      context.font = `700 ${fontSize}px ui-sans-serif, system-ui`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(color.code, x + cellSize / 2, y + cellSize / 2 + 0.5)
    }
  }

  if (viewMode === 'construction' || showGrid) {
    context.beginPath()
    for (let x = 0; x <= props.pattern.width; x += 1) {
      context.moveTo(x * cellSize + 0.5, 0)
      context.lineTo(x * cellSize + 0.5, logicalHeight)
    }
    for (let y = 0; y <= props.pattern.height; y += 1) {
      context.moveTo(0, y * cellSize + 0.5)
      context.lineTo(logicalWidth, y * cellSize + 0.5)
    }
    context.strokeStyle = 'rgb(74 61 49 / 18%)'
    context.lineWidth = 1
    context.stroke()

    context.beginPath()
    for (let x = 0; x <= props.pattern.width; x += 29) {
      context.moveTo(x * cellSize + 0.5, 0)
      context.lineTo(x * cellSize + 0.5, logicalHeight)
    }
    for (let y = 0; y <= props.pattern.height; y += 29) {
      context.moveTo(0, y * cellSize + 0.5)
      context.lineTo(logicalWidth, y * cellSize + 0.5)
    }
    context.strokeStyle = 'rgb(167 53 34 / 62%)'
    context.lineWidth = 1.5
    context.stroke()
  }

  if (showGuides) {
    context.save()
    context.beginPath()
    context.setLineDash([Math.max(4, cellSize * 0.45), cellSize * 0.25])
    context.moveTo((logicalWidth + 1) / 2, 0)
    context.lineTo((logicalWidth + 1) / 2, logicalHeight)
    context.moveTo(0, (logicalHeight + 1) / 2)
    context.lineTo(logicalWidth, (logicalHeight + 1) / 2)
    context.strokeStyle = 'rgb(36 99 161 / 72%)'
    context.lineWidth = Math.max(1.5, cellSize * 0.075)
    context.stroke()
    context.restore()
  }
  return backingStore.pixelRatio
}

function render() {
  if (renderFrame !== undefined) {
    window.cancelAnimationFrame(renderFrame)
    renderFrame = undefined
  }
  if (!canvas.value) return
  const pixelRatio = drawGrid(
    canvas.value,
    BASE_CELL_SIZE * props.zoom,
    window.devicePixelRatio,
    props.viewMode,
    props.showGrid,
    props.showGuides,
    draft,
    new Set(props.hiddenColorIndexes),
  )
  drawTracingOverlay(pixelRatio)
  drawSelection(pixelRatio)
}

function requestRender() {
  if (renderFrame !== undefined) return
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = undefined
    render()
  })
}

function drawTracingOverlay(pixelRatio: number) {
  const target = canvas.value
  const image = tracingImage
  if (!target || !image || !props.tracingVisible) return
  const context = target.getContext('2d')
  if (!context) return
  const size = cellSize.value
  const logicalWidth = props.pattern.width * size
  const logicalHeight = props.pattern.height * size
  const scale = Math.min(
    logicalWidth / image.naturalWidth,
    logicalHeight / image.naturalHeight,
  )
  const width = image.naturalWidth * scale * props.tracingScaleX
  const height = image.naturalHeight * scale * props.tracingScaleY
  const x =
    (logicalWidth - width) / 2 +
    (props.tracingOffsetX + tracingDragDelta.x) * size
  const y =
    (logicalHeight - height) / 2 +
    (props.tracingOffsetY + tracingDragDelta.y) * size

  context.save()
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.beginPath()
  context.rect(0, 0, logicalWidth, logicalHeight)
  context.clip()
  context.globalAlpha = props.tracingOpacity
  context.drawImage(image, x, y, width, height)
  context.restore()
}

function loadTracingImage(url: string) {
  const token = ++tracingLoadToken
  tracingImage = undefined
  if (!url) {
    render()
    return
  }
  const image = new Image()
  image.onload = () => {
    if (token !== tracingLoadToken) return
    tracingImage = image
    render()
  }
  image.onerror = () => {
    if (token !== tracingLoadToken) return
    tracingImage = undefined
    render()
  }
  image.src = url
}

function drawSelection(pixelRatio: number) {
  const target = canvas.value
  if (!target) return
  const size = cellSize.value
  const context = target.getContext('2d')
  if (!context) return
  context.save()
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  if (!selecting && props.selection.length > 0) {
    const selected = new Set(props.selection)
    context.fillStyle = 'rgb(42 103 216 / 18%)'
    selected.forEach((index) => {
      const x = index % props.pattern.width
      const y = Math.floor(index / props.pattern.width)
      context.fillRect(x * size, y * size, size, size)
    })

    context.beginPath()
    selected.forEach((index) => {
      const x = index % props.pattern.width
      const y = Math.floor(index / props.pattern.width)
      const left = x * size
      const top = y * size
      if (!selected.has(index - props.pattern.width)) {
        context.moveTo(left, top)
        context.lineTo(left + size, top)
      }
      if (x === props.pattern.width - 1 || !selected.has(index + 1)) {
        context.moveTo(left + size, top)
        context.lineTo(left + size, top + size)
      }
      if (
        y === props.pattern.height - 1 ||
        !selected.has(index + props.pattern.width)
      ) {
        context.moveTo(left + size, top + size)
        context.lineTo(left, top + size)
      }
      if (x === 0 || !selected.has(index - 1)) {
        context.moveTo(left, top + size)
        context.lineTo(left, top)
      }
    })
    context.setLineDash([Math.max(3, size * 0.28), Math.max(2, size * 0.18)])
    context.strokeStyle = '#2563d8'
    context.lineWidth = Math.max(1.5, size * 0.08)
    context.stroke()
  }

  if (
    selecting &&
    props.selectionMode === 'rectangle' &&
    selectionStart &&
    selectionEnd
  ) {
    const startX = Math.floor(Math.min(selectionStart.x, selectionEnd.x))
    const endX = Math.floor(Math.max(selectionStart.x, selectionEnd.x))
    const startY = Math.floor(Math.min(selectionStart.y, selectionEnd.y))
    const endY = Math.floor(Math.max(selectionStart.y, selectionEnd.y))
    const left = startX * size
    const top = startY * size
    const width = (endX - startX + 1) * size
    const height = (endY - startY + 1) * size
    context.fillStyle = 'rgb(42 103 216 / 18%)'
    context.fillRect(left, top, width, height)
    context.setLineDash([Math.max(3, size * 0.28), Math.max(2, size * 0.18)])
    context.strokeStyle = '#2563d8'
    context.lineWidth = Math.max(1.5, size * 0.08)
    context.strokeRect(left, top, width, height)
  }

  if (selecting && props.selectionMode === 'lasso' && lassoPoints.length > 1) {
    context.beginPath()
    context.moveTo(lassoPoints[0]!.x * size, lassoPoints[0]!.y * size)
    lassoPoints.slice(1).forEach((point) => {
      context.lineTo(point.x * size, point.y * size)
    })
    context.closePath()
    context.fillStyle = 'rgb(42 103 216 / 14%)'
    context.fill()
    context.setLineDash([Math.max(3, size * 0.28), Math.max(2, size * 0.18)])
    context.strokeStyle = '#2563d8'
    context.lineWidth = Math.max(1.5, size * 0.08)
    context.stroke()
  }
  context.restore()
}

function getCell(event: PointerEvent) {
  const target = canvas.value
  if (!target) return undefined
  const bounds = target.getBoundingClientRect()
  const cellSize = BASE_CELL_SIZE * props.zoom
  const x = Math.floor((event.clientX - bounds.left) / cellSize)
  const y = Math.floor((event.clientY - bounds.top) / cellSize)
  if (x < 0 || y < 0 || x >= props.pattern.width || y >= props.pattern.height) {
    return undefined
  }
  return { x, y, index: y * props.pattern.width + x }
}

function getGridPoint(event: PointerEvent): GridPoint | undefined {
  const target = canvas.value
  if (!target) return undefined
  const bounds = target.getBoundingClientRect()
  const x = Math.min(
    props.pattern.width - Number.EPSILON,
    Math.max(0, (event.clientX - bounds.left) / cellSize.value),
  )
  const y = Math.min(
    props.pattern.height - Number.EPSILON,
    Math.max(0, (event.clientY - bounds.top) / cellSize.value),
  )
  return { x, y }
}

function paintCell(x: number, y: number) {
  const index = y * props.pattern.width + x
  const value = props.tool === 'eraser' ? 0 : props.selectedColor
  if ((draft.get(index) ?? props.pattern.cells[index]) === value) return
  draft.set(index, value)
}

function paintLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  let x = from.x
  let y = from.y
  const dx = Math.abs(to.x - from.x)
  const dy = -Math.abs(to.y - from.y)
  const stepX = from.x < to.x ? 1 : -1
  const stepY = from.y < to.y ? 1 : -1
  let error = dx + dy

  while (true) {
    paintCell(x, y)
    if (x === to.x && y === to.y) break
    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += stepX
    }
    if (doubled <= dx) {
      error += dx
      y += stepY
    }
  }
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 1) return
  if (event.button === 0 && props.tracingDraggable && props.tracingVisible) {
    tracingDragging = { x: event.clientX, y: event.clientY }
    tracingDragDelta = { x: 0, y: 0 }
    canvas.value?.setPointerCapture(event.pointerId)
    return
  }
  if (props.tool === 'move' || event.button === 1) {
    panning = { x: event.clientX, y: event.clientY }
    canvas.value?.setPointerCapture(event.pointerId)
    return
  }
  const cell = getCell(event)
  if (!cell) return

  if (props.tool === 'picker' || event.altKey) {
    const colorIndex = props.pattern.cells[cell.index] ?? 0
    if (colorIndex > 0) emit('pickColor', colorIndex)
    return
  }

  if (props.tool === 'select') {
    const point = getGridPoint(event)
    if (!point) return
    selecting = true
    selectionStart = point
    selectionEnd = point
    lassoPoints = [point]
    canvas.value?.setPointerCapture(event.pointerId)
    requestRender()
    return
  }

  drawing = true
  lastCell = cell
  canvas.value?.setPointerCapture(event.pointerId)
  paintCell(cell.x, cell.y)
  requestRender()
}

function handlePointerMove(event: PointerEvent) {
  if (tracingDragging) {
    tracingDragDelta = {
      x: (event.clientX - tracingDragging.x) / cellSize.value,
      y: (event.clientY - tracingDragging.y) / cellSize.value,
    }
    requestRender()
    return
  }
  if (panning) {
    const x = event.clientX
    const y = event.clientY
    emit('pan', { x: panning.x - x, y: panning.y - y })
    panning = { x, y }
    return
  }
  if (selecting) {
    const point = getGridPoint(event)
    if (!point) return
    selectionEnd = point
    if (props.selectionMode === 'lasso') {
      const previous = lassoPoints.at(-1)
      if (
        !previous ||
        Math.hypot(point.x - previous.x, point.y - previous.y) >= 0.16
      ) {
        lassoPoints.push(point)
      }
    }
    requestRender()
    return
  }
  if (!drawing) return
  const cell = getCell(event)
  if (!cell) return
  if (lastCell) paintLine(lastCell, cell)
  lastCell = cell
  requestRender()
}

function commitInteraction() {
  if (tracingDragging) {
    const delta = tracingDragDelta
    tracingDragging = undefined
    tracingDragDelta = { x: 0, y: 0 }
    if (delta.x || delta.y) emit('tracingMove', delta)
    requestRender()
    return
  }
  if (panning) {
    panning = undefined
    return
  }
  if (selecting) {
    selecting = false
    const indexes =
      props.selectionMode === 'rectangle' && selectionStart && selectionEnd
        ? rectangleSelection(
            props.pattern.width,
            props.pattern.height,
            selectionStart,
            selectionEnd,
          )
        : lassoSelection(props.pattern.width, props.pattern.height, lassoPoints)
    selectionStart = undefined
    selectionEnd = undefined
    lassoPoints = []
    emit('selectionChange', indexes)
    requestRender()
    return
  }
  if (!drawing) return
  drawing = false
  const edits = [...draft.entries()].map(([index, after]) => ({
    index,
    before: props.pattern.cells[index] ?? 0,
    after,
  }))
  draft.clear()
  lastCell = undefined
  emit('apply', edits)
}

async function exportPng(
  viewMode: PatternViewMode,
  showGrid = true,
  showGuides = false,
): Promise<CanvasExportResult> {
  const desiredCellSize = 36
  const exportCellSize = calculateCanvasExportCellSize(
    props.pattern.width,
    props.pattern.height,
    desiredCellSize,
  )
  const exportCanvas = document.createElement('canvas')
  drawGrid(exportCanvas, exportCellSize, 1, viewMode, showGrid, showGuides)
  return new Promise((resolve, reject) => {
    exportCanvas.toBlob((blob) => {
      if (blob) resolve({ blob, cellSize: exportCellSize })
      else reject(new Error('无法生成 PNG 图纸。'))
    }, 'image/png')
  })
}

defineExpose({ exportPng })

watch(
  () => [
    props.revision,
    props.zoom,
    props.pattern.width,
    props.pattern.height,
    props.viewMode,
    props.showGrid,
    props.showGuides,
    props.selection,
    props.selectionMode,
    props.tracingVisible,
    props.tracingOpacity,
    props.tracingOffsetX,
    props.tracingOffsetY,
    props.tracingScaleX,
    props.tracingScaleY,
    props.hiddenColorIndexes,
  ],
  () => nextTick(requestRender),
)
watch(() => props.tracingImageUrl, loadTracingImage, { immediate: true })
onMounted(render)
onBeforeUnmount(() => {
  if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame)
})
</script>

<template>
  <div class="pattern-board" :style="boardStyle">
    <div class="axis-corner" aria-hidden="true"><span>Y</span><b>X</b></div>
    <div class="x-axis" aria-label="X 坐标">
      <span
        v-for="coordinate in xCoordinates"
        :key="coordinate"
        :style="{
          left: `${(coordinate - 1) * cellSize}px`,
          width: `${coordinateStep * cellSize}px`,
        }"
      >
        {{ coordinate }}
      </span>
    </div>
    <div class="y-axis" aria-label="Y 坐标">
      <span
        v-for="coordinate in yCoordinates"
        :key="coordinate"
        :style="{
          top: `${(coordinate - 1) * cellSize}px`,
          height: `${coordinateStep * cellSize}px`,
        }"
      >
        {{ coordinate }}
      </span>
    </div>
    <canvas
      ref="canvas"
      class="pattern-canvas"
      :class="{
        'is-moving': tool === 'move',
        'is-tracing-moving': tracingDraggable && tracingVisible,
        'is-picker': tool === 'picker',
        'is-selecting': tool === 'select',
      }"
      aria-label="拼豆图纸画布"
      tabindex="0"
      @contextmenu.prevent
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="commitInteraction"
      @pointercancel="commitInteraction"
    />
  </div>
</template>

<style scoped>
.pattern-board {
  position: relative;
  flex: none;
  scroll-margin-top: 150px;
  color: #67594e;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.63rem;
  font-variant-numeric: tabular-nums;
}

.axis-corner,
.x-axis,
.y-axis {
  position: absolute;
  background: #f3eee7;
  user-select: none;
}

.axis-corner {
  top: 0;
  left: 0;
  width: 30px;
  height: 30px;
  border-right: 1px solid #d6cabd;
  border-bottom: 1px solid #d6cabd;
}

.axis-corner::after {
  position: absolute;
  top: 14px;
  left: 3px;
  width: 24px;
  height: 1px;
  background: #c6b9ac;
  content: '';
  transform: rotate(45deg);
}

.axis-corner span,
.axis-corner b {
  position: absolute;
  z-index: 1;
  font-size: 0.55rem;
}

.axis-corner span {
  bottom: 2px;
  left: 4px;
}

.axis-corner b {
  top: 2px;
  right: 4px;
}

.x-axis {
  top: 0;
  left: 30px;
  width: calc(100% - 30px);
  height: 30px;
  overflow: hidden;
  border-bottom: 1px solid #d6cabd;
}

.y-axis {
  top: 30px;
  left: 0;
  width: 30px;
  height: calc(100% - 30px);
  overflow: hidden;
  border-right: 1px solid #d6cabd;
}

.x-axis span,
.y-axis span {
  position: absolute;
  display: grid;
  place-items: center;
  box-sizing: border-box;
}

.x-axis span {
  top: 0;
  height: 30px;
  border-right: 1px solid rgb(88 72 59 / 12%);
}

.y-axis span {
  left: 0;
  width: 30px;
  border-bottom: 1px solid rgb(88 72 59 / 12%);
}

.pattern-canvas {
  position: absolute;
  top: 30px;
  left: 30px;
  display: block;
  border-radius: 0 0 12px;
  box-shadow: 0 12px 48px rgb(61 45 30 / 14%);
  cursor: crosshair;
  touch-action: none;
  user-select: none;
  scroll-margin-top: 150px;
}

.pattern-canvas:focus-visible {
  outline: 3px solid rgb(203 75 50 / 35%);
  outline-offset: 4px;
}

.pattern-canvas.is-picker {
  cursor: copy;
}

.pattern-canvas.is-moving {
  cursor: grab;
}

.pattern-canvas.is-moving:active {
  cursor: grabbing;
}

.pattern-canvas.is-tracing-moving {
  cursor: move;
}

.pattern-canvas.is-tracing-moving:active {
  cursor: grabbing;
}

.pattern-canvas.is-selecting {
  cursor: cell;
}
</style>
