<script setup lang="ts">
import Cropper, { type CropperSelection } from 'cropperjs'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  src: string
  targetWidth: number
  targetHeight: number
  freeAspectRatio: boolean
}>()

const host = ref<HTMLDivElement>()
const image = ref<HTMLImageElement>()
let cropper: Cropper | undefined

function selection() {
  return cropper?.getCropperSelection() ?? undefined
}

function fitSelection(target: CropperSelection) {
  const canvas = cropper?.getCropperCanvas()
  if (!canvas) return
  const ratio = props.freeAspectRatio
    ? Number.NaN
    : props.targetWidth / props.targetHeight
  const coverage = 0.78
  let width = canvas.clientWidth * coverage
  let height = props.freeAspectRatio
    ? canvas.clientHeight * coverage
    : width / ratio
  if (height > canvas.clientHeight * coverage) {
    height = canvas.clientHeight * coverage
    width = height * ratio
  }
  target.aspectRatio = ratio
  target.initialAspectRatio = ratio
  target.$change(0, 0, width, height, ratio, true).$center()
}

async function initialize() {
  cropper?.destroy()
  cropper = undefined
  await nextTick()
  if (!image.value || !host.value) return
  cropper = new Cropper(image.value, { container: host.value })
  await nextTick()
  const target = selection()
  if (target) fitSelection(target)
}

function reset() {
  const target = selection()
  if (target) fitSelection(target)
}

async function getImageData() {
  const target = selection()
  if (!target) throw new Error('裁切器尚未准备好，请稍后再试。')
  const ratio = props.freeAspectRatio
    ? Math.max(0.05, target.width / target.height)
    : props.targetWidth / props.targetHeight
  const width = ratio >= 1 ? 2048 : Math.round(2048 * ratio)
  const height = ratio >= 1 ? Math.round(2048 / ratio) : 2048
  const result = await target.$toCanvas({ width, height })
  const context = result.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法读取裁切结果。')
  return context.getImageData(0, 0, width, height)
}

watch(
  () => [props.targetWidth, props.targetHeight, props.freeAspectRatio],
  () => {
    const target = selection()
    if (target) fitSelection(target)
  },
)

onBeforeUnmount(() => cropper?.destroy())
defineExpose({ getImageData, reset })
</script>

<template>
  <div class="cropper-shell">
    <div
      ref="host"
      class="cropper-stage"
      role="application"
      aria-label="图片裁切预览"
    >
      <img ref="image" :src="src" alt="待裁切图片" @load="initialize" />
    </div>
    <div class="cropper-tip">
      <span>拖动图片调整位置，拖动四边或角点调整裁切范围</span>
      <button type="button" @click="reset">重置裁切框</button>
    </div>
  </div>
</template>

<style scoped>
.cropper-shell {
  display: grid;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
}

.cropper-stage {
  position: relative;
  min-height: 460px;
  overflow: hidden;
  border-radius: 16px;
  background:
    linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
  background-size: 20px 20px;
}

.cropper-stage > img {
  display: none;
}

.cropper-stage :deep(cropper-canvas) {
  width: 100%;
  height: 100%;
  min-height: 460px;
}

.cropper-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.cropper-tip button {
  flex: none;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: white;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 760px) {
  .cropper-stage,
  .cropper-stage :deep(cropper-canvas) {
    min-height: 340px;
  }
}
</style>
