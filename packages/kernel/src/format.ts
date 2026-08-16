import { stringifyFieldValue } from './markers'
import type { Field, FieldColumn, FieldFormatter, FieldOption, FieldType, TemplateDefinition } from './types'

export type FormatTarget = {
  type: FieldType
  outputFormat?: string
  options?: FieldOption[]
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function parseDateParts(value: unknown): { y: number; m: number; d: number } | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { y: value.getUTCFullYear(), m: value.getUTCMonth() + 1, d: value.getUTCDate() }
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

function formatDate(value: unknown, pattern: string): string | null {
  const parts = parseDateParts(value)
  if (!parts) return null
  const YYYY = String(parts.y)
  const YY = YYYY.slice(-2)
  const MM = String(parts.m).padStart(2, '0')
  const DD = String(parts.d).padStart(2, '0')
  return pattern
    .replace(/YYYY/g, YYYY)
    .replace(/YY/g, YY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
    .replace(/M/g, String(parts.m))
    .replace(/D/g, String(parts.d))
}

function looksLikeDatePattern(pattern: string): boolean {
  return /YYYY|YY|MM|DD/.test(pattern)
}

function looksLikeNumberPattern(pattern: string): boolean {
  return /^[#0,.]+$/.test(pattern)
}

function formatNumber(value: unknown, pattern: string): string | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))
        ? Number(value)
        : null
  if (n == null || !Number.isFinite(n)) return null
  const decMatch = /\.(0+)/.exec(pattern)
  const decimals = decMatch ? decMatch[1].length : pattern.includes('.') ? 0 : 0
  const grouped = pattern.includes(',')
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  })
}

function optionLabel(options: FieldOption[] | undefined, value: unknown): string {
  const key = String(value)
  return options?.find((opt) => opt.value === key)?.label ?? key
}

export function formatFieldValue(
  value: unknown,
  target: FormatTarget,
  ctx?: {
    name?: string
    data?: Record<string, unknown>
    formatters?: Record<string, FieldFormatter>
  },
): unknown {
  if (target.type === 'image' || isEmpty(value)) return value

  const pattern = target.outputFormat
  if (!pattern) return value

  const custom = ctx?.formatters?.[pattern]
  if (custom) {
    return custom({
      value,
      field: target as Field | FieldColumn,
      name: ctx?.name ?? '',
      data: ctx?.data ?? {},
    })
  }

  if (pattern === 'label') {
    if (target.type === 'multiselect' && Array.isArray(value)) {
      return value.map((item) => optionLabel(target.options, item)).join(', ')
    }
    if (target.type === 'select' || target.type === 'multiselect') {
      return optionLabel(target.options, value)
    }
  }

  if (target.type === 'date' || looksLikeDatePattern(pattern)) {
    return formatDate(value, pattern) ?? stringifyFieldValue(value)
  }

  if (target.type === 'number' || looksLikeNumberPattern(pattern)) {
    return formatNumber(value, pattern) ?? stringifyFieldValue(value)
  }

  return value
}

export function formatData(
  definition: TemplateDefinition,
  data: Record<string, unknown>,
  formatters?: Record<string, FieldFormatter>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data }
  for (const field of definition.fields) {
    if (!(field.name in data)) continue
    const value = data[field.name]
    if (field.type === 'table') {
      if (!Array.isArray(value)) continue
      out[field.name] = value.map((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return row
        const next = { ...(row as Record<string, unknown>) }
        for (const col of field.columns ?? []) {
          if (!(col.name in next)) continue
          next[col.name] = formatFieldValue(next[col.name], col, {
            formatters,
            data,
            name: `${field.name}.${col.name}`,
          })
        }
        return next
      })
      continue
    }
    out[field.name] = formatFieldValue(value, field, {
      formatters,
      data,
      name: field.name,
    })
  }
  return out
}
