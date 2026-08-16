import type { FormSchemaField, ValidationResult } from '@contract-kit/kernel'

export function resolveFieldSlot(
  name: string,
  fields: FormSchemaField[],
  validation: ValidationResult,
): {
  field: Partial<FormSchemaField> | null
  value: unknown
  error?: string
} {
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
      error: validation.issues.find((issue) => issue.path === name)?.message,
    }
  }

  const field = fields.find((item) => item.name === name) ?? null
  return {
    field,
    value: field?.value,
    error: validation.issues.find((issue) => issue.path === name)?.message,
  }
}
