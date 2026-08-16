<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { FormSchemaField, ValidationResult } from '@contract-kit/kernel'
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
  const field = props.fields.find((item) => item.name === props.name)
  const error = props.validation.issues.find((issue) => issue.path === props.name)?.message
  if (!handle) {
    handle = nativeFieldMounter(el, {
      name: props.name,
      field,
      error,
      onChange: (value) => emit('setValue', props.name, value),
    })
    return
  }
  handle.update({ field, value: field?.value, error })
}

watch([host, () => props.fields, () => props.validation], sync, { immediate: true, deep: true })

onBeforeUnmount(() => {
  handle?.destroy()
  handle = null
})
</script>

<template>
  <span ref="host" class="ck-field-host" />
</template>
