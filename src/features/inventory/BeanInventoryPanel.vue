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

const props = defineProps<{
  palette: BeadPalette
  selectedColor: number
  rows: InventoryRow[]
  totalStock: number
  totalUsed: number
  totalRemaining: number
  totalShortage: number
}>()

const emit = defineEmits<{
  setStock: [colorId: string, value: number]
}>()

const showAll = ref(false)
const selectedRow = computed(() => props.rows[props.selectedColor - 1])
const activeRows = computed(() => {
  const rows = props.rows.filter((row) => row.stock > 0 || row.used > 0)
  return showAll.value ? rows : rows.slice(0, 8)
})

function updateStock(colorId: string, event: Event) {
  emit('setStock', colorId, Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <section class="panel inventory-panel">
    <div class="panel-heading">
      <div>
        <p class="panel-label">豆仓</p>
        <h2>{{ palette.brand }} 库存</h2>
      </div>
      <span class="warehouse-badge">本机保存</span>
    </div>

    <div class="inventory-metrics">
      <div>
        <strong>{{ totalStock }}</strong
        ><span>库存</span>
      </div>
      <div>
        <strong>{{ totalUsed }}</strong
        ><span>本图使用</span>
      </div>
      <div>
        <strong>{{ totalRemaining }}</strong
        ><span>可用剩余</span>
      </div>
      <div :class="{ warning: totalShortage > 0 }">
        <strong>{{ totalShortage }}</strong
        ><span>缺豆</span>
      </div>
    </div>

    <label v-if="selectedRow" class="stock-editor">
      <span>
        <i :style="{ backgroundColor: selectedRow.color.hex }" />
        当前色 {{ selectedRow.color.code }} 的库存
      </span>
      <input
        :value="selectedRow.stock"
        :aria-label="`${selectedRow.color.code} 库存数量`"
        type="number"
        min="0"
        max="999999"
        inputmode="numeric"
        @change="updateStock(selectedRow.color.id, $event)"
      />
    </label>

    <div v-if="activeRows.length" class="inventory-list">
      <div v-for="row in activeRows" :key="row.color.id" class="inventory-row">
        <i :style="{ backgroundColor: row.color.hex }" />
        <strong>{{ row.color.code }}</strong>
        <span>用 {{ row.used }}</span>
        <span v-if="row.shortage" class="shortage">缺 {{ row.shortage }}</span>
        <span v-else>余 {{ row.remaining }}</span>
      </div>
      <button
        v-if="rows.filter((row) => row.stock > 0 || row.used > 0).length > 8"
        class="list-toggle"
        type="button"
        @click="showAll = !showAll"
      >
        {{ showAll ? '收起' : '查看全部' }}
      </button>
    </div>
    <p v-else class="inventory-empty">
      在色卡中选中颜色后录入库存；画布用量会自动从豆仓扣减。
    </p>
  </section>
</template>

<style scoped>
.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.panel-label {
  margin-bottom: 4px;
}

h2 {
  margin: 0;
  font-size: 0.95rem;
}

.warehouse-badge {
  padding: 4px 7px;
  border-radius: 999px;
  color: var(--sage-dark);
  background: var(--sage-pale);
  font-size: 0.62rem;
  font-weight: 800;
}

.inventory-metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin: 12px 0;
}

.inventory-metrics div {
  display: grid;
  padding: 9px;
  border-radius: 9px;
  background: var(--surface-muted);
}

.inventory-metrics strong {
  font-size: 1rem;
}

.inventory-metrics span,
.inventory-empty,
.inventory-row {
  color: var(--text-muted);
  font-size: 0.66rem;
}

.inventory-metrics .warning {
  color: #9b3f47;
  background: var(--rose-pale);
}

.stock-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 74px;
  align-items: center;
  gap: 8px;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 0.68rem;
}

.stock-editor span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stock-editor i,
.inventory-row i {
  flex: none;
  width: 15px;
  height: 15px;
  border: 1px solid rgb(0 0 0 / 14%);
  border-radius: 50%;
}

.stock-editor input {
  min-width: 0;
  width: 100%;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 7px;
}

.inventory-list {
  display: grid;
  gap: 5px;
  margin-top: 10px;
}

.inventory-row {
  display: grid;
  grid-template-columns: 16px 32px 1fr auto;
  align-items: center;
  gap: 5px;
}

.inventory-row strong {
  color: var(--text);
}

.shortage {
  color: #9b3f47;
  font-weight: 800;
}

.list-toggle {
  padding: 5px;
  border: 0;
  color: var(--accent-strong);
  background: transparent;
  font-size: 0.66rem;
}

.inventory-empty {
  margin: 10px 0 0;
  line-height: 1.55;
}
</style>
