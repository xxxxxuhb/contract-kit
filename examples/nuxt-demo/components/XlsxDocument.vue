<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import {
  mountXlsxPreview,
  type FormSchemaField,
  type ValidationResult,
  type XlsxPreviewHandle,
  type XlsxPreviewSheet,
} from 'contract-kit'
import type { FieldMounter } from '~/utils/field-types'

const props = defineProps<{
  sheets: XlsxPreviewSheet[]
  fields: FormSchemaField[]
  validation: ValidationResult
  mountField: FieldMounter
}>()

const emit = defineEmits<{
  setValue: [path: string, value: unknown]
}>()

const host = { value: null as HTMLElement | null }
let preview: XlsxPreviewHandle | null = null

function setHost(el: Element | null) {
  host.value = el as HTMLElement | null
  void nextTick(() => paint())
}

function paint() {
  const el = host.value
  if (!el) return
  preview?.destroy()
  preview = mountXlsxPreview(el, {
    sheets: props.sheets,
    fields: props.fields,
    validation: props.validation,
    mountField: props.mountField,
    onChange: (path, value) => emit('setValue', path, value),
  })
}

watch(
  () => [props.sheets, props.fields, props.validation, props.mountField] as const,
  () => {
    void nextTick(() => paint())
  },
  { deep: true },
)

onBeforeUnmount(() => {
  preview?.destroy()
  preview = null
})
</script>

<template>
  <div class="ck-xlsx-host" :ref="setHost" />
</template>
