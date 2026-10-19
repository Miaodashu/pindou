<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  calculateImagePlacement,
  type ImageCropSettings,
} from './rasterizeImage'

const props = defineProps<{
  src: string
  targetWidth: number
  targetHeight: number
  modelValue: ImageCropSettings
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ImageCropSettings]
}>()

const canvas = ref<HTMLCanvasElement>()
const image = new Image()
let resizeObserver: ResizeObserver | undefined
let dragStart:
  | {
      x: number
      y: number
      offsetX: number
      offsetY: number
    }
  | undefined

const aspectRatio = computed(
  () => `${props.targetWidth} / ${props.targetHeight}`,
)
const previewStyle = computed(() => {
  const ratio = props.targetWidth / props.targetHeight
  return ratio < 1
    ? {
        aspectRatio: aspectRatio.value,
        width: `${240 * ratio}px`,
        height: '240px',
      }
    : { aspectRatio: aspectRatio.value, width: '100%' }
})

function dimensions() {
  const target = canvas.value
  if (!target) return undefined
  const bounds = target.getBoundingClientRect()
  return { width: bounds.width, height: bounds.height }
}

function render() {
  const target = canvas.value
  const size = dimensions()
  if (!target || !size || !image.complete || image.naturalWidth === 0) return
  const pixelRatio = window.devicePixelRatio
  target.width = Math.max(1, Math.round(size.width * pixelRatio))
  target.height = Math.max(1, Math.round(size.height * pixelRatio))
  const context = target.getContext('2d')
  if (!context) return
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.fillStyle = '#f5f0e9'
  context.fillRect(0, 0, size.width, size.height)
  const placement = calculateImagePlacement(
    image.naturalWidth,
    image.naturalHeight,
    size.width,
    size.height,
    'crop',
    props.modelValue,
  )
  context.drawImage(
    image,
    placement.drawX,
    placement.drawY,
    placement.drawWidth,
    placement.drawHeight,
  )

  context.beginPath()
  for (const fraction of [1 / 3, 2 / 3]) {
    context.moveTo(size.width * fraction, 0)
    context.lineTo(size.width * fraction, size.height)
    context.moveTo(0, size.height * fraction)
    context.lineTo(size.width, size.height * fraction)
  }
  context.strokeStyle = 'rgb(255 255 255 / 64%)'
  context.lineWidth = 1
  context.stroke()
  context.strokeStyle = 'rgb(45 37 31 / 72%)'
  context.strokeRect(0.5, 0.5, size.width - 1, size.height - 1)
}

function setZoom(event: Event) {
  const zoom = Number((event.target as HTMLInputElement).value)
  emit('update:modelValue', { ...props.modelValue, zoom })
}

function reset() {
  emit('update:modelValue', { zoom: 1, offsetX: 0, offsetY: 0 })
}

function handlePointerDown(event: PointerEvent) {
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: props.modelValue.offsetX,
    offsetY: props.modelValue.offsetY,
  }
  canvas.value?.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  const size = dimensions()
  if (!dragStart || !size || image.naturalWidth === 0) return
  const placement = calculateImagePlacement(
    image.naturalWidth,
    image.naturalHeight,
    size.width,
    size.height,
    'crop',
    props.modelValue,
  )
  const maxX = Math.max(0, (placement.drawWidth - size.width) / 2)
  const maxY = Math.max(0, (placement.drawHeight - size.height) / 2)
  const offsetX =
    maxX === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            -1,
            dragStart.offsetX + (event.clientX - dragStart.x) / maxX,
          ),
        )
  const offsetY =
    maxY === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            -1,
            dragStart.offsetY + (event.clientY - dragStart.y) / maxY,
          ),
        )
  emit('update:modelValue', { ...props.modelValue, offsetX, offsetY })
}

function stopDragging() {
  dragStart = undefined
}

async function loadImage() {
  image.src = props.src
  try {
    await image.decode()
    await nextTick()
    render()
  } catch {
    // The parent reports decode failures when conversion starts.
  }
}

watch(() => props.src, loadImage, { immediate: true })
watch(
  () => [
    props.modelValue.zoom,
    props.modelValue.offsetX,
    props.modelValue.offsetY,
  ],
  render,
)
watch(
  () => [props.targetWidth, props.targetHeight],
  () => nextTick(render),
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
  <div class="crop-editor">
    <canvas
      ref="canvas"
      :style="previewStyle"
      aria-label="图片裁切预览"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="stopDragging"
      @pointercancel="stopDragging"
    />
    <div class="crop-controls">
      <label>
        缩放
        <input
          :value="modelValue.zoom"
          aria-label="裁切缩放"
          type="range"
          min="1"
          max="4"
          step="0.05"
          @input="setZoom"
        />
      </label>
      <button type="button" @click="reset">复位</button>
    </div>
    <small>拖动图片调整取景范围</small>
  </div>
</template>

<style scoped>
.crop-editor {
  display: grid;
  gap: 7px;
  margin: 12px 0;
}

canvas {
  display: block;
  max-width: 100%;
  margin: 0 auto;
  border-radius: 10px;
  background: #f5f0e9;
  cursor: grab;
  touch-action: none;
}

canvas:active {
  cursor: grabbing;
}

.crop-controls,
.crop-controls label {
  display: flex;
  align-items: center;
}

.crop-controls {
  justify-content: space-between;
  gap: 8px;
}

.crop-controls label {
  flex: 1;
  gap: 7px;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.crop-controls input {
  min-width: 0;
  width: 100%;
  accent-color: var(--accent);
}

.crop-controls button {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  color: #3c332c;
  background: white;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
}

small {
  color: var(--text-muted);
  font-size: 0.66rem;
  text-align: center;
}
</style>
