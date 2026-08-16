<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  parseTableColumnRef,
  type FormSchemaField,
  type PreviewInline,
  type ValidationResult,
  type XlsxPreviewCell,
  type XlsxPreviewSheet,
} from '@contract-kit/kernel'

const props = defineProps<{
  sheets: XlsxPreviewSheet[]
  fields: FormSchemaField[]
  validation: ValidationResult
  fieldComponent: Component
}>()

const emit = defineEmits<{
  setValue: [name: string, value: unknown]
}>()

function colStyle(width: number | undefined) {
  const em = Math.max(width ?? 12, 6)
  return { width: `${em * 8}px` }
}

function tableRows(field: FormSchemaField): Record<string, unknown>[] {
  return Array.isArray(field.value) ? (field.value as Record<string, unknown>[]) : []
}

function rewriteInlines(inlines: PreviewInline[], tableName: string, index: number): PreviewInline[] {
  const prefix = `${tableName}.`
  const out: PreviewInline[] = []
  for (const inline of inlines) {
    if (inline.type === 'text') {
      out.push(inline)
      continue
    }
    if (!inline.name.startsWith(prefix)) {
      out.push(inline)
      continue
    }
    const column = inline.name.slice(prefix.length)
    if (column === '$index') {
      out.push({ type: 'text', text: String(index + 1) })
      continue
    }
    out.push({ type: 'field', name: `${tableName}.${index}.${column}` })
  }
  return out
}

function rowTableName(row: XlsxPreviewCell[]): string | null {
  for (const cell of row) {
    for (const inline of cell.inlines) {
      if (inline.type !== 'field') continue
      const ref = parseTableColumnRef(inline.name)
      if (ref) return ref.table
    }
  }
  return null
}

const expandedSheets = computed(() => {
  return props.sheets.map((sheet) => {
    const cells: XlsxPreviewCell[][] = []
    for (const row of sheet.cells) {
      const tableName = rowTableName(row)
      if (!tableName) {
        cells.push(row)
        continue
      }
      const field = props.fields.find((item) => item.name === tableName)
      if (!field || field.type !== 'table') {
        cells.push(row)
        continue
      }
      const rows = tableRows(field)
      for (let i = 0; i < rows.length; i++) {
        cells.push(
          row.map((cell) => ({
            ...cell,
            inlines: rewriteInlines(cell.inlines, tableName, i),
          })),
        )
      }
    }
    return { ...sheet, cells }
  })
})
</script>

<template>
  <div v-for="sheet in expandedSheets" :key="sheet.name" class="sheet">
    <div class="sheet-name">{{ sheet.name }}</div>
    <table class="sheet-table">
      <colgroup>
        <col v-for="(width, index) in sheet.colWidths" :key="index" :style="colStyle(width)" />
      </colgroup>
      <tr v-for="(row, rowIndex) in sheet.cells" :key="rowIndex">
        <template v-for="(cell, cellIndex) in row" :key="cellIndex">
          <td v-if="!cell.skip" :colspan="cell.colspan || 1" :rowspan="cell.rowspan || 1">
            <template v-for="(inline, inlineIndex) in cell.inlines" :key="inlineIndex">
              <span v-if="inline.type === 'text'">{{ inline.text }}</span>
              <component
                :is="fieldComponent"
                v-else
                :name="inline.name"
                :fields="fields"
                :validation="validation"
                @set-value="(name: string, value: unknown) => emit('setValue', name, value)"
              />
            </template>
          </td>
        </template>
      </tr>
    </table>
  </div>
</template>
