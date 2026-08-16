<script setup lang="ts">
import { computed } from 'vue'
import type { FormSchemaField, ValidationResult } from '@contract-kit/kernel'

const props = defineProps<{
  name: string
  fields: FormSchemaField[]
  validation: ValidationResult
}>()

const emit = defineEmits<{
  setValue: [name: string, value: unknown]
}>()

const field = computed(() => props.fields.find((item) => item.name === props.name))
const error = computed(() => props.validation.issues.find((issue) => issue.path === props.name)?.message)
const type = computed(() => field.value?.type ?? 'text')
const textValue = computed(() => (field.value?.value == null ? '' : String(field.value.value)))
const numberValue = computed(() =>
  typeof field.value?.value === 'number'
    ? field.value.value
    : textValue.value === ''
      ? undefined
      : Number(textValue.value),
)
</script>

<template>
  <span class="custom-field" :class="{ 'is-error': Boolean(error) }" :title="error || field?.label || name">
    <el-select
      v-if="type === 'select' && field?.options?.length"
      size="small"
      class="custom-control"
      :model-value="textValue || undefined"
      placeholder="请选择"
      clearable
      teleported
      @update:model-value="emit('setValue', name, $event ?? '')"
    >
      <el-option v-for="opt in field.options" :key="opt.value" :label="opt.label" :value="opt.value" />
    </el-select>

    <el-input
      v-else-if="type === 'textarea'"
      type="textarea"
      class="custom-control custom-textarea"
      :autosize="{ minRows: 2, maxRows: 5 }"
      :model-value="textValue"
      @update:model-value="emit('setValue', name, $event)"
    />

    <el-date-picker
      v-else-if="type === 'date'"
      size="small"
      class="custom-control custom-date"
      type="date"
      value-format="YYYY-MM-DD"
      placeholder="选择日期"
      :model-value="textValue || undefined"
      teleported
      @update:model-value="emit('setValue', name, $event ?? '')"
    />

    <el-input-number
      v-else-if="type === 'number'"
      size="small"
      class="custom-control"
      :controls="false"
      :model-value="numberValue"
      @update:model-value="emit('setValue', name, $event ?? '')"
    />

    <el-input
      v-else
      size="small"
      class="custom-control"
      :model-value="textValue"
      @update:model-value="emit('setValue', name, $event)"
    />
  </span>
</template>
