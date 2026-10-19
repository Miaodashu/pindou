<script setup lang="ts">
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Layers3 } from '@lucide/vue'
import { ref } from 'vue'

const props = defineProps<{
  imageUrl: string
  fileName: string
  visible: boolean
  opacity: number
  offsetX: number
  offsetY: number
}>()

const emit = defineEmits<{
  upload: [file: File]
  settingsChange: [
    settings: Partial<{
      visible: boolean
      opacity: number
      offsetX: number
      offsetY: number
    }>,
  ]
}>()

const input = ref<HTMLInputElement>()
const errorMessage = ref('')

function upload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    errorMessage.value = '请选择 PNG、JPEG 或 WebP 图片。'
  } else if (file.size > 25 * 1024 * 1024) {
    errorMessage.value = '垫图不能超过 25 MB。'
  } else {
    errorMessage.value = ''
    emit('upload', file)
  }
  target.value = ''
}

function move(dx: number, dy: number) {
  emit('settingsChange', {
    offsetX: props.offsetX + dx,
    offsetY: props.offsetY + dy,
  })
}
</script>

<template>
  <section class="panel tracing-panel">
    <div class="tracing-heading">
      <div>
        <p class="panel-label">临摹垫图</p>
        <h2>参考图覆盖</h2>
      </div>
      <Layers3 :size="22" aria-hidden="true" />
    </div>

    <label class="visibility-toggle" :class="{ disabled: !imageUrl }">
      <input
        :checked="visible"
        :disabled="!imageUrl"
        type="checkbox"
        @change="
          emit('settingsChange', {
            visible: ($event.target as HTMLInputElement).checked,
          })
        "
      />
      <span
        ><strong>显示临摹垫图</strong
        ><small>仅覆盖编辑画布，不会导出</small></span
      >
    </label>

    <div class="upload-row">
      <div>
        <strong>{{ fileName || '尚未上传垫图' }}</strong>
        <small>独立图片，不会修改当前图纸</small>
      </div>
      <button type="button" @click="input?.click()">
        {{ imageUrl ? '更换垫图' : '上传垫图' }}
      </button>
      <input
        ref="input"
        class="visually-hidden"
        aria-label="上传临摹垫图"
        type="file"
        accept="image/*"
        @change="upload"
      />
    </div>
    <p v-if="errorMessage" class="tracing-error" role="alert">
      {{ errorMessage }}
    </p>

    <label class="opacity-control" :class="{ disabled: !imageUrl }">
      <span
        ><strong>透明度</strong><b>{{ Math.round(opacity * 100) }}%</b></span
      >
      <input
        :value="opacity * 100"
        :disabled="!imageUrl"
        aria-label="垫图透明度"
        type="range"
        min="5"
        max="100"
        step="1"
        @input="
          emit('settingsChange', {
            opacity: Number(($event.target as HTMLInputElement).value) / 100,
          })
        "
      />
    </label>

    <div class="alignment" :class="{ disabled: !imageUrl }">
      <div class="direction-pad">
        <button
          type="button"
          aria-label="垫图上移一格"
          :disabled="!imageUrl"
          @click="move(0, -1)"
        >
          <ArrowUp :size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="垫图左移一格"
          :disabled="!imageUrl"
          @click="move(-1, 0)"
        >
          <ArrowLeft :size="16" aria-hidden="true" />
        </button>
        <span>格</span>
        <button
          type="button"
          aria-label="垫图右移一格"
          :disabled="!imageUrl"
          @click="move(1, 0)"
        >
          <ArrowRight :size="16" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="垫图下移一格"
          :disabled="!imageUrl"
          @click="move(0, 1)"
        >
          <ArrowDown :size="16" aria-hidden="true" />
        </button>
      </div>
      <div class="offset-status">
        <span>偏移：{{ offsetX }}，{{ offsetY }}</span>
        <button
          type="button"
          :disabled="!imageUrl || (offsetX === 0 && offsetY === 0)"
          @click="emit('settingsChange', { offsetX: 0, offsetY: 0 })"
        >
          复位对齐画布
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tracing-heading,
.visibility-toggle,
.upload-row,
.opacity-control span,
.alignment {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tracing-heading h2 {
  margin: 0;
  font-size: 0.95rem;
}

.tracing-heading > svg {
  color: var(--accent);
}

.visibility-toggle {
  justify-content: flex-start;
  margin: 12px 0;
  padding: 11px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.visibility-toggle input {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}

.visibility-toggle span,
.upload-row > div {
  display: grid;
  gap: 2px;
}

.visibility-toggle strong,
.upload-row strong,
.opacity-control strong {
  font-size: 0.72rem;
}

.visibility-toggle small,
.upload-row small {
  color: var(--text-muted);
  font-size: 0.65rem;
  line-height: 1.45;
}

.upload-row {
  align-items: flex-start;
  padding: 12px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.upload-row strong {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-row button {
  flex: none;
}

.opacity-control {
  display: grid;
  gap: 8px;
  margin: 12px 0;
}

.opacity-control b,
.offset-status span {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.opacity-control input {
  width: 100%;
  accent-color: var(--rose-strong);
}

.alignment {
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.direction-pad {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  grid-template-rows: repeat(3, 34px);
  gap: 4px;
}

.direction-pad button:nth-child(1) {
  grid-column: 2;
}

.direction-pad button:nth-child(2) {
  grid-column: 1;
  grid-row: 2;
}

.direction-pad span {
  display: grid;
  grid-column: 2;
  grid-row: 2;
  place-items: center;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.direction-pad button:nth-child(4) {
  grid-column: 3;
  grid-row: 2;
}

.direction-pad button:nth-child(5) {
  grid-column: 2;
  grid-row: 3;
}

.direction-pad button {
  padding: 0;
  font-size: 1rem;
}

.offset-status {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.offset-status button {
  padding: 4px 0;
  border: 0;
  color: var(--accent-strong);
  background: transparent;
  font-size: 0.65rem;
}

.disabled {
  opacity: 0.55;
}

.tracing-error {
  margin: 8px 0 0;
  color: #9b3f47;
  font-size: 0.66rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
