<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { FormSchemaField, ValidationResult } from '@contract-kit/kernel'
import { resolveFieldSlot } from '@shared/resolve-field'
import { nativeFieldMounter } from './native-field'

const props = defineProps<{
  name: string
  fields: FormSchemaField[]
  validation: ValidationResult
}>()

const emit = defineEmits<{
  setValue: [name: string, value: unknown]
}>()

const host = ref<HTMLElement | null>(null)
let handle: ReturnType<typeof nativeFieldMounter> | null = null

function sync() {
  const el = host.value
  if (!el) return
  const resolved = resolveFieldSlot(props.name, props.fields, props.validation)
  if (!handle) {
    handle = nativeFieldMounter(el, {
      name: props.name,
      field: resolved.field,
      value: resolved.value,
      error: resolved.error,
      onChange: (value) => emit('setValue', props.name, value),
    })
    return
  }
  handle.update({ field: resolved.field, value: resolved.value, error: resolved.error })
}

watch([host, () => props.fields, () => props.validation, () => props.name], sync, {
  immediate: true,
  deep: true,
})

onBeforeUnmount(() => {
  handle?.destroy()
  handle = null
})
</script>

<template>
  <span ref="host" class="ck-field-host" />
</template>
