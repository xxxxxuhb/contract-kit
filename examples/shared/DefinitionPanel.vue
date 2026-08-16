<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FormSchemaField } from '@contract-kit/kernel'

const props = defineProps<{
  fields: FormSchemaField[]
  loading?: boolean
}>()

const emit = defineEmits<{
  applyVariant: [variant: 'default' | 'alt']
  updateField: [id: string, patch: { label?: string; required?: boolean }]
  download: []
  upload: [file: File]
}>()

type Draft = { id: string; name: string; type: string; label: string; required: boolean }

const drafts = ref<Draft[]>([])
const dirty = ref(false)

watch(
  () => props.fields,
  (fields) => {
    drafts.value = fields.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      label: f.label,
      required: f.required,
    }))
    dirty.value = false
  },
  { immediate: true, deep: true },
)

const requiredCount = computed(() => drafts.value.filter((d) => d.required).length)

function markDirty() {
  dirty.value = true
}

async function applyRow(row: Draft) {
  emit('updateField', row.id, { label: row.label, required: row.required })
  dirty.value = false
}

function onUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('upload', file)
}
</script>

<template>
  <aside class="def-panel">
    <header class="def-panel__head">
      <div>
        <h2>Definition 配置</h2>
        <p>
          label / required / options 存在 JSON 里，不是写死在页面代码。当前必填
          {{ requiredCount }} / {{ drafts.length }}
        </p>
      </div>
    </header>

    <div class="def-panel__actions">
      <button class="btn" type="button" :disabled="loading" @click="emit('applyVariant', 'default')">
        默认中文配置
      </button>
      <button class="btn" type="button" :disabled="loading" @click="emit('applyVariant', 'alt')">
        套用 alt 配置
      </button>
      <button class="btn" type="button" :disabled="loading" @click="emit('download')">下载 JSON</button>
      <label class="btn">
        上传 JSON
        <input hidden type="file" accept=".json,application/json" @change="onUpload" />
      </label>
    </div>

    <p class="def-panel__hint">
      alt =
      <code>*.definition.alt.json</code>
      （英文 label + 不同必填）。改完单行点「应用」走
      <code>updateField</code>；整表切换走 hydrate。
    </p>

    <div class="def-panel__list">
      <div v-for="row in drafts" :key="row.id" class="def-row">
        <div class="def-row__meta">
          <code>{{ row.name }}</code>
          <span class="def-row__type">{{ row.type }}</span>
        </div>
        <label class="def-row__label">
          Label
          <input v-model="row.label" type="text" @input="markDirty" />
        </label>
        <label class="def-row__req">
          <input v-model="row.required" type="checkbox" @change="markDirty" />
          必填
        </label>
        <button class="btn btn-primary def-row__apply" type="button" @click="applyRow(row)">应用</button>
      </div>
    </div>

    <p v-if="dirty" class="def-panel__dirty">有未点「应用」的行内修改</p>
  </aside>
</template>
