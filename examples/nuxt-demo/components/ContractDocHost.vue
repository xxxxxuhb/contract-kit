<script setup lang="ts">
import { getCurrentInstance, inject } from 'vue'
import { formContextKey, type FormContext } from 'element-plus'
import type { FormSchemaField, ValidationResult, XlsxPreviewSheet } from 'contract-kit'
import { createElementFieldMounter } from '~/components/fields/element-mounter'
import DocxLayout from '~/components/DocxLayout.vue'
import XlsxDocument from '~/components/XlsxDocument.vue'

const props = defineProps<{
  kind: 'docx' | 'xlsx'
  buffer: Uint8Array | null
  fields: FormSchemaField[]
  validation: ValidationResult
  sheets: XlsxPreviewSheet[]
}>()

const emit = defineEmits<{
  setValue: [path: string, value: unknown]
}>()

const appContext = getCurrentInstance()?.appContext
const formContext = inject(formContextKey, undefined) as FormContext | undefined
const mountField = createElementFieldMounter(appContext, formContext)

function onSetValue(path: string, value: unknown) {
  emit('setValue', path, value)
}
</script>

<template>
  <DocxLayout
    v-if="kind === 'docx' && buffer"
    :buffer="buffer"
    :fields="fields"
    :validation="validation"
    :mount-field="mountField"
    @set-value="onSetValue"
  />
  <XlsxDocument
    v-else-if="kind === 'xlsx'"
    :sheets="sheets"
    :fields="fields"
    :validation="validation"
    :mount-field="mountField"
    @set-value="onSetValue"
  />
</template>
