<script setup lang="ts">
import { getCurrentInstance, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import type { PdfExportMode } from '@contract-kit/pdf'
import DefinitionPanel from '@shared/DefinitionPanel.vue'
import DocxLayout from '@shared/DocxLayout.vue'
import XlsxDocument from '@shared/XlsxDocument.vue'
import { downloadBuffer, useContract } from '@shared/use-contract'
import ElementField from './fields/ElementField.vue'
import { createElementFieldMounter } from './fields/element-mounter'

const appContext = getCurrentInstance()?.appContext
const mountField = createElementFieldMounter(appContext)

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
const exportingPdf = ref(false)
const pdfMode = ref<PdfExportMode>('html2canvas')

async function onOpenPublished(nextKind: 'docx' | 'xlsx') {
  try {
    await openPublished(nextKind)
    ElMessage.success('已打开已发布模板')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '打开失败')
  }
}

async function onUploadDocument(file: UploadFile) {
  if (!file.raw) return
  try {
    await openDocument(file.raw)
    ElMessage.success('已打开合同文件')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  }
}

async function onUploadDefinition(file: File) {
  try {
    await applyDefinition(file)
    ElMessage.success('已套用字段定义')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '加载失败')
  }
}

async function onApplyDefinitionVariant(variant: 'default' | 'alt') {
  try {
    await applyPublishedDefinition(variant)
    ElMessage.success(variant === 'alt' ? '已套用 alt definition' : '已恢复默认 definition')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '套用失败')
  }
}

async function onUpdateField(id: string, patch: { label?: string; required?: boolean }) {
  try {
    await updateFieldMeta(id, patch)
    ElMessage.success('已更新字段定义')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '更新失败')
  }
}

function onDownloadDefinition() {
  try {
    downloadDefinition(
      kind.value === 'xlsx' ? '采购合同.xlsx.definition.json' : '采购合同.docx.definition.json',
    )
    ElMessage.success('已下载 definition JSON')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '下载失败')
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
    ElMessage.success('已导出')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '导出失败')
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
      ElMessage.success('请在打印对话框中选择「另存为 PDF」')
    } else if (result) {
      downloadBuffer(result, '采购合同-已填写.pdf', 'application/pdf')
      ElMessage.success('已导出 PDF')
    }
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '导出 PDF 失败')
  } finally {
    exportingPdf.value = false
  }
}
</script>

<template>
  <el-container class="page">
    <el-header class="header" height="auto">
      <div>
        <h1>自定义 UI 示例</h1>
        <p>Element Plus 字段 + 右侧 definition 配置示例。</p>
      </div>
      <div class="header-actions">
        <el-button :loading="loading" @click="onOpenPublished('docx')">打开 Word</el-button>
        <el-button :loading="loading" @click="onOpenPublished('xlsx')">打开 Excel</el-button>
        <el-upload accept=".docx,.xlsx" :show-file-list="false" :auto-upload="false" :on-change="onUploadDocument">
          <el-button :loading="loading">上传合同</el-button>
        </el-upload>
        <el-button v-if="kind" @click="reset">清空</el-button>
        <el-select v-if="kind" v-model="pdfMode" size="default" style="width: 220px">
          <el-option label="PDF: html2canvas" value="html2canvas" />
          <el-option label="PDF: canvas-draw-element" value="canvas-draw-element" />
          <el-option label="PDF: print" value="print" />
        </el-select>
        <el-button v-if="kind" :loading="exportingPdf" @click="onExportPdf">导出 PDF</el-button>
        <el-button v-if="kind" type="primary" @click="onExport">导出文件</el-button>
      </div>
    </el-header>

    <el-main class="main">
      <div v-if="!kind || !preview" class="start">
        <h2>采购合同 · 自定义字段</h2>
        <p>
          演示自绘字段：在文档标记处挂 Element Plus。打开后可在右侧切换 / 编辑 definition。标记如
          <code>{{ markerPartyA }}</code>
          。
        </p>
        <div class="start-actions">
          <a class="start-link" href="/templates/采购合同.docx" download>下载 Word</a>
          <a class="start-link" href="/templates/采购合同.xlsx" download>下载 Excel</a>
          <a class="start-link" href="/templates/采购合同.docx.definition.json" download>默认 definition</a>
          <a class="start-link" href="/templates/采购合同.docx.definition.alt.json" download>alt definition</a>
          <el-button type="primary" :loading="loading" @click="onOpenPublished('docx')">打开 Word 合同</el-button>
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
              :mount-field="mountField"
              @set-value="setValue"
            />
          </div>

          <div v-else-if="preview.kind === 'xlsx'" class="paper paper-sheet">
            <XlsxDocument
              :sheets="preview.sheets"
              :fields="schema.fields"
              :validation="validation"
              :field-component="ElementField"
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
    </el-main>
  </el-container>
</template>
