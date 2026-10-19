<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import type { BeadPalette } from '@/domain/palette/types'
import type { PatternDocument } from '@/domain/pattern/types'
import type { QuantizeStrategy } from '@/core/quantize'
import type { BackgroundMode } from './types'
import ImageCropper from './ImageCropper.vue'
import { convertImageInWorker } from './imageProcessorClient'
import {
  rasterizeImageFile,
  type ImageCropSettings,
  type ImageFit,
} from './rasterizeImage'

const props = defineProps<{
  pattern: PatternDocument
  palette: BeadPalette
}>()

const emit = defineEmits<{
  converted: [cells: number[]]
}>()

const file = ref<File>()
const previewUrl = ref<string>()
const fit = ref<ImageFit>('crop')
const crop = ref<ImageCropSettings>({ zoom: 1, offsetX: 0, offsetY: 0 })
const maxColors = ref(12)
const strategy = ref<QuantizeStrategy>('balanced')
const backgroundMode = ref<BackgroundMode>('preserve')
const beadSize = ref<5 | 2.6>(5)
const status = ref<'idle' | 'processing' | 'complete' | 'error'>('idle')
const errorMessage = ref('')
const report = ref<{
  engine: string
  averageDeltaE: number
  maximumDeltaE: number
  lowConfidenceCells: number
  colorCount: number
}>()

const canConvert = computed(
  () => Boolean(file.value) && status.value !== 'processing',
)
const physicalSize = computed(() => ({
  width: ((props.pattern.width * beadSize.value) / 10).toFixed(1),
  height: ((props.pattern.height * beadSize.value) / 10).toFixed(1),
}))

function setFile(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  if (!selected.type.startsWith('image/')) {
    status.value = 'error'
    errorMessage.value = '请选择 PNG、JPEG、WebP 等图片文件。'
    return
  }
  file.value = selected
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(selected)
  crop.value = { zoom: 1, offsetX: 0, offsetY: 0 }
  status.value = 'idle'
  report.value = undefined
}

async function convert() {
  if (!file.value) return
  status.value = 'processing'
  errorMessage.value = ''
  try {
    const source = await rasterizeImageFile(
      file.value,
      props.pattern.width,
      props.pattern.height,
      fit.value,
      crop.value,
    )
    const processed = await convertImageInWorker(
      source,
      props.pattern.width,
      props.pattern.height,
      props.palette,
      {
        maxColors: maxColors.value,
        strategy: strategy.value,
        backgroundMode: backgroundMode.value,
      },
    )
    emit('converted', Array.from(new Uint16Array(processed.cells)))
    report.value = {
      engine:
        processed.engine === 'opencv-wasm' ? 'OpenCV.js / WASM' : 'Canvas 降级',
      averageDeltaE: processed.averageDeltaE,
      maximumDeltaE: processed.maximumDeltaE,
      lowConfidenceCells: processed.lowConfidenceCells,
      colorCount: processed.selectedColorIndexes.length,
    }
    status.value = 'complete'
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error ? error.message : '图片转换失败。'
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <section class="panel import-panel">
    <div class="panel-heading">
      <div>
        <p class="kicker">图片转换</p>
        <h2>导入照片或插画</h2>
      </div>
      <span class="wasm-badge">WASM</span>
    </div>

    <label class="dropzone">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        @change="setFile"
      />
      <img v-if="previewUrl" :src="previewUrl" alt="待转换图片预览" />
      <span v-else>选择图片</span>
      <small>{{ file?.name ?? 'PNG / JPEG / WebP' }}</small>
    </label>

    <ImageCropper
      v-if="previewUrl && fit === 'crop'"
      v-model="crop"
      :src="previewUrl"
      :target-width="pattern.width"
      :target-height="pattern.height"
    />

    <div class="field-row">
      <label>
        构图
        <select v-model="fit">
          <option value="crop">自由裁切</option>
          <option value="cover">裁剪铺满</option>
          <option value="contain">完整放入</option>
        </select>
      </label>
      <label>
        生成策略
        <select v-model="strategy">
          <option value="balanced">均衡推荐</option>
          <option value="closest">最接近原图</option>
          <option value="few-colors">最少颜色</option>
        </select>
      </label>
    </div>

    <p class="strategy-hint">
      {{
        strategy === 'closest'
          ? '逐格从完整色卡寻找最低色差，保留更多颜色。'
          : strategy === 'few-colors'
            ? '严格压缩用色，减少采购与换豆次数。'
            : '在色彩还原与实际铺豆难度之间取平衡。'
      }}
    </p>

    <div class="field-row">
      <label>
        颜色上限
        <select v-model.number="maxColors" :disabled="strategy === 'closest'">
          <option
            v-for="count in [6, 8, 12, 16, 20, 24]"
            :key="count"
            :value="count"
          >
            {{ count }} 色
          </option>
        </select>
      </label>
      <label>
        背景处理
        <select v-model="backgroundMode">
          <option value="preserve">保留 / 透明留空</option>
          <option value="remove-edge">移除边缘纯色</option>
        </select>
      </label>
    </div>

    <div class="production-size">
      <label>
        豆子尺寸
        <select v-model.number="beadSize">
          <option :value="5">5.0 mm</option>
          <option :value="2.6">2.6 mm</option>
        </select>
      </label>
      <span
        >预计成品 {{ physicalSize.width }} × {{ physicalSize.height }} cm</span
      >
    </div>

    <button
      class="convert-button"
      type="button"
      :disabled="!canConvert"
      @click="convert"
    >
      {{ status === 'processing' ? '正在分析轮廓与颜色…' : '转换为当前图纸' }}
    </button>

    <p class="privacy-note">图片只在本机浏览器处理，不会上传。</p>

    <p v-if="status === 'error'" class="error-message">{{ errorMessage }}</p>
    <dl v-if="report" class="report">
      <div>
        <dt>处理引擎</dt>
        <dd>{{ report.engine }}</dd>
      </div>
      <div>
        <dt>实际颜色</dt>
        <dd>{{ report.colorCount }} 色</dd>
      </div>
      <div>
        <dt>平均色差</dt>
        <dd>ΔE {{ report.averageDeltaE.toFixed(1) }}</dd>
      </div>
      <div>
        <dt>待确认格</dt>
        <dd>{{ report.lowConfidenceCells }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.panel {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 19px;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.kicker {
  margin: 0 0 4px;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

h2 {
  margin: 0;
  font-size: 1rem;
}

.wasm-badge {
  padding: 4px 7px;
  border-radius: 6px;
  color: var(--sage-dark);
  background: var(--sage-pale);
  font-family: ui-monospace, monospace;
  font-size: 0.65rem;
  font-weight: 800;
}

.dropzone {
  display: grid;
  place-items: center;
  min-height: 112px;
  margin: 14px 0;
  padding: 12px;
  overflow: hidden;
  border: 1px dashed #c7aaae;
  border-radius: 12px;
  color: var(--text-muted);
  background: var(--surface-muted);
  cursor: pointer;
}

.dropzone input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.dropzone img {
  width: 100%;
  height: 96px;
  object-fit: contain;
}

.dropzone small {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field-row label {
  display: grid;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.72rem;
}

select {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  background: #fffafa;
}

select:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.strategy-hint,
.privacy-note {
  margin: 8px 0;
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.5;
}

.production-size {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  padding: 9px 10px;
  border-radius: 9px;
  background: var(--sage-pale);
}

.production-size label {
  display: grid;
  gap: 4px;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.production-size select {
  padding: 6px 8px;
}

.production-size span {
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 700;
  text-align: right;
}

.privacy-note {
  margin-bottom: 0;
  text-align: center;
}

.convert-button {
  width: 100%;
  margin-top: 12px;
  padding: 10px 12px;
  border: 0;
  border-radius: 9px;
  border: 1px solid var(--gold-dark);
  color: var(--text);
  background: var(--gold);
  box-shadow: 0 8px 20px rgb(134 102 18 / 14%);
  font-weight: 800;
  cursor: pointer;
}

.convert-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.error-message {
  color: #9b3f47;
  font-size: 0.75rem;
}

.report {
  display: grid;
  gap: 7px;
  margin: 14px 0 0;
  font-size: 0.72rem;
}

.report div {
  display: flex;
  justify-content: space-between;
}

.report dt {
  color: var(--text-muted);
}

.report dd {
  margin: 0;
  font-weight: 700;
}
</style>
