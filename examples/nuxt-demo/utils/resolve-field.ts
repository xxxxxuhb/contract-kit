import type { FormSchemaField, ValidationResult } from 'paperfill'

export function resolveFieldSlot(
  name: string,
  fields: FormSchemaField[],
  validation: ValidationResult,
): {
  field: Partial<FormSchemaField> | null
  value: unknown
  error?: string
} {
  const error = validation.issues.find((issue) => issue.path === name)?.message

  // 槽位已展开为单元格 field（name=items.0.qty）时直接用，避免再按表名二次解析失败
  const direct = fields.find((item) => item.name === name) ?? null
  if (direct) {
    return { field: direct, value: direct.value, error }
  }

  const nested = /^([^.]+)\.(\d+)\.([^.]+)$/.exec(name)
  if (nested) {
    const [, table, indexStr, column] = nested
    const tableField = fields.find((item) => item.name === table)
    const rowIndex = Number(indexStr)
    const rows = Array.isArray(tableField?.value) ? (tableField!.value as Record<string, unknown>[]) : []
    const col = tableField?.columns?.find((item) => item.name === column)
    const value = rows[rowIndex]?.[column]
    return {
      field: {
        name,
        type: col?.type ?? 'text',
        label: col?.label ?? column,
        required: Boolean(col?.required),
        options: col?.options,
        value,
      },
      value,
      error,
    }
  }

  return {
    field: null,
    value: undefined,
    error,
  }
}
