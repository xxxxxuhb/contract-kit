<script setup lang="ts">
import { computed } from 'vue'
import type { FormSchemaField, ValidationResult } from 'contract-kit'
import { resolveFieldSlot } from '~/utils/resolve-field'

const props = defineProps<{
  name: string
  fields: FormSchemaField[]
  validation: ValidationResult
  /** 槽位挂载时可直接传入，避免二次解析丢值 */
  value?: unknown
}>()

const emit = defineEmits<{
  setValue: [name: string, value: unknown]
}>()

const resolved = computed(() => resolveFieldSlot(props.name, props.fields, props.validation))
const field = computed(() => resolved.value.field)
const type = computed(() => field.value?.type ?? 'text')

const currentValue = computed(() => {
  if (props.value !== undefined) return props.value
  return resolved.value.value
})

const textValue = computed(() => (currentValue.value == null ? '' : String(currentValue.value)))
const multiValue = computed(() => {
  const value = currentValue.value
  if (Array.isArray(value)) return value.map(String)
  return []
})
const numberValue = computed(() =>
  typeof currentValue.value === 'number'
    ? currentValue.value
    : textValue.value === ''
      ? undefined
      : Number(textValue.value),
)

/** display / image 不参与 el-form 必填规则，仍包一层便于布局 */
const formProp = computed(() =>
  type.value === 'display' || type.value === 'image' ? undefined : props.name,
)

function onImageChange(file: File | undefined) {
  if (!file) {
    emit('setValue', props.name, '')
    return
  }
  const reader = new FileReader()
  reader.onload = () => emit('setValue', props.name, typeof reader.result === 'string' ? reader.result : '')
  reader.readAsDataURL(file)
}
</script>

<template>
  <el-form-item
    class="ck-inline-form-item"
    :prop="formProp"
    :label="undefined"
    :show-message="true"
  >
    <span class="custom-field" :title="field?.label || name">
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

      <el-select
        v-else-if="type === 'multiselect' && field?.options?.length"
        size="small"
        class="custom-control"
        multiple
        collapse-tags
        collapse-tags-tooltip
        :model-value="multiValue"
        placeholder="请选择"
        teleported
        @update:model-value="emit('setValue', name, $event ?? [])"
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

      <span v-else-if="type === 'display'" class="custom-display">{{ textValue }}</span>

      <el-upload
        v-else-if="type === 'image'"
        :auto-upload="false"
        :show-file-list="false"
        accept="image/*"
        @change="(file) => onImageChange(file.raw)"
      >
        <el-button size="small">{{ textValue ? '已选图片' : '选择图片' }}</el-button>
      </el-upload>

      <el-input
        v-else
        size="small"
        class="custom-control"
        :model-value="textValue"
        @update:model-value="emit('setValue', name, $event)"
      />
    </span>
  </el-form-item>
</template>
