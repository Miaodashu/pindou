<script setup lang="ts">
import { ArrowRight, Boxes, CircleAlert, PackageCheck } from '@lucide/vue'
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { RouterLink } from 'vue-router'

import { useEditorStore } from '@/features/editor/editorStore'
import BeanInventoryPanel from '@/features/inventory/BeanInventoryPanel.vue'

const store = useEditorStore()
const { palette, pattern, inventorySummary } = storeToRefs(store)

onMounted(() => store.hydrate())
</script>

<template>
  <div class="inventory-page" :aria-busy="!store.isHydrated">
    <section class="inventory-hero">
      <div class="hero-copy">
        <p class="eyebrow">BEAD INVENTORY</p>
        <h1>独立豆仓，清楚掌握每一个色号</h1>
        <p class="hero-description">
          按 Mard
          色号登记现有豆子，自动结合当前图纸计算用量、剩余与缺口。库存保存在当前浏览器，不占用编辑器画布空间。
        </p>
        <div class="hero-actions">
          <RouterLink class="primary-action" to="/editor">
            回到图纸编辑器
            <ArrowRight :size="17" aria-hidden="true" />
          </RouterLink>
          <span>当前图纸：{{ pattern.title }}</span>
        </div>
      </div>

      <div class="hero-status" aria-label="豆仓状态摘要">
        <div class="status-icon">
          <Boxes :size="28" aria-hidden="true" />
        </div>
        <div>
          <span>豆仓状态</span>
          <strong v-if="inventorySummary.totalShortage">
            还缺 {{ inventorySummary.totalShortage }} 颗
          </strong>
          <strong v-else>当前材料充足</strong>
        </div>
        <CircleAlert
          v-if="inventorySummary.totalShortage"
          class="status-mark warning"
          :size="22"
          aria-hidden="true"
        />
        <PackageCheck
          v-else
          class="status-mark ready"
          :size="22"
          aria-hidden="true"
        />
      </div>
    </section>

    <BeanInventoryPanel
      :palette="palette"
      :rows="inventorySummary.rows"
      :total-stock="inventorySummary.totalStock"
      :total-used="inventorySummary.totalUsed"
      :total-remaining="inventorySummary.totalRemaining"
      :total-shortage="inventorySummary.totalShortage"
      @set-stock="store.setInventoryStock"
    />
  </div>
</template>

<style scoped>
.inventory-page {
  min-height: calc(100vh - 78px);
  padding: clamp(28px, 5vw, 68px) clamp(18px, 5vw, 76px) 72px;
  background:
    radial-gradient(circle at 8% 4%, rgb(232 180 184 / 26%), transparent 28%),
    radial-gradient(circle at 92% 10%, rgb(168 213 186 / 28%), transparent 24%),
    var(--background);
}

.inventory-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
  align-items: end;
  gap: 36px;
  width: min(1180px, 100%);
  margin: 0 auto 34px;
}

.hero-copy {
  max-width: 760px;
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--sage-dark);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.22em;
}

h1 {
  max-width: 720px;
  margin: 0;
  font-family: 'Cormorant Garamond', 'Noto Serif SC', serif;
  font-size: clamp(2.4rem, 5vw, 4.4rem);
  line-height: 0.98;
  letter-spacing: -0.035em;
}

.hero-description {
  max-width: 690px;
  margin: 20px 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.85;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 11px 17px;
  border-radius: 13px;
  color: var(--text);
  background: var(--gold);
  box-shadow: 0 10px 26px rgb(134 102 18 / 18%);
  font-size: 0.78rem;
  font-weight: 800;
  text-decoration: none;
}

.primary-action:hover {
  transform: translateY(-2px);
}

.hero-actions > span {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.hero-status {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 22px;
  border: 1px solid rgb(53 104 78 / 13%);
  border-radius: 22px;
  background: rgb(255 253 253 / 82%);
  box-shadow: var(--shadow-small);
  backdrop-filter: blur(12px);
}

.status-icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  color: var(--sage-dark);
  background: var(--sage-pale);
}

.hero-status > div:nth-child(2) {
  display: grid;
  gap: 4px;
}

.hero-status span {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.hero-status strong {
  font-size: 0.86rem;
}

.status-mark.warning {
  color: var(--rose-strong);
}

.status-mark.ready {
  color: var(--sage-dark);
}

.inventory-page > :deep(.inventory-workspace) {
  width: min(1180px, 100%);
  margin: 0 auto;
}

@media (max-width: 820px) {
  .inventory-hero {
    grid-template-columns: 1fr;
  }

  .hero-status {
    max-width: 440px;
  }
}

@media (max-width: 520px) {
  .inventory-page {
    min-height: calc(100vh - 68px);
    padding-top: 34px;
  }

  h1 {
    font-size: 2.65rem;
  }
}
</style>
