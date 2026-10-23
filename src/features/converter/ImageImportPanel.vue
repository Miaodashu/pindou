<script setup lang="ts">
import {
  ArrowLeftRight,
  Expand,
  ImagePlus,
  Info,
  RefreshCw,
  Sparkles,
  X,
} from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { QuantizeStrategy } from '@/core/quantize'
import type { BeadPalette } from '@/domain/palette/types'
import type { PatternDocument } from '@/domain/pattern/types'
import ColorReplaceDialog from '@/features/editor/ColorReplaceDialog.vue'
import PatternPreview, {
  type PatternPreviewMode,
} from '@/features/editor/PatternPreview.vue'
import ImageCropper from './ImageCropper.vue'
import { convertImageInWorker } from './imageProcessorClient'
import type { BackgroundMode, ConversionPipelineVersion } from './types'

interface CropperApi {
  getImageData: () => Promise<ImageData>
  reset: () => void
}

const props = defineProps<{
  pattern: PatternDocument
  palette: BeadPalette
  inventoryQuantities: Record<string, number>
}>()

const emit = defineEmits<{
  converted: [payload: { width: number; height: number; cells: number[] }]
  openEditor: []
}>()

const fileInput = ref<HTMLInputElement>()
const cropper = ref<CropperApi>()
const file = ref<File>()
const previewUrl = ref('')
const cropOpen = ref(false)
const freeCrop = ref(false)
const width = ref(props.pattern.width)
const height = ref(props.pattern.height)
const maxColors = ref(12)
const strategy = ref<QuantizeStrategy>('balanced')
const backgroundMode = ref<BackgroundMode>('preserve')
const beadSize = ref<5 | 2.6>(2.6)
const status = ref<'idle' | 'processing' | 'complete' | 'error'>('idle')
const errorMessage = ref('')
const croppedSource = ref<ImageData>()
const croppedRatio = ref('')
const generatedCells = ref<number[]>([])
const previewMode = ref<PatternPreviewMode>('grid')
const replaceFrom = ref<number>()
const pipelineLabels: Record<ConversionPipelineVersion, string> = {
  'v1-legacy': '经典采样 V1',
  'v2-adaptive': '自适应采样 V2',
}
const report = ref<{
  engine: string
  averageDeltaE: number
  maximumDeltaE: number
  lowConfidenceCells: number
  colorCount: number
  cleanedCells: number
  pipelineVersion: ConversionPipelineVersion
}>()

const physicalSize = computed(() => ({
  width: ((width.value * beadSize.value) / 10).toFixed(1),
  height: ((height.value * beadSize.value) / 10).toFixed(1),
}))
const ratioKey = computed(() => `${width.value}:${height.value}`)
const usage = computed(() => {
  const counts = new Map<number, number>()
  generatedCells.value.forEach((cell) => {
    counts.set(cell, (counts.get(cell) ?? 0) + 1)
  })
  return [...counts.entries()]
    .map(([colorIndex, count]) => ({
      colorIndex,
      count,
      color: colorIndex > 0 ? props.palette.colors[colorIndex - 1] : undefined,
    }))
    .sort((first, second) => {
      if (first.colorIndex === 0) return 1
      if (second.colorIndex === 0) return -1
      return second.count - first.count
    })
})
const usedColorIndexes = computed(() =>
  usage.value
    .filter((item) => item.colorIndex > 0)
    .map((item) => item.colorIndex),
)
const activeReplaceEntry = computed(() =>
  usage.value.find((item) => item.colorIndex === replaceFrom.value),
)

function setFile(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  if (!selected.type.startsWith('image/')) {
    status.value = 'error'
    errorMessage.value = '请选择 PNG、JPEG、WebP 等图片文件。'
    return
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = selected
  previewUrl.value = URL.createObjectURL(selected)
  generatedCells.value = []
  croppedSource.value = undefined
  report.value = undefined
  status.value = 'idle'
  errorMessage.value = ''
  cropOpen.value = true
  input.value = ''
}

async function processSource(source: ImageData) {
  status.value = 'processing'
  errorMessage.value = ''
  try {
    const processed = await convertImageInWorker(
      source,
      width.value,
      height.value,
      props.palette,
      {
        maxColors: maxColors.value,
        strategy: strategy.value,
        backgroundMode: backgroundMode.value,
      },
    )
    generatedCells.value = Array.from(new Uint16Array(processed.cells))
    report.value = {
      engine:
        processed.engine === 'opencv-wasm' ? 'OpenCV.js / WASM' : 'Canvas 降级',
      averageDeltaE: processed.averageDeltaE,
      maximumDeltaE: processed.maximumDeltaE,
      lowConfidenceCells: processed.lowConfidenceCells,
      colorCount: processed.selectedColorIndexes.length,
      cleanedCells: processed.cleanedCells,
      pipelineVersion: processed.pipelineVersion,
    }
    status.value = 'complete'
    cropOpen.value = false
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error ? error.message : '图片转换失败。'
  }
}

async function cropAndGenerate() {
  if (!cropper.value || status.value === 'processing') return
  try {
    const source = await cropper.value.getImageData()
    croppedSource.value = source
    croppedRatio.value = ratioKey.value
    await processSource(source)
  } catch (error) {
    status.value = 'error'
    errorMessage.value =
      error instanceof Error ? error.message : '无法读取裁切结果。'
  }
}

async function regenerate() {
  if (!croppedSource.value || croppedRatio.value !== ratioKey.value) {
    cropOpen.value = true
    return
  }
  await processSource(croppedSource.value)
}

function applyAndOpenEditor() {
  if (generatedCells.value.length !== width.value * height.value) return
  emit('converted', {
    width: width.value,
    height: height.value,
    cells: [...generatedCells.value],
  })
  emit('openEditor')
}

function replaceCandidate(payload: {
  toColorIndex: number
  selectionOnly: boolean
}) {
  const from = replaceFrom.value
  if (from === undefined || from === payload.toColorIndex) return
  generatedCells.value = generatedCells.value.map((cell) =>
    cell === from ? payload.toColorIndex : cell,
  )
  replaceFrom.value = undefined
}

watch(ratioKey, () => {
  if (croppedRatio.value && croppedRatio.value !== ratioKey.value) {
    croppedSource.value = undefined
  }
})

onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<template>
  <section class="generation-workbench">
    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      @change="setFile"
    />

    <div v-if="!previewUrl" class="upload-empty">
      <span class="upload-icon"
        ><ImagePlus :size="28" aria-hidden="true"
      /></span>
      <p class="eyebrow">图片转拼豆图纸</p>
      <h1>选择一张图片，从裁切开始</h1>
      <p>
        图片只在本机浏览器处理，不会上传。生成后可以左右对比，再进入全屏精修。
      </p>
      <button type="button" class="primary-action" @click="fileInput?.click()">
        <ImagePlus :size="18" aria-hidden="true" />
        选择图片
      </button>
    </div>

    <template v-else>
      <div class="generation-settings">
        <button class="open-image" type="button" @click="fileInput?.click()">
          <ImagePlus :size="18" aria-hidden="true" />
          更换图片
        </button>
        <label>
          <span>图纸尺寸</span>
          <span class="inline-fields">
            <input
              v-model.number="width"
              aria-label="图纸宽度"
              type="number"
              min="1"
              max="300"
            />
            ×
            <input
              v-model.number="height"
              aria-label="图纸高度"
              type="number"
              min="1"
              max="300"
            />
          </span>
        </label>
        <label>
          <span>生成策略</span>
          <select v-model="strategy" aria-label="生成策略">
            <option value="balanced">均衡推荐</option>
            <option value="closest">最接近原图</option>
            <option value="few-colors">最少颜色</option>
          </select>
        </label>
        <label>
          <span>颜色上限</span>
          <select
            v-model.number="maxColors"
            aria-label="颜色上限"
            :disabled="strategy === 'closest'"
          >
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
          <span>背景处理</span>
          <select v-model="backgroundMode" aria-label="背景处理">
            <option value="preserve">保留 / 透明留空</option>
            <option value="remove-edge">移除边缘纯色</option>
          </select>
        </label>
        <label>
          <span>豆子尺寸</span>
          <select v-model.number="beadSize" aria-label="豆子尺寸">
            <option :value="2.6">2.6 mm</option>
            <option :value="5">5.0 mm</option>
          </select>
        </label>
        <div class="physical-size">
          <span>预计成品尺寸</span>
          <strong
            >{{ physicalSize.width }} × {{ physicalSize.height }} cm</strong
          >
        </div>
        <button
          class="regenerate"
          type="button"
          :disabled="status === 'processing'"
          @click="regenerate"
        >
          <RefreshCw :size="17" aria-hidden="true" />
          {{
            status === 'processing'
              ? '生成中…'
              : generatedCells.length
                ? '重新生成'
                : '裁切并生成'
          }}
        </button>
      </div>

      <div v-if="generatedCells.length" class="comparison-grid">
        <article class="comparison-card">
          <header>
            <h2>原图</h2>
            <span>{{ file?.name }}</span>
          </header>
          <button
            type="button"
            class="source-preview"
            aria-label="重新上传原图"
            title="点击重新上传图片"
            @click="fileInput?.click()"
          >
            <img :src="previewUrl" alt="导入的原图" />
            <span>
              <ImagePlus :size="17" aria-hidden="true" />
              点击更换原图
            </span>
          </button>
        </article>
        <article class="comparison-card">
          <header class="pattern-heading">
            <h2>图纸</h2>
            <div class="preview-tabs" aria-label="图纸预览模式">
              <button
                v-for="item in [
                  ['grid', '网格'],
                  ['codes', '色号'],
                  ['boards', '拼板'],
                ] as const"
                :key="item[0]"
                type="button"
                :class="{ active: previewMode === item[0] }"
                @click="previewMode = item[0]"
              >
                {{ item[1] }}
              </button>
              <button
                type="button"
                class="fullscreen-button"
                @click="applyAndOpenEditor"
              >
                <Expand :size="16" aria-hidden="true" />
                全屏精修
              </button>
            </div>
          </header>
          <PatternPreview
            :width="width"
            :height="height"
            :cells="generatedCells"
            :palette="palette"
            :mode="previewMode"
          />
        </article>
      </div>

      <div v-else class="waiting-preview">
        <img :src="previewUrl" alt="待生成图片" />
        <div>
          <Sparkles :size="26" aria-hidden="true" />
          <h2>图片已准备好</h2>
          <p>调整图纸规格后，进入裁切并生成图纸。</p>
          <button type="button" class="primary-action" @click="cropOpen = true">
            开始裁切
          </button>
        </div>
      </div>

      <div v-if="generatedCells.length" class="usage-rail">
        <div class="usage-title">
          <strong>使用色彩</strong>
          <span
            >{{ usage.filter((item) => item.colorIndex > 0).length }} 种</span
          >
        </div>
        <div class="usage-scroll">
          <div
            v-for="entry in usage"
            :key="entry.colorIndex"
            class="usage-chip"
          >
            <span
              class="usage-color"
              :class="{ transparent: entry.colorIndex === 0 }"
              :style="
                entry.color ? { backgroundColor: entry.color.hex } : undefined
              "
            />
            <strong>{{ entry.color?.code ?? '透明' }}</strong>
            <small>{{ entry.count }}</small>
            <button
              type="button"
              :aria-label="`替换 ${entry.color?.code ?? '透明背景'}`"
              @click="replaceFrom = entry.colorIndex"
            >
              <ArrowLeftRight :size="15" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div v-if="report" class="generation-report">
          <span
            >{{ report.engine }} ·
            {{ pipelineLabels[report.pipelineVersion] }}</span
          >
          <span>平均 ΔE {{ report.averageDeltaE.toFixed(1) }}</span>
          <span>待确认 {{ report.lowConfidenceCells }} 格</span>
          <span v-if="report.cleanedCells"
            >已清理 {{ report.cleanedCells }} 个孤立格</span
          >
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div v-if="cropOpen" class="crop-modal-backdrop" role="presentation">
        <section
          class="crop-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-title"
        >
          <header class="crop-modal-header">
            <div>
              <p class="eyebrow">第一步</p>
              <h2 id="crop-title">裁切图片并设置生成策略</h2>
            </div>
            <button
              type="button"
              aria-label="关闭裁切窗口"
              @click="cropOpen = false"
            >
              <X :size="20" aria-hidden="true" />
            </button>
          </header>
          <div class="crop-modal-body">
            <ImageCropper
              ref="cropper"
              :src="previewUrl"
              :target-width="width"
              :target-height="height"
              :free-aspect-ratio="freeCrop"
            />
            <aside class="crop-settings">
              <div class="settings-callout">
                <Info :size="18" aria-hidden="true" />
                <p>
                  {{
                    freeCrop
                      ? '自由调整裁切框四边与角点，结果会适配到当前图纸尺寸。'
                      : '裁切框比例与图纸比例同步，修改宽高后会自动重置裁切框。'
                  }}
                </p>
              </div>
              <div class="crop-ratio-switch" aria-label="裁切比例">
                <button
                  type="button"
                  :class="{ active: !freeCrop }"
                  :aria-pressed="!freeCrop"
                  @click="freeCrop = false"
                >
                  跟随图纸比例
                </button>
                <button
                  type="button"
                  :class="{ active: freeCrop }"
                  :aria-pressed="freeCrop"
                  @click="freeCrop = true"
                >
                  自由裁切
                </button>
              </div>
              <label>
                图纸尺寸
                <span class="inline-fields">
                  <input
                    v-model.number="width"
                    type="number"
                    min="1"
                    max="300"
                    aria-label="裁切图纸宽度"
                  />
                  ×
                  <input
                    v-model.number="height"
                    type="number"
                    min="1"
                    max="300"
                    aria-label="裁切图纸高度"
                  />
                </span>
              </label>
              <label>
                生成策略
                <select v-model="strategy">
                  <option value="balanced">均衡推荐</option>
                  <option value="closest">最接近原图</option>
                  <option value="few-colors">最少颜色</option>
                </select>
              </label>
              <label>
                颜色上限
                <select
                  v-model.number="maxColors"
                  :disabled="strategy === 'closest'"
                >
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
              <label>
                豆子尺寸
                <select v-model.number="beadSize">
                  <option :value="2.6">2.6 mm（默认）</option>
                  <option :value="5">5.0 mm</option>
                </select>
              </label>
              <div class="modal-size-summary">
                <span>预计成品</span>
                <strong
                  >{{ physicalSize.width }} ×
                  {{ physicalSize.height }} cm</strong
                >
              </div>
            </aside>
          </div>
          <footer class="crop-modal-footer">
            <p v-if="status === 'error'" role="alert">{{ errorMessage }}</p>
            <span v-else>图片只在本机浏览器处理，不会上传。</span>
            <button type="button" class="secondary" @click="fileInput?.click()">
              重新选择
            </button>
            <button
              type="button"
              class="primary-action"
              :disabled="status === 'processing'"
              @click="cropAndGenerate"
            >
              <Sparkles :size="17" aria-hidden="true" />
              {{ status === 'processing' ? '正在生成图纸…' : '生成图纸' }}
            </button>
          </footer>
        </section>
      </div>
    </Teleport>

    <ColorReplaceDialog
      :open="replaceFrom !== undefined"
      :from-color-index="replaceFrom ?? 0"
      :count="activeReplaceEntry?.count ?? 0"
      :palette="palette"
      :used-color-indexes="usedColorIndexes"
      :inventory-quantities="inventoryQuantities"
      @close="replaceFrom = undefined"
      @replace="replaceCandidate"
    />
  </section>
</template>

<style scoped>
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  border: 0;
  white-space: nowrap;
}

.generation-workbench {
  width: min(1480px, calc(100% - 40px));
  margin: 0 auto;
  padding: 22px 0 30px;
}

.upload-empty,
.waiting-preview,
.comparison-card,
.generation-settings,
.usage-rail {
  border: 1px solid var(--border);
  border-radius: 20px;
  background: rgb(255 253 253 / 94%);
  box-shadow: var(--shadow-small);
}

.upload-empty {
  display: grid;
  min-height: 560px;
  padding: 48px 24px;
  place-items: center;
  align-content: center;
  text-align: center;
}

.upload-icon {
  display: grid;
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  place-items: center;
  border-radius: 20px;
  color: var(--rose-strong);
  background: var(--rose-pale);
}

.eyebrow {
  margin: 0 0 7px;
  color: var(--rose-strong);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.upload-empty h1 {
  margin: 0;
  font-family: 'Cormorant Garamond', 'Noto Serif SC', serif;
  font-size: clamp(2rem, 4vw, 3.4rem);
}

.upload-empty > p:not(.eyebrow),
.waiting-preview p {
  max-width: 620px;
  margin: 14px 0 24px;
  color: var(--text-muted);
  line-height: 1.7;
}

.primary-action,
.secondary,
.generation-settings button,
.preview-tabs button,
.usage-chip button,
.crop-modal-header button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: white;
  cursor: pointer;
}

.primary-action {
  padding: 12px 18px;
  border-color: #b98d19;
  color: #3a2a07;
  background: linear-gradient(135deg, #efd36f, #d4af37);
  box-shadow: 0 9px 20px rgb(160 120 20 / 18%);
  font-weight: 800;
}

.generation-settings {
  position: sticky;
  z-index: 4;
  top: 8px;
  display: grid;
  grid-template-columns: auto 1.35fr repeat(4, minmax(112px, 1fr)) 1.3fr auto;
  gap: 10px;
  padding: 12px;
  backdrop-filter: blur(16px);
}

.generation-settings label,
.crop-settings label {
  display: grid;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.generation-settings select,
.generation-settings input,
.crop-settings select,
.crop-settings input {
  min-width: 0;
  width: 100%;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: white;
}

.inline-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 5px;
}

.generation-settings button {
  padding: 9px 12px;
  font-weight: 800;
}

.generation-settings .regenerate {
  align-self: stretch;
  border-color: #b98d19;
  background: #efd36f;
}

.physical-size {
  display: grid;
  align-content: center;
  padding: 0 12px;
  border-left: 1px solid var(--border);
}

.physical-size span {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.physical-size strong {
  margin-top: 4px;
  font-size: 0.78rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 16px;
}

.comparison-card {
  min-width: 0;
  padding: 14px;
}

.comparison-card header {
  display: flex;
  min-height: 45px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px 10px;
}

.comparison-card h2,
.waiting-preview h2,
.crop-modal h2 {
  margin: 0;
  font-size: 1.12rem;
}

.comparison-card header > span {
  max-width: 50%;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-preview,
.comparison-card :deep(.pattern-preview) {
  height: min(62vh, 650px);
  min-height: 420px;
}

.source-preview {
  position: relative;
  display: grid;
  width: 100%;
  padding: 0;
  place-items: center;
  overflow: hidden;
  border: 0;
  border-radius: 14px;
  background: #eee8e5;
  cursor: pointer;
}

.source-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.source-preview > span {
  position: absolute;
  right: 14px;
  bottom: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  border-radius: 9px;
  color: white;
  background: rgb(45 38 36 / 74%);
  font-size: 0.7rem;
  font-weight: 800;
  opacity: 0;
  transform: translateY(4px);
}

.source-preview:hover > span,
.source-preview:focus-visible > span {
  opacity: 1;
  transform: translateY(0);
}

.preview-tabs {
  display: flex;
  gap: 6px;
}

.preview-tabs button {
  padding: 8px 10px;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 800;
}

.preview-tabs button.active {
  border-color: #3c3432;
  color: white;
  background: #3c3432;
}

.preview-tabs .fullscreen-button {
  margin-left: 5px;
  color: var(--rose-strong);
  background: var(--rose-pale);
}

.waiting-preview {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  min-height: 520px;
  margin-top: 16px;
  overflow: hidden;
}

.waiting-preview img {
  width: 100%;
  height: 100%;
  max-height: 620px;
  object-fit: contain;
  background: #eee8e5;
}

.waiting-preview > div {
  display: grid;
  padding: 40px;
  place-content: center;
  justify-items: start;
}

.usage-rail {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 16px;
  margin-top: 14px;
  padding: 14px 18px;
  align-items: center;
}

.usage-title {
  display: grid;
  padding-right: 16px;
  border-right: 1px solid var(--border);
}

.usage-title span,
.generation-report,
.usage-chip small {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.usage-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 3px;
}

.usage-chip {
  display: grid;
  flex: none;
  grid-template-columns: 34px auto auto 30px;
  align-items: center;
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: white;
}

.usage-color {
  width: 34px;
  height: 34px;
  border: 1px solid rgb(42 35 31 / 14%);
  border-radius: 8px;
}

.transparent {
  background: conic-gradient(#ddd 25%, white 0 50%, #ddd 0 75%, white 0) 0 0 /
    10px 10px;
}

.usage-chip button {
  width: 30px;
  height: 30px;
  padding: 0;
  color: var(--text-muted);
}

.generation-report {
  display: grid;
  min-width: max-content;
}

.crop-modal-backdrop {
  position: fixed;
  z-index: 70;
  inset: 0;
  display: grid;
  padding: 24px;
  place-items: center;
  background: rgb(31 27 26 / 62%);
  backdrop-filter: blur(8px);
}

.crop-modal {
  display: grid;
  width: min(1420px, 96vw);
  max-height: 94vh;
  overflow: hidden;
  border-radius: 24px;
  background: var(--surface);
  box-shadow: 0 36px 100px rgb(0 0 0 / 28%);
}

.crop-modal-header,
.crop-modal-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px;
}

.crop-modal-header {
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.crop-modal-header button {
  width: 40px;
  height: 40px;
}

.crop-modal-body {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 22px;
  padding: 20px 24px;
  overflow: auto;
}

.crop-settings {
  display: grid;
  align-content: start;
  gap: 15px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fffafa;
}

.crop-ratio-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  padding: 4px;
  border-radius: 11px;
  background: var(--surface-muted);
}

.crop-ratio-switch button {
  padding: 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text-muted);
  background: transparent;
  font-size: 0.7rem;
  font-weight: 800;
  cursor: pointer;
}

.crop-ratio-switch button.active {
  border-color: var(--border);
  color: var(--rose-strong);
  background: white;
  box-shadow: 0 4px 12px rgb(61 39 43 / 8%);
}

.settings-callout {
  display: flex;
  gap: 9px;
  padding: 11px;
  border-radius: 10px;
  color: var(--sage-dark);
  background: var(--sage-pale);
}

.settings-callout p {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.55;
}

.modal-size-summary {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: var(--rose-pale);
}

.modal-size-summary span {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.crop-modal-footer {
  justify-content: flex-end;
  border-top: 1px solid var(--border);
}

.crop-modal-footer > p,
.crop-modal-footer > span {
  margin: 0 auto 0 0;
  color: var(--text-muted);
  font-size: 0.74rem;
}

.crop-modal-footer > p {
  color: #a02f2f;
}

.secondary {
  padding: 11px 15px;
  font-weight: 800;
}

@media (max-width: 1180px) {
  .generation-settings {
    grid-template-columns: repeat(4, 1fr);
  }

  .physical-size {
    border-left: 0;
  }

  .comparison-grid {
    grid-template-columns: 1fr;
  }

  .crop-modal-body {
    grid-template-columns: 1fr;
  }

  .crop-settings {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 760px) {
  .generation-workbench {
    width: min(100% - 20px, 1480px);
  }

  .generation-settings,
  .crop-settings,
  .waiting-preview {
    grid-template-columns: 1fr 1fr;
  }

  .waiting-preview img,
  .waiting-preview > div {
    grid-column: 1 / -1;
  }

  .usage-rail {
    grid-template-columns: 1fr;
  }

  .usage-title {
    border-right: 0;
  }

  .generation-report {
    grid-auto-flow: column;
  }

  .crop-modal-backdrop {
    padding: 0;
  }

  .crop-modal {
    width: 100%;
    height: 100%;
    max-height: none;
    border-radius: 0;
  }

  .crop-modal-footer {
    flex-wrap: wrap;
  }
}
</style>
