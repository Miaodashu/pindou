<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { BeadPalette } from '@/domain/palette/types'
import type { PatternDocument } from '@/domain/pattern/types'

const props = defineProps<{
  pattern: PatternDocument
  palette: BeadPalette
  confidence: number[]
  uncertainCells: number[]
  revision: number
}>()

const emit = defineEmits<{
  updateCell: [index: number, colorIndex: number]
}>()

const canvas = ref<HTMLCanvasElement>()
const selectedIndex = ref<number>()
const showCodes = ref(true)
const showUncertain = ref(true)
const cellSize = ref(22)
let resizeObserver: ResizeObserver | undefined

const uncertainSet = computed(() => new Set(props.uncertainCells))
const selectedColor = computed(() => {
  if (selectedIndex.value === undefined) return undefined
  const colorIndex = props.pattern.cells[selectedIndex.value] ?? 0
  return colorIndex > 0 ? props.palette.colors[colorIndex - 1] : undefined
})
const selectedCoordinates = computed(() => {
  if (selectedIndex.value === undefined) return undefined
  return {
    x: (selectedIndex.value % props.pattern.width) + 1,
    y: Math.floor(selectedIndex.value / props.pattern.width) + 1,
  }
})

function render() {
  const target = canvas.value
  if (!target) return
  const margin = 28
  const width = margin + props.pattern.width * cellSize.value + 1
  const height = margin + props.pattern.height * cellSize.value + 1
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1)
  target.style.width = `${width}px`
  target.style.height = `${height}px`
  target.width = Math.round(width * pixelRatio)
  target.height = Math.round(height * pixelRatio)
  const context = target.getContext('2d')
  if (!context) return
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.fillStyle = '#fffdfd'
  context.fillRect(0, 0, width, height)
  context.font = '600 7px Montserrat, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  props.pattern.cells.forEach((colorIndex, index) => {
    const column = index % props.pattern.width
    const row = Math.floor(index / props.pattern.width)
    const x = margin + column * cellSize.value
    const y = margin + row * cellSize.value
    const color =
      colorIndex > 0 ? props.palette.colors[colorIndex - 1] : undefined
    context.fillStyle = color?.hex ?? '#ffffff'
    context.fillRect(x, y, cellSize.value, cellSize.value)
    if (color && showCodes.value && cellSize.value >= 18) {
      const luminance =
        color.rgb.r * 0.299 + color.rgb.g * 0.587 + color.rgb.b * 0.114
      context.fillStyle = luminance < 135 ? '#ffffff' : '#2d3436'
      context.fillText(
        color.code,
        x + cellSize.value / 2,
        y + cellSize.value / 2,
      )
    }
    if (showUncertain.value && uncertainSet.value.has(index)) {
      context.strokeStyle = '#d13f4d'
      context.lineWidth = 2
      context.strokeRect(x + 1, y + 1, cellSize.value - 2, cellSize.value - 2)
    }
    if (selectedIndex.value === index) {
      context.strokeStyle = '#2771b0'
      context.lineWidth = 3
      context.strokeRect(
        x + 1.5,
        y + 1.5,
        cellSize.value - 3,
        cellSize.value - 3,
      )
    }
  })

  for (let column = 0; column <= props.pattern.width; column += 1) {
    const x = margin + column * cellSize.value
    context.strokeStyle = column % 10 === 0 ? '#c84f5a' : '#ded6d6'
    context.lineWidth = column % 10 === 0 ? 1.4 : 0.6
    context.beginPath()
    context.moveTo(x, margin)
    context.lineTo(x, height)
    context.stroke()
    if (column < props.pattern.width) {
      context.fillStyle = '#62686a'
      context.fillText(String(column + 1), x + cellSize.value / 2, margin / 2)
    }
  }
  for (let row = 0; row <= props.pattern.height; row += 1) {
    const y = margin + row * cellSize.value
    context.strokeStyle = row % 10 === 0 ? '#c84f5a' : '#ded6d6'
    context.lineWidth = row % 10 === 0 ? 1.4 : 0.6
    context.beginPath()
    context.moveTo(margin, y)
    context.lineTo(width, y)
    context.stroke()
    if (row < props.pattern.height) {
      context.fillStyle = '#62686a'
      context.fillText(String(row + 1), margin / 2, y + cellSize.value / 2)
    }
  }
}

function selectCell(event: MouseEvent) {
  const target = canvas.value
  if (!target) return
  const bounds = target.getBoundingClientRect()
  const x = event.clientX - bounds.left - 28
  const y = event.clientY - bounds.top - 28
  const column = Math.floor(x / cellSize.value)
  const row = Math.floor(y / cellSize.value)
  if (
    column < 0 ||
    row < 0 ||
    column >= props.pattern.width ||
    row >= props.pattern.height
  )
    return
  selectedIndex.value = row * props.pattern.width + column
  render()
}

function updateSelected(event: Event) {
  if (selectedIndex.value === undefined) return
  emit(
    'updateCell',
    selectedIndex.value,
    Number((event.target as HTMLSelectElement).value),
  )
}

watch(
  () => [props.revision, showCodes.value, showUncertain.value, cellSize.value],
  () => nextTick(render),
)
watch(
  () => [props.pattern.width, props.pattern.height],
  () => {
    selectedIndex.value = undefined
    nextTick(render)
  },
)

onMounted(() => {
  if (canvas.value) {
    resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(canvas.value)
  }
  render()
})
onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <section class="preview-panel">
    <div class="preview-toolbar">
      <div>
        <p class="eyebrow">CLEAR RESULT</p>
        <h2>清晰重建结果</h2>
      </div>
      <div class="view-controls">
        <label><input v-model="showCodes" type="checkbox" />色号</label>
        <label><input v-model="showUncertain" type="checkbox" />待确认格</label>
        <label>
          缩放
          <input
            v-model.number="cellSize"
            type="range"
            min="12"
            max="36"
            step="2"
          />
        </label>
      </div>
    </div>

    <div class="canvas-scroll">
      <canvas ref="canvas" aria-label="高清重建图纸" @click="selectCell" />
    </div>

    <div v-if="selectedCoordinates" class="cell-inspector">
      <div>
        <span>当前格</span>
        <strong
          >X{{ selectedCoordinates.x }} · Y{{ selectedCoordinates.y }}</strong
        >
      </div>
      <div>
        <span>识别置信度</span>
        <strong
          >{{ Math.round((confidence[selectedIndex!] ?? 0) * 100) }}%</strong
        >
      </div>
      <label>
        修正色号
        <select
          :value="pattern.cells[selectedIndex!] ?? 0"
          @change="updateSelected"
        >
          <option :value="0">留空</option>
          <option
            v-for="(color, index) in palette.colors"
            :key="color.id"
            :value="index + 1"
          >
            {{ color.code }} · {{ color.name }}
          </option>
        </select>
      </label>
      <span v-if="selectedColor" class="selected-swatch">
        <i :style="{ backgroundColor: selectedColor.hex }" />
        {{ selectedColor.code }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.preview-panel {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow-medium);
}

.preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  margin: 0 0 3px;
  color: var(--sage-dark);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

h2 {
  margin: 0;
  font-size: 1rem;
}

.view-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.view-controls label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.view-controls input {
  accent-color: var(--accent);
}

.canvas-scroll {
  max-height: 68vh;
  padding: 28px;
  overflow: auto;
  background: #e8dfdc;
}

canvas {
  display: block;
  margin: 0 auto;
  background: white;
  box-shadow: 0 12px 34px rgb(58 40 42 / 14%);
  cursor: crosshair;
}

.cell-inspector {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 18px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.cell-inspector > div,
.cell-inspector label {
  display: grid;
  gap: 4px;
}

.cell-inspector span,
.cell-inspector label {
  color: var(--text-muted);
  font-size: 0.66rem;
}

.cell-inspector select {
  min-width: 190px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fffafa;
}

.selected-swatch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border-radius: 999px;
  background: var(--surface-muted);
  font-weight: 800;
}

.selected-swatch i {
  width: 16px;
  height: 16px;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 50%;
}
</style>
