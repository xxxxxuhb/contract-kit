<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import { mountDocxPreview, type DocxPreviewHandle, type FormSchemaField, type ValidationResult } from 'paperfill'
import type { FieldMounter } from '~/utils/field-types'

const props = defineProps<{
  buffer: Uint8Array
  fields: FormSchemaField[]
  validation: ValidationResult
  mountField: FieldMounter
}>()

const emit = defineEmits<{
  setValue: [name: string, value: unknown]
}>()

const host = { value: null as HTMLElement | null }
let preview: DocxPreviewHandle | null = null

function setHost(el: Element | null) {
  host.value = el as HTMLElement | null
  void nextTick(() => paint())
}

function paint() {
  const el = host.value
  if (!el) return
  preview?.destroy()
  preview = mountDocxPreview(el, {
    buffer: props.buffer,
    fields: props.fields,
    validation: props.validation,
    mountField: props.mountField,
    onChange: (path, value) => emit('setValue', path, value),
  })
}

function tableSignature() {
  return props.fields
    .filter((field) => field.type === 'table')
    .map((field) => `${field.name}:${Array.isArray(field.value) ? field.value.length : 0}`)
    .join('|')
}

watch(
  () => props.buffer,
  () => {
    void nextTick(() => paint())
  },
)

watch(tableSignature, () => {
  void nextTick(() => {
    void preview?.update({
      buffer: props.buffer,
      fields: props.fields,
      validation: props.validation,
      mountField: props.mountField,
    })
  })
})

watch(
  () => [props.fields, props.validation, props.mountField] as const,
  () => {
    void preview?.update({
      fields: props.fields,
      validation: props.validation,
      mountField: props.mountField,
    })
  },
  { deep: true },
)

onBeforeUnmount(() => {
  preview?.destroy()
  preview = null
})
</script>

<template>
  <div class="docx-host" :ref="setHost"></div>
</template>
