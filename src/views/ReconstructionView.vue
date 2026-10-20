<script setup lang="ts">
import {
  ArrowRight,
  Download,
  FileImage,
  ScanSearch,
  WandSparkles,
} from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { createReconstructionSvg } from '@/core/reconstructionSvg'
import { createPattern } from '@/domain/pattern/createPattern'
import type { PatternDocument } from '@/domain/pattern/types'
import { useEditorStore } from '@/features/editor/editorStore'
import GridCalibration from '@/features/reconstruction/GridCalibration.vue'
import ReconstructionPreview from '@/features/reconstruction/ReconstructionPreview.vue'
import { rasterizeGridRegion } from '@/features/reconstruction/rasterizeGrid'
import { reconstructInWorker } from '@/features/reconstruction/reconstructionClient'
import type { GridCalibration as GridCalibrationValue } from '@/features/reconstruction/types'

interface ReconstructionState {
  pattern: PatternDocument
  confidence: number[]
  uncertainCells: number[]
  averageDeltaE: number
  maximumDeltaE: number
}

const store = useEditorStore()
const router = useRouter()
const { palette } = storeToRefs(store)
const fileInput = ref<HTMLInputElement>()
const sourceFile = ref<File>()
const sourceUrl = ref('')
const sourceName = ref('')
const calibration = ref<GridCalibrationValue>({
  columns: 29,
  rows: 29,
  left: 1.5,
  right: 1.5,
  top: 1.5,
  bottom: 1.5,
})
const processing = ref(false)
const errorMessage = ref('')
const legendCodes = ref('')
const result = ref<ReconstructionState>()
const resultRevision = ref(0)

function revokeSourceUrl() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
}

function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  revokeSourceUrl()
  sourceFile.value = file
  sourceName.value = file.name
  sourceUrl.value = URL.createObjectURL(file)
  errorMessage.value = ''
  result.value = undefined
  input.value = ''
}

function normalizeGrid() {
  calibration.value.columns = Math.max(
    1,
    Math.min(300, Math.floor(calibration.value.columns)),
  )
  calibration.value.rows = Math.max(
    1,
    Math.min(300, Math.floor(calibration.value.rows)),
  )
}

function setPreset(columns: number, rows = columns) {
  calibration.value.columns = columns
  calibration.value.rows = rows
}

function confirmedPaletteIndexes() {
  const codes = new Set(
    legendCodes.value
      .toUpperCase()
      .split(/[\s,，、;；]+/)
      .map((code) => code.trim())
      .filter(Boolean),
  )
  return palette.value.colors
    .map((color, index) => (codes.has(color.code.toUpperCase()) ? index : -1))
    .filter((index) => index >= 0)
}

async function reconstruct() {
  if (!sourceFile.value) return
  normalizeGrid()
  processing.value = true
  errorMessage.value = ''
  try {
    const source = await rasterizeGridRegion(
      sourceFile.value,
      calibration.value,
    )
    const response = await reconstructInWorker(
      source,
      calibration.value.columns,
      calibration.value.rows,
      palette.value,
      confirmedPaletteIndexes(),
    )
    const pattern = createPattern(
      calibration.value.columns,
      calibration.value.rows,
      palette.value.id,
    )
    pattern.title = `${sourceName.value.replace(/\.[^.]+$/, '') || '图纸'}-高清重建`
    pattern.cells = Array.from(new Uint16Array(response.cells))
    result.value = {
      pattern,
      confidence: Array.from(new Float32Array(response.confidence)),
      uncertainCells: Array.from(new Uint32Array(response.uncertainCells)),
      averageDeltaE: response.averageDeltaE,
      maximumDeltaE: response.maximumDeltaE,
    }
    resultRevision.value += 1
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '图纸重建失败。'
  } finally {
    processing.value = false
  }
}

function updateCell(index: number, colorIndex: number) {
  if (!result.value) return
  result.value.pattern.cells[index] = colorIndex
  result.value.confidence[index] = 1
  result.value.uncertainCells = result.value.uncertainCells.filter(
    (candidate) => candidate !== index,
  )
  resultRevision.value += 1
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportSvg() {
  if (!result.value) return
  const svg = createReconstructionSvg(result.value.pattern, palette.value)
  download(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    `${result.value.pattern.title}.svg`,
  )
}

async function exportPng() {
  if (!result.value) return
  const svg = createReconstructionSvg(result.value.pattern, palette.value)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(2, 8192 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法生成高清 PNG。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('PNG 生成失败。')),
        'image/png',
      ),
    )
    download(blob, `${result.value.pattern.title}.png`)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'PNG 生成失败。'
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function openInEditor() {
  if (!result.value) return
  const { pattern } = result.value
  store.loadReconstruction(
    pattern.width,
    pattern.height,
    pattern.cells,
    pattern.title,
  )
  await router.push('/editor')
}

onMounted(() => store.hydrate())
onBeforeUnmount(revokeSourceUrl)
</script>

<template>
  <div class="reconstruction-page">
    <header class="reconstruction-hero">
      <div>
        <p class="eyebrow">PATTERN RECONSTRUCTION</p>
        <h1>把模糊图纸，重新变成清晰可编辑的图纸</h1>
        <p>
          这不是普通锐化。系统会按网格重新识别每一格颜色、匹配 Mard
          色号，并生成真正可无限放大的 SVG 矢量图。
        </p>
      </div>
      <div class="hero-mark" aria-hidden="true">
        <ScanSearch :size="34" />
      </div>
    </header>

    <div class="reconstruction-layout">
      <aside class="setup-column">
        <section class="upload-panel">
          <div class="step-heading">
            <p class="eyebrow">STEP 1</p>
            <h2>导入已有图纸</h2>
          </div>
          <button class="upload-zone" type="button" @click="fileInput?.click()">
            <FileImage :size="28" aria-hidden="true" />
            <strong>{{ sourceName || '选择模糊图纸' }}</strong>
            <span>PNG / JPEG / WebP，建议保留完整网格边界</span>
          </button>
          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            @change="chooseFile"
          />

          <div class="grid-size">
            <label>
              列数
              <input
                v-model.number="calibration.columns"
                type="number"
                min="1"
                max="300"
              />
            </label>
            <span>×</span>
            <label>
              行数
              <input
                v-model.number="calibration.rows"
                type="number"
                min="1"
                max="300"
              />
            </label>
          </div>
          <div class="size-presets">
            <button type="button" @click="setPreset(29)">29 × 29</button>
            <button type="button" @click="setPreset(58)">58 × 58</button>
            <button type="button" @click="setPreset(78, 99)">78 × 99</button>
          </div>
          <p class="setup-note">
            行列数必须与原图坐标一致；示例大图可使用 78 × 99。
          </p>
          <label class="legend-codes">
            <span>原图图例色号（推荐）</span>
            <textarea
              v-model="legendCodes"
              rows="3"
              placeholder="例如：A6 A8 B7 B9 F13 H16"
            />
            <small>
              若底部图例仍可辨认，请粘贴所有色号。系统将排除原图未使用的相近色号。
            </small>
          </label>
        </section>

        <button
          class="reconstruct-button"
          type="button"
          :disabled="!sourceFile || processing"
          @click="reconstruct"
        >
          <WandSparkles :size="18" aria-hidden="true" />
          {{ processing ? '正在逐格识别…' : '开始高清重建' }}
        </button>
        <p v-if="errorMessage" class="error-message" role="alert">
          {{ errorMessage }}
        </p>
      </aside>

      <main class="result-column">
        <GridCalibration
          v-if="sourceUrl"
          v-model="calibration"
          :src="sourceUrl"
        />

        <template v-if="result">
          <section class="result-summary">
            <div>
              <span>识别网格</span>
              <strong
                >{{ result.pattern.width }} ×
                {{ result.pattern.height }}</strong
              >
            </div>
            <div>
              <span>已识别色块</span>
              <strong>{{
                result.pattern.cells.filter((cell) => cell > 0).length
              }}</strong>
            </div>
            <div :class="{ warning: result.uncertainCells.length > 0 }">
              <span>待确认格</span>
              <strong>{{ result.uncertainCells.length }}</strong>
            </div>
            <div>
              <span>平均色差</span>
              <strong>{{ result.averageDeltaE.toFixed(1) }}</strong>
            </div>
          </section>

          <ReconstructionPreview
            :pattern="result.pattern"
            :palette="palette"
            :confidence="result.confidence"
            :uncertain-cells="result.uncertainCells"
            :revision="resultRevision"
            @update-cell="updateCell"
          />

          <section class="result-actions">
            <div>
              <h2>重建完成</h2>
              <p>
                红框是色差较大或候选色过近的待确认格，可点击图纸后手动修正。
              </p>
            </div>
            <div>
              <button type="button" @click="exportSvg">
                <Download :size="16" aria-hidden="true" />导出 SVG
              </button>
              <button type="button" @click="exportPng">
                <Download :size="16" aria-hidden="true" />导出高清 PNG
              </button>
              <button class="primary" type="button" @click="openInEditor">
                进入编辑器继续修改<ArrowRight :size="16" aria-hidden="true" />
              </button>
            </div>
          </section>
        </template>

        <section v-else-if="!sourceUrl" class="empty-result">
          <div><ScanSearch :size="40" aria-hidden="true" /></div>
          <h2>等待重建图纸</h2>
          <p>
            导入图片、填写准确行列数并校准外框后，这里会显示重新绘制的清晰图纸。
          </p>
          <ul>
            <li>颜色从格子上下区域取样，避开模糊色号文字</li>
            <li>使用 Lab 色差匹配当前 Mard 色卡</li>
            <li>不确定结果会单独标记，不会悄悄隐藏</li>
          </ul>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.reconstruction-page {
  min-height: calc(100vh - 78px);
  padding: clamp(30px, 5vw, 64px) clamp(16px, 4vw, 58px) 70px;
  background:
    radial-gradient(circle at 8% 0%, rgb(232 180 184 / 24%), transparent 27%),
    radial-gradient(circle at 95% 7%, rgb(168 213 186 / 22%), transparent 25%),
    var(--background);
}

.reconstruction-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  width: min(1440px, 100%);
  margin: 0 auto 34px;
}

.reconstruction-hero > div:first-child {
  max-width: 900px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--sage-dark);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.19em;
}

h1 {
  margin: 0;
  font-family: 'Cormorant Garamond', 'Noto Serif SC', serif;
  font-size: clamp(2.5rem, 5vw, 4.6rem);
  line-height: 0.98;
  letter-spacing: -0.04em;
}

.reconstruction-hero p:last-child {
  max-width: 760px;
  margin: 18px 0 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.8;
}

.hero-mark {
  display: grid;
  flex: none;
  width: 76px;
  height: 76px;
  place-items: center;
  border-radius: 24px;
  color: var(--sage-dark);
  background: var(--sage-pale);
  box-shadow: var(--shadow-small);
}

.reconstruction-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  align-items: start;
  gap: 22px;
  width: min(1440px, 100%);
  margin: 0 auto;
}

.setup-column,
.result-column {
  display: grid;
  gap: 18px;
}

@media (min-width: 961px) {
  .setup-column {
    position: sticky;
    top: 96px;
  }
}

.upload-panel {
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.step-heading h2,
.result-actions h2,
.empty-result h2 {
  margin: 0;
  font-size: 1rem;
}

.upload-zone {
  display: grid;
  width: 100%;
  min-height: 140px;
  margin: 16px 0;
  place-items: center;
  align-content: center;
  gap: 7px;
  padding: 18px;
  border: 1px dashed #c9a8aa;
  border-radius: 16px;
  color: var(--accent-strong);
  background: #fff9f9;
  cursor: pointer;
}

.upload-zone:hover {
  border-color: var(--rose-strong);
  background: var(--rose-pale);
}

.upload-zone span,
.setup-note {
  color: var(--text-muted);
  font-size: 0.66rem;
  text-align: center;
}

.legend-codes {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.legend-codes textarea {
  width: 100%;
  resize: vertical;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fffafa;
  line-height: 1.5;
}

.legend-codes small {
  font-size: 0.62rem;
  line-height: 1.5;
}

.grid-size {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: end;
  gap: 8px;
}

.grid-size label {
  display: grid;
  gap: 5px;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.grid-size input {
  min-width: 0;
  width: 100%;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fffafa;
}

.size-presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 8px;
}

.size-presets button,
.result-actions button {
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: var(--surface);
  font-size: 0.68rem;
  font-weight: 800;
  cursor: pointer;
}

.setup-note {
  margin: 10px 0 0;
  line-height: 1.55;
}

.reconstruct-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 50px;
  border: 1px solid var(--gold-dark);
  border-radius: 14px;
  color: var(--text);
  background: var(--gold);
  box-shadow: 0 10px 24px rgb(134 102 18 / 18%);
  font-weight: 800;
  cursor: pointer;
}

.reconstruct-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.error-message {
  margin: 0;
  padding: 11px 13px;
  border-radius: 10px;
  color: #8b343d;
  background: var(--rose-pale);
  font-size: 0.72rem;
}

.result-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.result-summary div {
  display: grid;
  gap: 4px;
  padding: 15px;
  border: 1px solid rgb(53 104 78 / 10%);
  border-radius: 15px;
  background: var(--sage-pale);
}

.result-summary div.warning {
  border-color: rgb(146 77 86 / 15%);
  background: var(--rose-pale);
}

.result-summary span {
  color: var(--text-muted);
  font-size: 0.66rem;
}

.result-summary strong {
  font-size: 1.15rem;
}

.result-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.result-actions p {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.result-actions > div:last-child {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.result-actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.result-actions button.primary {
  border-color: var(--gold-dark);
  background: var(--gold);
}

.empty-result {
  display: grid;
  min-height: 570px;
  place-items: center;
  align-content: center;
  padding: 40px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: rgb(255 253 253 / 78%);
  box-shadow: var(--shadow-medium);
  text-align: center;
}

.empty-result > div {
  display: grid;
  width: 74px;
  height: 74px;
  margin-bottom: 18px;
  place-items: center;
  border-radius: 24px;
  color: var(--sage-dark);
  background: var(--sage-pale);
}

.empty-result p {
  max-width: 500px;
  margin: 10px auto 18px;
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.7;
}

.empty-result ul {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  color: var(--text-muted);
  font-size: 0.7rem;
  list-style: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 960px) {
  .reconstruction-layout {
    grid-template-columns: 1fr;
  }

  .setup-column {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reconstruct-button,
  .error-message {
    grid-column: 1 / -1;
  }
}

@media (max-width: 680px) {
  .reconstruction-hero {
    align-items: start;
  }

  .hero-mark {
    display: none;
  }

  .setup-column {
    grid-template-columns: 1fr;
  }

  .result-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .result-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .result-actions > div:last-child {
    justify-content: stretch;
  }

  .result-actions button {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>
