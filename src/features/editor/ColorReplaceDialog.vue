<script setup lang="ts">
import { ArrowRight, Search, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { deltaE2000 } from '@/core/color'
import type { BeadPalette } from '@/domain/palette/types'

type FilterMode = 'nearby' | 'inventory' | 'used' | 'all'

const props = defineProps<{
  open: boolean
  fromColorIndex: number
  count: number
  palette: BeadPalette
  usedColorIndexes: number[]
  inventoryQuantities: Record<string, number>
  selectionCount?: number
}>()

const emit = defineEmits<{
  close: []
  replace: [payload: { toColorIndex: number; selectionOnly: boolean }]
}>()

const filter = ref<FilterMode>('nearby')
const query = ref('')
const targetColorIndex = ref<number>()
const selectionOnly = ref(false)

const source = computed(() =>
  props.fromColorIndex > 0
    ? props.palette.colors[props.fromColorIndex - 1]
    : undefined,
)
const target = computed(() =>
  targetColorIndex.value && targetColorIndex.value > 0
    ? props.palette.colors[targetColorIndex.value - 1]
    : undefined,
)
const hasTarget = computed(() => targetColorIndex.value !== undefined)
const targetLabel = computed(() =>
  targetColorIndex.value === 0 ? '透明背景' : target.value?.code,
)
const used = computed(() => new Set(props.usedColorIndexes))

const colors = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  const candidates = props.palette.colors
    .map((color, index) => ({
      color,
      colorIndex: index + 1,
      distance: source.value
        ? deltaE2000(source.value.lab, color.lab)
        : Number.POSITIVE_INFINITY,
      stock: props.inventoryQuantities[color.id] ?? 0,
    }))
    .filter(({ colorIndex, color, stock }) => {
      if (colorIndex === props.fromColorIndex) return false
      if (
        normalized &&
        ![color.code, color.name, color.hex].some((value) =>
          value.toLowerCase().includes(normalized),
        )
      ) {
        return false
      }
      if (filter.value === 'inventory') return stock > 0
      if (filter.value === 'used') return used.value.has(colorIndex)
      return true
    })
    .sort((first, second) => {
      if (filter.value === 'inventory') {
        const firstEnough = first.stock >= props.count ? 1 : 0
        const secondEnough = second.stock >= props.count ? 1 : 0
        if (firstEnough !== secondEnough) return secondEnough - firstEnough
      }
      if (filter.value === 'all' && normalized) {
        return first.color.code.localeCompare(second.color.code)
      }
      return first.distance - second.distance
    })
  return filter.value === 'nearby' && !normalized
    ? candidates.slice(0, 16)
    : candidates
})

function confirmReplacement() {
  if (targetColorIndex.value === undefined) return
  emit('replace', {
    toColorIndex: targetColorIndex.value,
    selectionOnly: selectionOnly.value && (props.selectionCount ?? 0) > 0,
  })
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    filter.value = 'nearby'
    query.value = ''
    targetColorIndex.value = undefined
    selectionOnly.value = false
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="replace-backdrop"
      role="presentation"
      @pointerdown.self="emit('close')"
    >
      <section
        class="replace-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-title"
      >
        <header>
          <div class="source-summary">
            <span
              class="large-swatch"
              :class="{ transparent: !source }"
              :style="source ? { backgroundColor: source.hex } : undefined"
            />
            <div>
              <h2 id="replace-title">替换颜色</h2>
              <p>{{ source?.code ?? '透明背景' }} · {{ count }} 格</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭替换颜色"
            @click="emit('close')"
          >
            <X :size="20" aria-hidden="true" />
          </button>
        </header>

        <div class="replace-body">
          <nav class="filter-tabs" aria-label="替换颜色筛选">
            <button
              v-for="item in [
                ['nearby', '邻近色'],
                ['inventory', '豆仓可用'],
                ['used', '当前用色'],
                ['all', '全部色卡'],
              ] as const"
              :key="item[0]"
              type="button"
              :class="{ active: filter === item[0] }"
              @click="filter = item[0]"
            >
              {{ item[1] }}
            </button>
          </nav>

          <label class="search-field">
            <Search :size="17" aria-hidden="true" />
            <input
              v-model="query"
              type="search"
              placeholder="搜索色号、名称或 HEX"
            />
          </label>

          <div class="color-options">
            <button
              v-if="fromColorIndex !== 0"
              type="button"
              class="color-option clear-option"
              :class="{ selected: targetColorIndex === 0 }"
              :aria-pressed="targetColorIndex === 0"
              @click="targetColorIndex = 0"
            >
              <span class="transparent" />
              <strong>透明背景</strong>
              <small>清空这个色号</small>
            </button>
            <button
              v-for="entry in colors"
              :key="entry.color.id"
              type="button"
              class="color-option"
              :class="{ selected: targetColorIndex === entry.colorIndex }"
              :aria-pressed="targetColorIndex === entry.colorIndex"
              @click="targetColorIndex = entry.colorIndex"
            >
              <span :style="{ backgroundColor: entry.color.hex }" />
              <strong>{{ entry.color.code }}</strong>
              <small v-if="filter === 'inventory'"
                >库存 {{ entry.stock }}</small
              >
              <small v-else-if="Number.isFinite(entry.distance)">
                ΔE {{ entry.distance.toFixed(1) }}
              </small>
            </button>
          </div>
          <p v-if="colors.length === 0" class="empty">没有符合条件的颜色。</p>
        </div>

        <footer>
          <label v-if="(selectionCount ?? 0) > 0" class="selection-choice">
            <input v-model="selectionOnly" type="checkbox" />
            仅替换当前选区的 {{ selectionCount }} 格
          </label>
          <div v-if="hasTarget" class="replacement-preview">
            <span>{{ source?.code ?? '透明' }}</span>
            <ArrowRight :size="17" aria-hidden="true" />
            <strong>{{ targetLabel }}</strong>
          </div>
          <button type="button" class="cancel" @click="emit('close')">
            取消
          </button>
          <button
            type="button"
            class="confirm"
            :disabled="!hasTarget"
            @click="confirmReplacement"
          >
            替换{{ selectionOnly ? '选区' : `全部 ${count} 格` }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.replace-backdrop {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: grid;
  align-items: stretch;
  justify-items: end;
  background: rgb(42 32 31 / 28%);
  backdrop-filter: blur(4px);
}

.replace-dialog {
  display: grid;
  grid-template-rows: auto 1fr auto;
  width: min(620px, 94vw);
  height: 100%;
  border-left: 1px solid var(--border);
  background: var(--surface);
  box-shadow: -24px 0 64px rgb(51 34 36 / 18%);
}

header,
footer,
.source-summary,
.filter-tabs,
.search-field,
.replacement-preview,
.selection-choice {
  display: flex;
  align-items: center;
}

header {
  justify-content: space-between;
  padding: 24px 28px;
  border-bottom: 1px solid var(--border);
}

.source-summary {
  gap: 14px;
}

.large-swatch {
  width: 46px;
  height: 46px;
  border: 1px solid rgb(48 40 36 / 16%);
  border-radius: 11px;
}

.transparent {
  background: conic-gradient(#ddd 25%, white 0 50%, #ddd 0 75%, white 0) 0 0 /
    12px 12px;
}

h2,
p {
  margin: 0;
}

h2 {
  font-size: 1.12rem;
}

header p {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 0.78rem;
}

header button,
.cancel,
.confirm,
.filter-tabs button {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  cursor: pointer;
}

header button {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
}

.replace-body {
  min-height: 0;
  padding: 24px 28px;
  overflow: auto;
}

.filter-tabs {
  gap: 8px;
  overflow-x: auto;
}

.filter-tabs button {
  flex: none;
  padding: 9px 13px;
  color: var(--text-muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.filter-tabs button.active {
  border-color: var(--rose-strong);
  color: var(--rose-strong);
  background: var(--rose-pale);
}

.search-field {
  gap: 9px;
  margin: 18px 0;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: white;
}

.search-field input {
  width: 100%;
  padding: 11px 0;
  border: 0;
  outline: 0;
}

.color-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 10px;
}

.color-option {
  display: grid;
  gap: 5px;
  padding: 7px;
  border: 2px solid transparent;
  border-radius: 12px;
  color: var(--text);
  background: #faf6f4;
  cursor: pointer;
}

.color-option:hover,
.color-option.selected {
  border-color: var(--rose-strong);
  background: white;
}

.color-option > span {
  height: 48px;
  border: 1px solid rgb(48 40 36 / 13%);
  border-radius: 8px;
}

.color-option strong,
.color-option small {
  text-align: left;
}

.color-option small,
.empty {
  color: var(--text-muted);
  font-size: 0.7rem;
}

footer {
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 28px;
  border-top: 1px solid var(--border);
  background: #fffafa;
}

.selection-choice {
  gap: 7px;
  margin-right: auto;
  font-size: 0.74rem;
}

.replacement-preview {
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.cancel,
.confirm {
  padding: 10px 15px;
  font-weight: 800;
}

.confirm {
  border-color: var(--rose-strong);
  color: white;
  background: var(--rose-strong);
}

.confirm:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@media (max-width: 620px) {
  .replace-dialog {
    width: 100%;
  }

  footer {
    flex-wrap: wrap;
  }

  .selection-choice {
    width: 100%;
  }
}
</style>
