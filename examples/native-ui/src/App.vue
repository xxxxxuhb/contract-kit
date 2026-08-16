<script setup lang="ts">
import { ref } from 'vue'
import type { PdfExportMode } from '@contract-kit/pdf'
import DefinitionPanel from '@shared/DefinitionPanel.vue'
import DocxLayout from '@shared/DocxLayout.vue'
import XlsxDocument from '@shared/XlsxDocument.vue'
import { downloadBuffer, useContract } from '@shared/use-contract'
import NativeField from './NativeField.vue'
import { nativeFieldMounter } from './native-field'

const {
  kind,
  schema,
  preview,
  sourceBuffer,
  validation,
  loading,
  openPublished,
  openDocument,
  applyDefinition,
  applyPublishedDefinition,
  updateFieldMeta,
  downloadDefinition,
  setValue,
  reset,
  exportFile,
} = useContract()

const markerPartyA = '{{partyA}}'
const markerHints = '{{partyA}}、{{amount:number}}、{{payMethod:select}}、{{signDate:date}}'
const toast = ref<{ text: string; error?: boolean } | null>(null)
const exportingPdf = ref(false)
/** 外部决定 PDF 方案，默认 html2canvas */
const pdfMode = ref<PdfExportMode>('html2canvas')

function showToast(text: string, error = false) {
  toast.value = { text, error }
  window.setTimeout(() => {
    toast.value = null
  }, 2200)
}

async function onOpenPublished(nextKind: 'docx' | 'xlsx') {
  try {
    await openPublished(nextKind)
    showToast('已打开已发布模板')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '打开失败', true)
  }
}

async function onUploadDocument(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    await openDocument(file)
    showToast('已打开合同文件')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '加载失败', true)
  }
}

async function onUploadDefinition(file: File) {
  try {
    await applyDefinition(file)
    showToast('已套用字段定义')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '加载失败', true)
  }
}

async function onApplyDefinitionVariant(variant: 'default' | 'alt') {
  try {
    await applyPublishedDefinition(variant)
    showToast(variant === 'alt' ? '已套用 alt definition' : '已恢复默认 definition')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '套用失败', true)
  }
}

async function onUpdateField(id: string, patch: { label?: string; required?: boolean }) {
  try {
    await updateFieldMeta(id, patch)
    showToast('已更新字段定义')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '更新失败', true)
  }
}

function onDownloadDefinition() {
  try {
    downloadDefinition(
      kind.value === 'xlsx' ? '采购合同.xlsx.definition.json' : '采购合同.docx.definition.json',
    )
    showToast('已下载 definition JSON')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '下载失败', true)
  }
}

async function onExport() {
  try {
    const result = await exportFile()
    const mime =
      result.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    downloadBuffer(result.buffer, `采购合同-已填写.${result.format}`, mime)
    showToast('已导出')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出失败', true)
  }
}

async function onExportPdf() {
  exportingPdf.value = true
  try {
    const filled = await exportFile()
    const { exportFilledContractPdf } = await import('@shared/export-pdf')
    const result = await exportFilledContractPdf({
      kind: filled.format,
      buffer: filled.buffer,
      mode: pdfMode.value,
    })
    if (pdfMode.value === 'print') {
      showToast('请在打印对话框中选择「另存为 PDF」')
    } else if (result) {
      downloadBuffer(result, '采购合同-已填写.pdf', 'application/pdf')
      showToast('已导出 PDF')
    }
  } catch (err) {
    showToast(err instanceof Error ? err.message : '导出 PDF 失败', true)
  } finally {
    exportingPdf.value = false
  }
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <h1>原生 UI 示例</h1>
        <p>字段控件来自 <code>@contract-kit/ui</code>；右侧可改 definition（不必改代码）。</p>
      </div>
      <div class="header-actions">
        <button class="btn" type="button" :disabled="loading" @click="onOpenPublished('docx')">打开 Word</button>
        <button class="btn" type="button" :disabled="loading" @click="onOpenPublished('xlsx')">打开 Excel</button>
        <label class="btn">
          上传合同
          <input hidden type="file" accept=".docx,.xlsx" @change="onUploadDocument" />
        </label>
        <button v-if="kind" class="btn" type="button" @click="reset">清空</button>
        <select v-if="kind" v-model="pdfMode" class="btn pdf-mode" title="PDF 导出方案">
          <option value="html2canvas">PDF: html2canvas</option>
          <option value="canvas-draw-element">PDF: canvas-draw-element</option>
          <option value="print">PDF: print</option>
        </select>
        <button v-if="kind" class="btn" type="button" :disabled="exportingPdf" @click="onExportPdf">
          {{ exportingPdf ? '导出中…' : '导出 PDF' }}
        </button>
        <button v-if="kind" class="btn btn-primary" type="button" @click="onExport">导出文件</button>
      </div>
    </header>

    <main class="main">
      <div v-if="!kind || !preview" class="start">
        <h2>采购合同 · 原生字段</h2>
        <p>
          演示默认接入：hydrate 模板后，用
          <code>mountField</code>
          把
          <code>{{ markerPartyA }}</code>
          换成原生控件。打开后可在右侧切换 / 编辑 definition。
        </p>
        <div class="start-actions">
          <a class="start-link" href="/templates/采购合同.docx" download>下载 Word</a>
          <a class="start-link" href="/templates/采购合同.xlsx" download>下载 Excel</a>
          <a class="start-link" href="/templates/采购合同.docx.definition.json" download>默认 definition</a>
          <a class="start-link" href="/templates/采购合同.docx.definition.alt.json" download>alt definition</a>
          <button class="btn btn-primary" type="button" :disabled="loading" @click="onOpenPublished('docx')">
            打开 Word 合同
          </button>
        </div>
        <p class="start-hint">标记：{{ markerHints }}</p>
      </div>

      <div v-else class="workspace">
        <div>
          <div v-if="kind === 'docx' && sourceBuffer" class="docx-frame">
            <DocxLayout
              :buffer="sourceBuffer"
              :fields="schema.fields"
              :validation="validation"
              :mount-field="nativeFieldMounter"
              @set-value="setValue"
            />
          </div>

          <div v-else-if="preview.kind === 'xlsx'" class="paper-sheet">
            <XlsxDocument
              :sheets="preview.sheets"
              :fields="schema.fields"
              :validation="validation"
              :field-component="NativeField"
              @set-value="setValue"
            />
          </div>
        </div>

        <DefinitionPanel
          :fields="schema.fields"
          :loading="loading"
          @apply-variant="onApplyDefinitionVariant"
          @update-field="onUpdateField"
          @download="onDownloadDefinition"
          @upload="onUploadDefinition"
        />
      </div>
    </main>

    <div v-if="toast" class="toast" :class="{ 'is-error': toast.error }">{{ toast.text }}</div>
  </div>
</template>
