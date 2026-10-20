<script setup lang="ts">
import { computed, ref } from 'vue'

import type { GridCalibration } from './types'

const props = defineProps<{
  src: string
  modelValue: GridCalibration
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GridCalibration]
}>()

type BoundaryKey = 'left' | 'right' | 'top' | 'bottom'

const overlay = ref<SVGSVGElement>()
const draggingBoundary = ref<BoundaryKey>()
const dragPointerId = ref<number>()

const verticalLines = computed(() =>
  Array.from({ length: props.modelValue.columns + 1 }, (_, index) => ({
    position:
      props.modelValue.left +
      ((100 - props.modelValue.left - props.modelValue.right) * index) /
        props.modelValue.columns,
    major: index % 10 === 0,
  })),
)
const horizontalLines = computed(() =>
  Array.from({ length: props.modelValue.rows + 1 }, (_, index) => ({
    position:
      props.modelValue.top +
      ((100 - props.modelValue.top - props.modelValue.bottom) * index) /
        props.modelValue.rows,
    major: index % 10 === 0,
  })),
)

function updateBoundary(key: BoundaryKey, event: Event) {
  setBoundary(key, Number((event.target as HTMLInputElement).value))
}

function setBoundary(key: BoundaryKey, value: number) {
  const normalized = Math.round(Math.max(0, Math.min(25, value)) * 10) / 10
  emit('update:modelValue', { ...props.modelValue, [key]: normalized })
}

function updateFromPointer(key: BoundaryKey, event: PointerEvent) {
  const element = overlay.value
  if (!element) return
  const bounds = element.getBoundingClientRect()
  const x = ((event.clientX - bounds.left) / bounds.width) * 100
  const y = ((event.clientY - bounds.top) / bounds.height) * 100
  const value =
    key === 'left' ? x : key === 'right' ? 100 - x : key === 'top' ? y : 100 - y
  setBoundary(key, value)
}

function beginBoundaryDrag(key: BoundaryKey, event: PointerEvent) {
  event.preventDefault()
  draggingBoundary.value = key
  dragPointerId.value = event.pointerId
  overlay.value?.setPointerCapture(event.pointerId)
  updateFromPointer(key, event)
}

function moveBoundary(event: PointerEvent) {
  if (!draggingBoundary.value || dragPointerId.value !== event.pointerId) return
  updateFromPointer(draggingBoundary.value, event)
}

function endBoundaryDrag(event: PointerEvent) {
  if (dragPointerId.value !== event.pointerId) return
  if (overlay.value?.hasPointerCapture(event.pointerId)) {
    overlay.value.releasePointerCapture(event.pointerId)
  }
  draggingBoundary.value = undefined
  dragPointerId.value = undefined
}
</script>

<template>
  <section class="calibration-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">STEP 2</p>
        <h2>校准网格边界</h2>
      </div>
      <span>{{ modelValue.columns }} × {{ modelValue.rows }}</span>
    </div>

    <div class="calibration-dock">
      <p class="calibration-help">
        <strong>直接拖动图上的蓝色外框</strong>
        <span>，或使用滑块精细调整；控制栏会始终保持可见。</span>
      </p>
      <div class="boundary-controls">
        <label>
          <span>左边界 {{ modelValue.left.toFixed(1) }}%</span>
          <input
            :value="modelValue.left"
            aria-label="左边界"
            type="range"
            min="0"
            max="25"
            step="0.1"
            @input="updateBoundary('left', $event)"
          />
        </label>
        <label>
          <span>右边界 {{ modelValue.right.toFixed(1) }}%</span>
          <input
            :value="modelValue.right"
            aria-label="右边界"
            type="range"
            min="0"
            max="25"
            step="0.1"
            @input="updateBoundary('right', $event)"
          />
        </label>
        <label>
          <span>上边界 {{ modelValue.top.toFixed(1) }}%</span>
          <input
            :value="modelValue.top"
            aria-label="上边界"
            type="range"
            min="0"
            max="25"
            step="0.1"
            @input="updateBoundary('top', $event)"
          />
        </label>
        <label>
          <span>下边界 {{ modelValue.bottom.toFixed(1) }}%</span>
          <input
            :value="modelValue.bottom"
            aria-label="下边界"
            type="range"
            min="0"
            max="25"
            step="0.1"
            @input="updateBoundary('bottom', $event)"
          />
        </label>
      </div>
    </div>

    <div
      class="calibration-stage"
      :class="{ 'is-dragging': draggingBoundary }"
      role="group"
      aria-label="网格校准预览"
    >
      <img :src="src" alt="待重建的模糊图纸" />
      <svg
        ref="overlay"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        @pointermove="moveBoundary"
        @pointerup="endBoundaryDrag"
        @pointercancel="endBoundaryDrag"
      >
        <rect
          :x="modelValue.left"
          :y="modelValue.top"
          :width="100 - modelValue.left - modelValue.right"
          :height="100 - modelValue.top - modelValue.bottom"
          class="grid-area"
        />
        <line
          v-for="(line, index) in verticalLines"
          :key="`v-${index}`"
          :x1="line.position"
          :x2="line.position"
          :y1="modelValue.top"
          :y2="100 - modelValue.bottom"
          :class="{ major: line.major }"
        />
        <line
          v-for="(line, index) in horizontalLines"
          :key="`h-${index}`"
          :x1="modelValue.left"
          :x2="100 - modelValue.right"
          :y1="line.position"
          :y2="line.position"
          :class="{ major: line.major }"
        />
        <g class="drag-boundaries">
          <line
            class="boundary-hit vertical"
            data-boundary="left"
            :x1="modelValue.left"
            :x2="modelValue.left"
            :y1="modelValue.top"
            :y2="100 - modelValue.bottom"
            @pointerdown="beginBoundaryDrag('left', $event)"
          />
          <line
            class="boundary-hit vertical"
            data-boundary="right"
            :x1="100 - modelValue.right"
            :x2="100 - modelValue.right"
            :y1="modelValue.top"
            :y2="100 - modelValue.bottom"
            @pointerdown="beginBoundaryDrag('right', $event)"
          />
          <line
            class="boundary-hit horizontal"
            data-boundary="top"
            :x1="modelValue.left"
            :x2="100 - modelValue.right"
            :y1="modelValue.top"
            :y2="modelValue.top"
            @pointerdown="beginBoundaryDrag('top', $event)"
          />
          <line
            class="boundary-hit horizontal"
            data-boundary="bottom"
            :x1="modelValue.left"
            :x2="100 - modelValue.right"
            :y1="100 - modelValue.bottom"
            :y2="100 - modelValue.bottom"
            @pointerdown="beginBoundaryDrag('bottom', $event)"
          />
          <rect
            :x="modelValue.left"
            :y="modelValue.top"
            :width="100 - modelValue.left - modelValue.right"
            :height="100 - modelValue.top - modelValue.bottom"
            class="draggable-outline"
          />
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.calibration-panel {
  padding: clamp(20px, 2.6vw, 32px);
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.panel-heading > span {
  padding: 6px 9px;
  border-radius: 999px;
  color: var(--sage-dark);
  background: var(--sage-pale);
  font-size: 0.68rem;
  font-weight: 800;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--sage-dark);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.17em;
}

h2 {
  margin: 0;
  font-size: 1.15rem;
}

.calibration-stage {
  position: relative;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #eee8e5;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 54%);
}

.calibration-stage img {
  display: block;
  width: 100%;
  height: auto;
}

.calibration-stage svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.calibration-stage.is-dragging,
.calibration-stage.is-dragging * {
  cursor: grabbing !important;
  user-select: none;
}

.calibration-stage line {
  stroke: rgb(35 113 176 / 38%);
  stroke-width: 0.09;
  vector-effect: non-scaling-stroke;
}

.calibration-stage line.major {
  stroke: rgb(146 77 86 / 76%);
  stroke-width: 0.22;
}

.grid-area {
  fill: rgb(69 141 194 / 5%);
  stroke: #2771b0;
  stroke-width: 0.32;
  vector-effect: non-scaling-stroke;
}

.calibration-dock {
  position: sticky;
  z-index: 4;
  top: 88px;
  margin-bottom: 16px;
  padding: 13px 15px;
  border: 1px solid rgb(202 183 178 / 82%);
  border-radius: 16px;
  background: rgb(255 250 249 / 94%);
  box-shadow: 0 10px 26px rgb(73 48 43 / 12%);
  backdrop-filter: blur(12px);
}

.calibration-help {
  margin: 0 0 11px;
  color: var(--text-muted);
  font-size: 0.72rem;
  line-height: 1.6;
}

.calibration-help strong {
  color: var(--sage-dark);
}

.boundary-controls {
  display: grid;
  grid-template-columns: repeat(4, minmax(130px, 1fr));
  gap: 12px 18px;
}

.boundary-controls label {
  display: grid;
  gap: 5px;
}

.boundary-controls span {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
}

.boundary-controls input {
  width: 100%;
  accent-color: var(--accent);
}

.boundary-hit {
  stroke: transparent !important;
  stroke-width: 14 !important;
  vector-effect: non-scaling-stroke;
  pointer-events: stroke;
  touch-action: none;
}

.boundary-hit.vertical {
  cursor: col-resize;
}

.boundary-hit.horizontal {
  cursor: row-resize;
}

.draggable-outline {
  fill: none;
  stroke: #176ca7;
  stroke-width: 0.5;
  vector-effect: non-scaling-stroke;
  pointer-events: none;
  filter: drop-shadow(0 0 1px rgb(255 255 255 / 90%));
}

@media (max-width: 1180px) {
  .boundary-controls {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .calibration-panel {
    padding: 16px;
  }

  .calibration-dock {
    top: 72px;
    margin-inline: -4px;
    padding: 11px;
  }
}
</style>
