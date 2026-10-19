<script setup lang="ts">
import { computed, ref } from 'vue'

import { mard221Palette } from '@/domain/palette/mardPalette'
import { parsePaletteDocument } from '@/domain/palette/parsePalette'
import type { BeadPalette } from '@/domain/palette/types'

const props = defineProps<{
  palette: BeadPalette
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  install: [palette: BeadPalette]
}>()

const paletteTemplateUrl = `${import.meta.env.BASE_URL}examples/palette-template.json`

const input = ref<HTMLInputElement>()
const errorMessage = ref('')
const query = ref('')
const activeSeries = ref('ALL')
const series = computed(() => [
  'ALL',
  ...new Set(
    props.palette.colors.map(
      (color) => color.code.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? '其他',
    ),
  ),
])
const selected = computed(() => props.palette.colors[props.modelValue - 1])
const filteredColors = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  return props.palette.colors
    .map((color, index) => ({ color, index }))
    .filter(({ color }) => {
      const colorSeries = color.code.match(/^[A-Z]+/i)?.[0]?.toUpperCase()
      if (activeSeries.value !== 'ALL' && colorSeries !== activeSeries.value) {
        return false
      }
      if (!normalized) return true
      return [color.code, color.name, color.hex].some((value) =>
        value.toLowerCase().includes(normalized),
      )
    })
})
const sourceLabels: Record<BeadPalette['source'], string> = {
  official: '官方数据',
  measured: '实物测色',
  'digital-reference': '数字参考',
}

async function importPalette(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const palette = parsePaletteDocument(JSON.parse(await file.text()))
    errorMessage.value = ''
    emit('install', palette)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : '无法读取这个色卡文件。'
  } finally {
    target.value = ''
  }
}
</script>

<template>
  <section class="panel palette-panel">
    <div class="panel-heading">
      <div>
        <p class="kicker">色卡</p>
        <h2>{{ palette.name }}</h2>
        <small class="source"
          >{{ palette.brand }} · v{{ palette.version }}</small
        >
      </div>
      <span class="badge">{{ palette.colors.length }} 色</span>
    </div>

    <p v-if="palette.disclaimer" class="notice">{{ palette.disclaimer }}</p>

    <div class="palette-actions">
      <div>
        <button
          v-if="palette.id !== mard221Palette.id"
          type="button"
          @click="emit('install', mard221Palette)"
        >
          使用 Mard 221
        </button>
        <button type="button" @click="input?.click()">导入 JSON</button>
        <a :href="paletteTemplateUrl" download>下载模板</a>
      </div>
      <input
        ref="input"
        class="visually-hidden"
        type="file"
        accept="application/json,.json"
        @change="importPalette"
      />
      <span>来源：{{ sourceLabels[palette.source] }}</span>
    </div>
    <p v-if="errorMessage" class="error-message" role="alert">
      {{ errorMessage }}
    </p>

    <label class="palette-search">
      <span class="visually-hidden">搜索色号</span>
      <input v-model="query" type="search" placeholder="搜索色号、名称或 HEX" />
    </label>

    <div v-if="selected" class="selected-summary" aria-live="polite">
      <span
        class="selected-swatch"
        :style="{ backgroundColor: selected.hex }"
      />
      <span
        ><strong>{{ selected.code }}</strong
        >{{ selected.name }}</span
      >
      <code>{{ selected.hex }}</code>
    </div>

    <div class="series-filter" aria-label="按色系筛选">
      <button
        v-for="item in series"
        :key="item"
        type="button"
        :class="{ active: activeSeries === item }"
        :aria-pressed="activeSeries === item"
        :aria-label="item === 'ALL' ? '全部色系' : `${item} 色系`"
        @click="activeSeries = item"
      >
        {{ item === 'ALL' ? '全部' : item }}
      </button>
    </div>

    <div class="color-grid">
      <button
        v-for="{ color, index } in filteredColors"
        :key="color.id"
        class="color-button"
        :class="{ active: modelValue === index + 1 }"
        :aria-label="`${color.code} ${color.name}`"
        :title="`${color.code} · ${color.name}`"
        type="button"
        @click="emit('update:modelValue', index + 1)"
      >
        <span class="swatch" :style="{ backgroundColor: color.hex }" />
        <span>{{ color.code }}</span>
      </button>
    </div>
    <p v-if="filteredColors.length === 0" class="no-results">
      没有找到匹配的颜色。
    </p>
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
  gap: 12px;
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

.badge {
  padding: 4px 8px;
  border-radius: 999px;
  color: var(--accent-strong);
  background: var(--rose-pale);
  font-size: 0.7rem;
  font-weight: 800;
}

.source {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.notice {
  margin: 14px 0;
  padding: 10px 12px;
  border-radius: 10px;
  color: #5c4b1a;
  background: #fbf3d6;
  font-size: 0.75rem;
  line-height: 1.55;
}

.palette-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 12px;
}

.palette-actions > div {
  display: flex;
  gap: 6px;
}

.palette-actions button,
.palette-actions a {
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  background: var(--surface);
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}

.palette-actions span,
.error-message {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.palette-search {
  display: block;
  margin-bottom: 10px;
}

.palette-search input {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fffafa;
  font-size: 0.75rem;
  outline: none;
}

.palette-search input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgb(146 77 86 / 14%);
}

.no-results {
  margin: 14px 0 2px;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-align: center;
}

.selected-summary {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-muted);
}

.selected-summary span:nth-child(2) {
  display: grid;
  color: var(--text-muted);
  font-size: 0.66rem;
}

.selected-summary strong {
  color: var(--text);
  font-size: 0.78rem;
}

.selected-summary code {
  color: var(--text-muted);
  font-size: 0.62rem;
}

.selected-swatch {
  width: 28px;
  height: 28px;
  border: 1px solid rgb(32 28 24 / 16%);
  border-radius: 50%;
}

.series-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 9px;
}

.series-filter button {
  min-width: 28px;
  padding: 5px 7px;
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text-muted);
  background: var(--surface);
  font-size: 0.65rem;
  font-weight: 800;
  cursor: pointer;
}

.series-filter button.active {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: var(--rose-pale);
}

.error-message {
  margin: -4px 0 12px;
  color: #9b3f47;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  max-height: 430px;
  padding-right: 4px;
  overflow-y: auto;
  scrollbar-color: #caa9ad transparent;
  scrollbar-width: thin;
}

.color-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 7px 3px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--text-muted);
  background: transparent;
  font-size: 0.66rem;
  cursor: pointer;
}

.color-button:hover,
.color-button.active {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: var(--rose-pale);
}

.swatch {
  width: 25px;
  height: 25px;
  border: 1px solid rgb(32 28 24 / 16%);
  border-radius: 50%;
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 45%);
}
</style>
