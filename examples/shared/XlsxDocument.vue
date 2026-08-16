<script setup lang="ts">
import type { Component } from 'vue'
import type { FormSchemaField, ValidationResult, XlsxPreviewSheet } from '@contract-kit/kernel'

defineProps<{
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
</script>

<template>
  <div v-for="sheet in sheets" :key="sheet.name" class="sheet">
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
