<script setup lang="ts">
import { computed, ref } from 'vue'

import type { BeadPalette } from '@/domain/palette/types'

interface InventoryRow {
  colorIndex: number
  color: BeadPalette['colors'][number]
  stock: number
  used: number
  remaining: number
  shortage: number
}

type InventoryFilter = 'all' | 'stock' | 'used' | 'shortage'

const props = defineProps<{
  palette: BeadPalette
  rows: InventoryRow[]
  totalStock: number
  totalUsed: number
  totalRemaining: number
  totalShortage: number
}>()

const emit = defineEmits<{
  setStock: [colorId: string, value: number]
}>()

const query = ref('')
const filter = ref<InventoryFilter>('all')

const filters: Array<{ id: InventoryFilter; label: string }> = [
  { id: 'all', label: '全部色号' },
  { id: 'stock', label: '有库存' },
  { id: 'used', label: '本图使用' },
  { id: 'shortage', label: '缺豆' },
]

const visibleRows = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return props.rows.filter((row) => {
    const matchesQuery =
      !needle ||
      `${row.color.code} ${row.color.name} ${row.color.hex}`
        .toLocaleLowerCase()
        .includes(needle)
    const matchesFilter =
      filter.value === 'all' ||
      (filter.value === 'stock' && row.stock > 0) ||
      (filter.value === 'used' && row.used > 0) ||
      (filter.value === 'shortage' && row.shortage > 0)
    return matchesQuery && matchesFilter
  })
})

function updateStock(colorId: string, event: Event) {
  emit('setStock', colorId, Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <section class="inventory-workspace" aria-labelledby="inventory-heading">
    <header class="workspace-header">
      <div>
        <p class="eyebrow">CURRENT PALETTE</p>
        <h2 id="inventory-heading">{{ palette.name }}</h2>
        <p>
          {{ palette.brand }} · {{ palette.colors.length }} 色 ·
          {{ palette.version }}
        </p>
      </div>
      <span class="warehouse-badge">本机自动保存</span>
    </header>

    <div class="inventory-metrics" aria-label="豆仓库存总览">
      <article>
        <span>库存总数</span>
        <strong>{{ totalStock }}</strong>
        <small>颗豆子已登记</small>
      </article>
      <article>
        <span>本图使用</span>
        <strong>{{ totalUsed }}</strong>
        <small>当前图纸材料数</small>
      </article>
      <article>
        <span>可用剩余</span>
        <strong>{{ totalRemaining }}</strong>
        <small>扣除本图用量后</small>
      </article>
      <article :class="{ warning: totalShortage > 0 }">
        <span>缺豆数量</span>
        <strong>{{ totalShortage }}</strong>
        <small>{{ totalShortage ? '建议优先补充' : '库存满足当前图纸' }}</small>
      </article>
    </div>

    <div class="inventory-controls">
      <label class="inventory-search">
        <span class="visually-hidden">搜索豆仓色号</span>
        <input
          v-model="query"
          type="search"
          placeholder="搜索色号、名称或 HEX"
        />
      </label>
      <div class="inventory-filters" aria-label="库存筛选">
        <button
          v-for="item in filters"
          :key="item.id"
          type="button"
          :class="{ active: filter === item.id }"
          :aria-pressed="filter === item.id"
          @click="filter = item.id"
        >
          {{ item.label }}
        </button>
      </div>
      <span class="result-count">{{ visibleRows.length }} 个色号</span>
    </div>

    <div class="inventory-table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">色号</th>
            <th scope="col">颜色</th>
            <th scope="col">库存</th>
            <th scope="col">本图使用</th>
            <th scope="col">可用 / 缺少</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.color.id">
            <td>
              <span class="color-code">{{ row.color.code }}</span>
            </td>
            <td>
              <div class="color-identity">
                <i :style="{ backgroundColor: row.color.hex }" />
                <span>
                  <strong>{{ row.color.name }}</strong>
                  <small>{{ row.color.hex.toUpperCase() }}</small>
                </span>
              </div>
            </td>
            <td>
              <label class="stock-input">
                <span class="visually-hidden"
                  >{{ row.color.code }} 库存数量</span
                >
                <input
                  :value="row.stock"
                  :aria-label="`${row.color.code} 库存数量`"
                  type="number"
                  min="0"
                  max="999999"
                  inputmode="numeric"
                  @input="updateStock(row.color.id, $event)"
                />
                <span>颗</span>
              </label>
            </td>
            <td>
              <strong>{{ row.used }}</strong>
            </td>
            <td>
              <span v-if="row.shortage" class="stock-status shortage"
                >缺 {{ row.shortage }}</span
              >
              <span v-else-if="row.stock" class="stock-status available"
                >余 {{ row.remaining }}</span
              >
              <span v-else class="stock-status empty">未登记</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="visibleRows.length === 0" class="inventory-empty">
        <strong>没有符合条件的色号</strong>
        <p>换一个关键词或筛选条件试试。</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.inventory-workspace {
  overflow: hidden;
  border: 1px solid rgb(157 79 88 / 14%);
  border-radius: 28px;
  background: rgb(255 253 253 / 96%);
  box-shadow: var(--shadow-medium);
}

.workspace-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 30px 22px;
  border-bottom: 1px solid var(--border);
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--sage-dark);
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.18em;
}

h2 {
  margin: 0;
  font-family: 'Cormorant Garamond', 'Noto Serif SC', serif;
  font-size: clamp(1.7rem, 3vw, 2.25rem);
}

.workspace-header p:last-child {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.warehouse-badge {
  flex: none;
  padding: 7px 11px;
  border: 1px solid rgb(53 104 78 / 12%);
  border-radius: 999px;
  color: var(--sage-dark);
  background: var(--sage-pale);
  font-size: 0.68rem;
  font-weight: 800;
}

.inventory-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 22px 30px;
}

.inventory-metrics article {
  display: grid;
  gap: 4px;
  padding: 18px;
  border: 1px solid rgb(53 104 78 / 9%);
  border-radius: 18px;
  background: var(--sage-pale);
}

.inventory-metrics article.warning {
  border-color: rgb(146 77 86 / 15%);
  background: var(--rose-pale);
}

.inventory-metrics span,
.inventory-metrics small {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.inventory-metrics strong {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2rem;
  line-height: 1;
}

.inventory-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 0 30px 18px;
}

.inventory-search {
  flex: 1 1 240px;
}

.inventory-search input {
  width: 100%;
  min-height: 42px;
  padding: 10px 13px;
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  background: #fffafa;
}

.inventory-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.inventory-filters button {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
  background: var(--surface);
  font-size: 0.7rem;
  font-weight: 800;
}

.inventory-filters button:hover,
.inventory-filters button.active {
  border-color: var(--rose-strong);
  color: var(--accent-strong);
  background: var(--rose-pale);
}

.result-count {
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.inventory-table-wrap {
  position: relative;
  max-height: 62vh;
  overflow: auto;
  border-top: 1px solid var(--border);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  position: sticky;
  z-index: 1;
  top: 0;
  padding: 12px 18px;
  color: var(--text-muted);
  background: #f8eeee;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 10px 18px;
  border-top: 1px solid rgb(231 217 217 / 72%);
  font-size: 0.76rem;
}

tbody tr:hover {
  background: rgb(248 232 233 / 38%);
}

.color-code {
  display: inline-grid;
  min-width: 45px;
  min-height: 30px;
  place-items: center;
  border-radius: 9px;
  color: var(--accent-strong);
  background: var(--rose-pale);
  font-family: ui-monospace, monospace;
  font-weight: 800;
}

.color-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
}

.color-identity i {
  flex: none;
  width: 28px;
  height: 28px;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 50%;
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 28%);
}

.color-identity span {
  display: grid;
  gap: 2px;
}

.color-identity small {
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
  font-size: 0.63rem;
}

.stock-input {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
}

.stock-input input {
  width: 94px;
  padding: 8px 9px;
  border: 1px solid var(--border);
  border-radius: 9px;
  color: var(--text);
  background: #fffafa;
  font-weight: 700;
}

.stock-status {
  display: inline-flex;
  min-width: 58px;
  justify-content: center;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 800;
}

.stock-status.available {
  color: var(--sage-dark);
  background: var(--sage-pale);
}

.stock-status.shortage {
  color: #8b343d;
  background: var(--rose-pale);
}

.stock-status.empty {
  color: var(--text-muted);
  background: var(--surface-muted);
}

.inventory-empty {
  padding: 70px 20px;
  color: var(--text-muted);
  text-align: center;
}

.inventory-empty p {
  margin: 6px 0 0;
  font-size: 0.76rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (max-width: 820px) {
  .inventory-metrics {
    grid-template-columns: repeat(2, 1fr);
  }

  .inventory-table-wrap {
    max-height: none;
  }
}

@media (max-width: 560px) {
  .workspace-header,
  .inventory-controls {
    padding-right: 18px;
    padding-left: 18px;
  }

  .inventory-metrics {
    gap: 8px;
    padding: 16px 18px;
  }

  .inventory-metrics article {
    padding: 13px;
  }

  th,
  td {
    padding-right: 12px;
    padding-left: 12px;
  }

  .warehouse-badge,
  th:nth-child(4),
  td:nth-child(4) {
    display: none;
  }
}
</style>
