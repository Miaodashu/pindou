<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { BeadPalette } from '@/domain/palette/types'

export type PatternPreviewMode = 'grid' | 'codes' | 'beads' | 'boards'

const props = defineProps<{
  width: number
  height: number
  cells: number[]
  palette: BeadPalette
  mode: PatternPreviewMode
}>()

const host = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const hoverColorIndex = ref<number>()
let observer: ResizeObserver | undefined

const hoverSummary = computed(() => {
  const colorIndex = hoverColorIndex.value
  if (colorIndex === undefined) return undefined
  return {
    label:
      colorIndex === 0
        ? '透明背景'
        : props.palette.colors[colorIndex - 1]?.code,
    count: props.cells.filter((cell) => cell === colorIndex).length,
  }
})

function render() {
  const target = canvas.value
  const container = host.value
  if (!target || !container) return
  const bounds = container.getBoundingClientRect()
  const availableWidth = Math.max(1, bounds.width)
  const availableHeight = Math.max(1, bounds.height)
  const cellSize = Math.max(
    1,
    Math.min(availableWidth / props.width, availableHeight / props.height),
  )
  const logicalWidth = props.width * cellSize
  const logicalHeight = props.height * cellSize
  const ratio = window.devicePixelRatio || 1
  target.width = Math.max(1, Math.round(logicalWidth * ratio))
  target.height = Math.max(1, Math.round(logicalHeight * ratio))
  target.style.width = `${logicalWidth}px`
  target.style.height = `${logicalHeight}px`

  const context = target.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.fillStyle = '#fffdf9'
  context.fillRect(0, 0, logicalWidth, logicalHeight)

  props.cells.forEach((colorIndex, index) => {
    if (colorIndex <= 0) return
    const color = props.palette.colors[colorIndex - 1]
    if (!color) return
    const x = (index % props.width) * cellSize
    const y = Math.floor(index / props.width) * cellSize

    if (props.mode === 'beads') {
      const radius = cellSize * 0.43
      context.beginPath()
      context.arc(x + cellSize / 2, y + cellSize / 2, radius, 0, Math.PI * 2)
      context.fillStyle = color.hex
      context.fill()
      context.beginPath()
      context.arc(
        x + cellSize / 2,
        y + cellSize / 2,
        Math.max(0.7, radius * 0.22),
        0,
        Math.PI * 2,
      )
      context.fillStyle = '#fffdf9'
      context.fill()
      return
    }

    context.fillStyle = color.hex
    context.fillRect(x, y, cellSize, cellSize)
    if (props.mode === 'codes' && cellSize >= 12) {
      const brightness =
        (color.rgb.r * 299 + color.rgb.g * 587 + color.rgb.b * 114) / 1000
      context.fillStyle = brightness < 135 ? '#fff' : '#211c18'
      context.font = `700 ${Math.max(7, cellSize * 0.34)}px ui-sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(color.code, x + cellSize / 2, y + cellSize / 2)
    }
  })

  if (props.mode !== 'beads') {
    context.beginPath()
    for (let x = 0; x <= props.width; x += 1) {
      context.moveTo(x * cellSize + 0.5, 0)
      context.lineTo(x * cellSize + 0.5, logicalHeight)
    }
    for (let y = 0; y <= props.height; y += 1) {
      context.moveTo(0, y * cellSize + 0.5)
      context.lineTo(logicalWidth, y * cellSize + 0.5)
    }
    context.strokeStyle = 'rgb(57 49 43 / 18%)'
    context.lineWidth = 1
    context.stroke()
  }

  if (props.mode === 'boards') {
    context.beginPath()
    for (let x = 0; x <= props.width; x += 29) {
      context.moveTo(x * cellSize + 0.5, 0)
      context.lineTo(x * cellSize + 0.5, logicalHeight)
    }
    for (let y = 0; y <= props.height; y += 29) {
      context.moveTo(0, y * cellSize + 0.5)
      context.lineTo(logicalWidth, y * cellSize + 0.5)
    }
    context.strokeStyle = '#b64639'
    context.lineWidth = 2
    context.stroke()
  }

  if (hoverColorIndex.value !== undefined) {
    context.save()
    props.cells.forEach((colorIndex, index) => {
      const x = (index % props.width) * cellSize
      const y = Math.floor(index / props.width) * cellSize
      if (colorIndex !== hoverColorIndex.value) {
        context.fillStyle = 'rgb(255 253 249 / 68%)'
        context.fillRect(x, y, cellSize, cellSize)
        return
      }
      context.strokeStyle = '#9b6110'
      context.lineWidth = Math.max(1.5, cellSize * 0.12)
      context.strokeRect(
        x + context.lineWidth / 2,
        y + context.lineWidth / 2,
        Math.max(0, cellSize - context.lineWidth),
        Math.max(0, cellSize - context.lineWidth),
      )
    })
    context.restore()
  }
}

function updateHover(event: PointerEvent) {
  const target = canvas.value
  if (!target) return
  const bounds = target.getBoundingClientRect()
  const x = Math.floor(
    ((event.clientX - bounds.left) / bounds.width) * props.width,
  )
  const y = Math.floor(
    ((event.clientY - bounds.top) / bounds.height) * props.height,
  )
  if (x < 0 || y < 0 || x >= props.width || y >= props.height) {
    hoverColorIndex.value = undefined
    return
  }
  hoverColorIndex.value = props.cells[y * props.width + x] ?? 0
}

function clearHover() {
  hoverColorIndex.value = undefined
}

watch(
  () => [
    props.width,
    props.height,
    props.cells,
    props.mode,
    props.palette,
    hoverColorIndex.value,
  ],
  () => nextTick(render),
  { deep: true },
)

onMounted(() => {
  if (host.value) {
    observer = new ResizeObserver(render)
    observer.observe(host.value)
  }
  render()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="host" class="pattern-preview">
    <canvas
      ref="canvas"
      aria-label="生成图纸预览"
      @pointermove="updateHover"
      @pointerleave="clearHover"
    />
    <Transition name="hover-label">
      <div v-if="hoverSummary" class="hover-summary" role="status">
        <strong>{{ hoverSummary.label }}</strong>
        <span>{{ hoverSummary.count }} 格同色区域</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pattern-preview {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 320px;
  place-items: center;
  overflow: hidden;
  border-radius: 14px;
  background: #d7d1d1;
}

canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  box-shadow: 0 10px 36px rgb(45 34 31 / 12%);
  cursor: crosshair;
}

.hover-summary {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid rgb(137 96 35 / 22%);
  border-radius: 10px;
  color: #51370f;
  background: rgb(255 248 225 / 94%);
  box-shadow: 0 8px 24px rgb(49 36 23 / 14%);
  font-size: 0.7rem;
  pointer-events: none;
}

.hover-label-enter-active,
.hover-label-leave-active {
  transition: opacity 120ms ease;
}

.hover-label-enter-from,
.hover-label-leave-to {
  opacity: 0;
}
</style>
