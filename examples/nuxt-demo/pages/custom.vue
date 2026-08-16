<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { buildElFormRules } from '~/utils/form-rules'
import { downloadBuffer, downloadFilledPdf, officeMime } from '~/utils/export-file'

const {
  list,
  payload,
  buffer,
  schema,
  preview,
  slotValidation,
  loading,
  loadList,
  openContract,
  setValue,
  exportFile,
  getData,
  reset,
} = useContract()

const formRef = ref<FormInstance>()
const formModel = reactive<Record<string, unknown>>({})
const busy = ref<'docx' | 'xlsx' | 'pdf' | null>(null)

const rules = computed(() => {
  if (!payload.value) return {}
  return buildElFormRules(payload.value.definition, formModel)
})

const xlsxSheets = computed(() => (preview.value?.kind === 'xlsx' ? preview.value.sheets : []))

watch(
  () => schema.value.fields,
  () => {
    const data = getData()
    for (const key of Object.keys(formModel)) {
      if (!(key in data)) delete formModel[key]
    }
    Object.assign(formModel, structuredClone(data))
  },
  { deep: true },
)

onMounted(() => {
  void loadList().catch((err) => ElMessage.error(err instanceof Error ? err.message : '加载失败'))
})

async function onOpen(id: string) {
  try {
    await openContract(id)
    Object.keys(formModel).forEach((key) => delete formModel[key])
    Object.assign(formModel, structuredClone(getData()))
    ElMessage.success('已从后端打开合同')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '打开失败')
  }
}

async function onSetValue(path: string, value: unknown) {
  await setValue(path, value)
  const parts = path.split('.')
  if (parts.length === 1) formModel[path] = value
  else Object.assign(formModel, structuredClone(getData()))
}

async function onValidate() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    ElMessage.success('校验通过（合同内 el-form rules）')
  } catch {
    ElMessage.error('校验未通过，请查看合同内红色提示')
  }
}

async function onExportOffice(format: 'docx' | 'xlsx') {
  if (payload.value?.kind !== format) return
  busy.value = format
  try {
    const file = await exportFile()
    downloadBuffer(`${payload.value?.title ?? 'contract'}.${file.format}`, file.buffer, officeMime(file.format))
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '导出失败')
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
    ElMessage.error(err instanceof Error ? err.message : '导出 PDF 失败')
  } finally {
    busy.value = null
  }
}

function onClose() {
  reset()
  Object.keys(formModel).forEach((key) => delete formModel[key])
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <h1>contract-kit · Nuxt · 自定义 UI</h1>
        <p>
          合同外包 el-form，字段内 el-form-item ·
          <NuxtLink to="/">原生 UI →</NuxtLink>
        </p>
      </div>
      <div v-if="payload" class="header-actions">
        <el-button type="primary" @click="onValidate">校验</el-button>
        <el-button :loading="busy === 'docx'" :disabled="Boolean(busy) || payload.kind !== 'docx'" @click="onExportOffice('docx')">
          导出 Word
        </el-button>
        <el-button :loading="busy === 'xlsx'" :disabled="Boolean(busy) || payload.kind !== 'xlsx'" @click="onExportOffice('xlsx')">
          导出 Excel
        </el-button>
        <el-button :loading="busy === 'pdf'" :disabled="Boolean(busy)" @click="onExportPdf">导出 PDF</el-button>
        <el-button @click="onClose">关闭</el-button>
      </div>
    </header>

    <main class="main">
      <section v-if="!payload" class="start">
        <h2>从后端打开合同</h2>
        <p>校验提示出现在合同标记处（el-form-item）。</p>
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

      <div v-else class="workspace workspace-single">
        <div class="doc-frame">
          <el-form
            ref="formRef"
            class="contract-el-form"
            :model="formModel"
            :rules="rules"
            :inline-message="true"
            size="small"
            @submit.prevent
          >
            <ClientOnly>
              <ContractDocHost
                :kind="payload.kind"
                :buffer="buffer"
                :fields="schema.fields"
                :validation="slotValidation"
                :sheets="xlsxSheets"
                @set-value="onSetValue"
              />
            </ClientOnly>
          </el-form>
        </div>
      </div>
    </main>
  </div>
</template>
