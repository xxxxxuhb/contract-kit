<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { mountField, type FieldHandle } from '@contract-kit/ui'
import type { FormSchemaField, ValidationResult } from '@contract-kit/kernel'
import { resolveFieldSlot } from '~/utils/resolve-field'

const props = defineProps<{
  name: string
  fields: FormSchemaField[]
  validation: ValidationResult
}>()

const emit = defineEmits<{
  setValue: [name: string, value: unknown]
}>()

const host = { el: null as HTMLElement | null }
let handle: FieldHandle | null = null

function setHost(el: Element | null) {
  host.el = el as HTMLElement | null
}

function paint() {
  if (!host.el) return
  const resolved = resolveFieldSlot(props.name, props.fields, props.validation)
  handle?.destroy()
  handle = mountField(host.el, {
    name: props.name,
    field: resolved.field,
    value: resolved.value,
    error: resolved.error,
    onChange: (value) => emit('setValue', props.name, value),
  })
}

function refresh() {
  if (!handle) {
    paint()
    return
  }
  const resolved = resolveFieldSlot(props.name, props.fields, props.validation)
  handle.update({
    field: resolved.field,
    value: resolved.value,
    error: resolved.error,
  })
}

onMounted(() => paint())
watch(() => [props.fields, props.validation, props.name], refresh, { deep: true })
onBeforeUnmount(() => {
  handle?.destroy()
  handle = null
})
</script>

<template>
  <span class="ck-field-slot" :ref="setHost" :data-field="name" />
</template>
