import type {
  Field,
  FieldRules,
  FieldValidator,
  FormSchema,
  KernelState,
  ValidationIssue,
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
      rules: field.rules,
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return null
}

function applyRules(
  path: string,
  label: string,
  type: Field['type'],
  value: unknown,
  rules: FieldRules | undefined,
  issues: ValidationIssue[],
) {
  if (!rules || isEmptyValue(value)) return
  const text = typeof value === 'string' ? value : String(value)
  if (rules.minLength != null && text.length < rules.minLength) {
    issues.push({ path, message: `${label} 长度不能少于 ${rules.minLength}` })
  }
  if (rules.maxLength != null && text.length > rules.maxLength) {
    issues.push({ path, message: `${label} 长度不能超过 ${rules.maxLength}` })
  }
  if (rules.pattern) {
    try {
      if (!new RegExp(rules.pattern).test(text)) {
        issues.push({ path, message: `${label} 格式不正确` })
      }
    } catch {
      issues.push({ path, message: `${label} 规则无效` })
    }
  }
  const numeric = type === 'number' || rules.min != null || rules.max != null ? asNumber(value) : null
  if (rules.min != null || rules.max != null) {
    if (numeric == null) {
      issues.push({ path, message: `${label} 须为数字` })
    } else {
      if (rules.min != null && numeric < rules.min) {
        issues.push({ path, message: `${label} 不能小于 ${rules.min}` })
      }
      if (rules.max != null && numeric > rules.max) {
        issues.push({ path, message: `${label} 不能大于 ${rules.max}` })
      }
    }
  }
  if ((type === 'date' || rules.dateFormat) && !DATE_RE.test(text)) {
    issues.push({ path, message: `${label} 须为 YYYY-MM-DD` })
  }
}

export function validateState(
  state: KernelState,
  validators: FieldValidator[] = [],
): ValidationResult {
  const issues: ValidationIssue[] = []
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
          const path = `${field.name}.${rowIndex}.${col.name}`
          const cell = record[col.name]
          if (col.required && isEmptyValue(cell)) {
            issues.push({ path, message: `${col.label ?? col.name} 必填` })
          }
          applyRules(path, col.label ?? col.name, col.type, cell, col.rules, issues)
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
    if (field.type === 'date' && !isEmptyValue(value) && !DATE_RE.test(String(value))) {
      issues.push({ path: field.name, message: `${label} 须为 YYYY-MM-DD` })
    }
    applyRules(field.name, label, field.type, value, field.rules, issues)
  }

  for (const validator of validators) {
    const extra = validator({ data: state.data, fields })
    if (!extra) continue
    if (Array.isArray(extra)) issues.push(...extra)
    else issues.push(extra)
  }

  return { ok: issues.length === 0, issues }
}
