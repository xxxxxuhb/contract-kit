import type {
  FormSchema,
  KernelState,
  ValidationResult,
  ViewModel,
} from './types'

export function emptyValidation(): ValidationResult {
  return { ok: true, issues: [] }
}

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === ''
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
      columns: field.columns,
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
    const label = field.label ?? field.name

    if (field.type === 'table') {
      const rows = Array.isArray(value) ? value : []
      if (field.required && rows.length === 0) {
        issues.push({ path: field.name, message: `${label} 必填` })
      }
      const columns = field.columns ?? []
      rows.forEach((row, rowIndex) => {
        const record =
          row && typeof row === 'object' && !Array.isArray(row)
            ? (row as Record<string, unknown>)
            : {}
        for (const col of columns) {
          if (!col.required) continue
          if (isEmptyValue(record[col.name])) {
            issues.push({
              path: `${field.name}.${rowIndex}.${col.name}`,
              message: `${col.label ?? col.name} 必填`,
            })
          }
        }
      })
      continue
    }

    if (field.required && isEmptyValue(value)) {
      issues.push({ path: field.name, message: `${label} 必填` })
    }
    if (
      field.type === 'select' &&
      !isEmptyValue(value) &&
      field.options &&
      !field.options.some((opt) => opt.value === value)
    ) {
      issues.push({ path: field.name, message: `${label} 不在选项中` })
    }
  }

  return { ok: issues.length === 0, issues }
}
