import type { FieldType } from './types'

const FIELD_TYPES = new Set<string>([
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'multiselect',
  'table',
  'image',
])

const MARKER_RE =
  /\{\{\s*([^\s:{}]+)\s*(?::\s*([A-Za-z_][A-Za-z0-9_]*))?\s*\}\}/g

export interface ParsedMarker {
  name: string
  type: FieldType
  raw: string
}

export function parseMarkers(text: string): ParsedMarker[] {
  const re = new RegExp(MARKER_RE.source, 'g')
  const out: ParsedMarker[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const name = match[1]
    if (seen.has(name)) continue
    seen.add(name)
    const typeName = match[2]
    const type: FieldType =
      typeName && FIELD_TYPES.has(typeName) ? (typeName as FieldType) : 'text'
    out.push({ name, type, raw: match[0] })
  }
  return out
}

export function stringifyFieldValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (Array.isArray(value)) return value.map(stringifyFieldValue).join(', ')
  return ''
}

export type MarkerSegment =
  | { kind: 'text'; text: string }
  | { kind: 'field'; name: string }

export function splitByMarkers(text: string): MarkerSegment[] {
  const re = new RegExp(MARKER_RE.source, 'g')
  const out: MarkerSegment[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match.index > last) out.push({ kind: 'text', text: text.slice(last, match.index) })
    out.push({ kind: 'field', name: match[1] })
    last = match.index + match[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

export function replaceMarkers(text: string, data: Record<string, unknown>): string {
  const re = new RegExp(MARKER_RE.source, 'g')
  return text.replace(re, (_raw, name: string) => stringifyFieldValue(data[name]))
}
