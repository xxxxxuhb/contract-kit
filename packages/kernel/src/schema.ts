import type {
  FormSchema,
  KernelState,
  ValidationResult,
  ViewModel,
} from './types'

export function emptyValidation(): ValidationResult {
  return { ok: true, issues: [] }
}

export function buildFormSchema(state: KernelState): FormSchema {
  const fields = state.definition?.fields ?? []
  return {
    fields: fields.map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
      label: field.label ?? field.name,
      required: Boolean(field.required),
      options: field.options,
      value: state.data[field.name],
    })),
  }
}

export function buildView(state: KernelState): ViewModel {
  const fields = state.definition?.fields ?? []
  return fields.map((field) => ({
    id: field.id,
    label: field.label ?? field.name,
    value: state.data[field.name] ?? null,
  }))
}

export function validateState(state: KernelState): ValidationResult {
  const issues: ValidationResult['issues'] = []
  const fields = state.definition?.fields ?? []

  for (const field of fields) {
    const value = state.data[field.name]
    if (field.required && (value === undefined || value === null || value === '')) {
      issues.push({ path: field.name, message: `${field.label ?? field.name} 必填` })
    }
    if (
      field.type === 'select' &&
      value !== undefined &&
      value !== null &&
      value !== '' &&
      field.options &&
      !field.options.some((opt) => opt.value === value)
    ) {
      issues.push({ path: field.name, message: `${field.label ?? field.name} 不在选项中` })
    }
  }

  return { ok: issues.length === 0, issues }
}
