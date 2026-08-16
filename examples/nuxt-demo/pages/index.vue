<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { nativeFieldMounter } from '~/utils/native-mounter'
import { downloadBuffer, downloadFilledPdf, officeMime } from '~/utils/export-file'

const {
  list,
  payload,
  buffer,
  schema,
  preview,
  validation,
  loading,
  loadList,
  openContract,
  setValue,
  insertRow,
  removeRow,
  exportFile,
  validate,
  reset,
} = useContract()

const busy = ref<'docx' | 'xlsx' | 'pdf' | null>(null)
const validateMsg = ref<string | null>(null)

const xlsxSheets = computed(() => (preview.value?.kind === 'xlsx' ? preview.value.sheets : []))
const tableFields = computed(() => schema.value.fields.filter((field) => field.type === 'table'))

function tableLength(field: { value?: unknown }) {
  return Array.isArray(field.value) ? field.value.length : 0
}

onMounted(() => {
  void loadList().catch((err) => {
    validateMsg.value = err instanceof Error ? err.message : '加载失败'
  })
})

async function onOpen(id: string) {
  validateMsg.value = null
  try {
    await openContract(id)
  } catch (err) {
    validateMsg.value = err instanceof Error ? err.message : '打开失败'
  }
}

function onValidate() {
  const result = validate()
  validateMsg.value = result.ok
    ? '校验通过（kernel.validate）'
    : `校验未通过：${result.issues.map((i) => `${i.path} ${i.message}`).join('；')}`
}

async function onExportOffice(format: 'docx' | 'xlsx') {
  if (payload.value?.kind !== format) return
  busy.value = format
  try {
    const file = await exportFile()
    downloadBuffer(`${payload.value?.title ?? 'contract'}.${file.format}`, file.buffer, officeMime(file.format))
  } catch (err) {
    validateMsg.value = err instanceof Error ? err.message : '导出失败'
  } finally {
    busy.value = null
  }
}

async function onExportPdf() {
  busy.value = 'pdf'
  try {
    const file = await exportFile()
    await downloadFilledPdf(payload.value?.title ?? 'contract', file.format, file.buffer)
  } catch (err) {
    validateMsg.value = err instanceof Error ? err.message : '导出 PDF 失败'
  } finally {
    busy.value = null
  }
}

function onClose() {
  validateMsg.value = null
  reset()
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <h1>paperfill · Nuxt · 原生 UI</h1>
        <p>
          paperfill · 校验 = kernel.validate() ·
          <NuxtLink to="/custom">自定义 UI（Element Plus）→</NuxtLink>
        </p>
      </div>
      <div v-if="payload" class="header-actions">
        <button type="button" class="btn btn-primary" @click="onValidate">校验</button>
        <button
          type="button"
          class="btn"
          :disabled="Boolean(busy) || payload.kind !== 'docx'"
          @click="onExportOffice('docx')"
        >
          {{ busy === 'docx' ? '导出中…' : '导出 Word' }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="Boolean(busy) || payload.kind !== 'xlsx'"
          @click="onExportOffice('xlsx')"
        >
          {{ busy === 'xlsx' ? '导出中…' : '导出 Excel' }}
        </button>
        <button type="button" class="btn" :disabled="Boolean(busy)" @click="onExportPdf">
          {{ busy === 'pdf' ? '导出中…' : '导出 PDF' }}
        </button>
        <button type="button" class="btn" @click="onClose">关闭</button>
      </div>
    </header>

    <main class="main">
      <div v-if="validateMsg" class="banner" :class="validateMsg.startsWith('校验通过') ? 'ok' : 'error'">
        {{ validateMsg }}
      </div>

      <section v-if="!payload" class="start">
        <h2>从后端打开合同</h2>
        <p>Nuxt server routes 模拟后端：definition / data / options / file。</p>
        <div class="card-list">
          <button
            v-for="item in list"
            :key="item.id"
            type="button"
            class="contract-card"
            :disabled="loading"
            @click="onOpen(item.id)"
          >
            <strong>{{ item.title }}</strong>
            <span>{{ item.description }}</span>
            <em>{{ loading ? '加载中…' : `打开 · ${item.kind}` }}</em>
          </button>
        </div>
      </section>

      <div v-else class="workspace">
        <aside class="side">
          <h3>状态</h3>
          <p class="hint">{{ payload.title }} · {{ payload.kind }}</p>
          <div class="banner" :class="validation.ok ? 'ok' : 'error'">
            实时：{{ validation.ok ? '通过' : validation.issues.map((i) => i.path).join(', ') }}
          </div>
          <template v-if="tableFields.length">
            <h3>明细表</h3>
            <div v-for="field in tableFields" :key="field.id" class="table-block">
              <p class="table-title">{{ field.label ?? field.name }} · {{ tableLength(field) }} 行</p>
              <button type="button" class="btn" @click="insertRow(field.name)">加一行</button>
              <button
                type="button"
                class="btn"
                :disabled="tableLength(field) === 0"
                @click="removeRow(field.name, tableLength(field) - 1)"
              >
                删末行
              </button>
            </div>
          </template>
        </aside>
        <div class="doc-frame">
          <ClientOnly>
            <DocxLayout
              v-if="payload.kind === 'docx' && buffer"
              :buffer="buffer"
              :fields="schema.fields"
              :validation="validation"
              :mount-field="nativeFieldMounter"
              @set-value="(path, value) => setValue(path, value)"
            />
            <XlsxDocument
              v-else-if="payload.kind === 'xlsx'"
              :sheets="xlsxSheets"
              :fields="schema.fields"
              :validation="validation"
              :mount-field="nativeFieldMounter"
              @set-value="(path, value) => setValue(path, value)"
            />
          </ClientOnly>
        </div>
      </div>
    </main>
  </div>
</template>
