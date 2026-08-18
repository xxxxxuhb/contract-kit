import type { FieldColumn, FieldType, MarkerDelimiters } from './types'

const FIELD_TYPES = new Set<string>([
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'multiselect',
  'table',
  'image',
  'display',
])

/** Pair of delimiter strings. Default is `{{` / `}}`. */
export const DEFAULT_MARKERS: MarkerDelimiters = { start: '{{', end: '}}' }

export function normalizeMarkers(markers?: MarkerDelimiters | null): MarkerDelimiters {
  const start = markers?.start ?? DEFAULT_MARKERS.start
  const end = markers?.end ?? DEFAULT_MARKERS.end
  if (!start || !end) {
    throw new Error('markers.start and markers.end must be non-empty')
  }
  return { start, end }
}

export function isDefaultMarkers(markers: MarkerDelimiters): boolean {
  return markers.start === DEFAULT_MARKERS.start && markers.end === DEFAULT_MARKERS.end
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** `{{name}}` is the default contract. `:type` is an optional discover hint; definition wins. */
export type MarkerSyntax = {
  delimiters: MarkerDelimiters
  start: string
  end: string
  regex(): RegExp
  contains(text: string): boolean
  wrap(name: string, type?: FieldType): string
  namedRegex(name: string, flags?: string): RegExp
}

const syntaxCache = new Map<string, MarkerSyntax>()

export function createMarkerSyntax(markers?: MarkerDelimiters | null): MarkerSyntax {
  const delimiters = normalizeMarkers(markers)
  const key = `${delimiters.start}\0${delimiters.end}`
  const cached = syntaxCache.get(key)
  if (cached) return cached

  const startRe = escapeRe(delimiters.start)
  const endRe = escapeRe(delimiters.end)
  const source = `${startRe}\\s*([^\\s:]+?)\\s*(?::\\s*([A-Za-z_][A-Za-z0-9_]*))?\\s*${endRe}`

  const syntax: MarkerSyntax = {
    delimiters,
    start: delimiters.start,
    end: delimiters.end,
    regex() {
      return new RegExp(source, 'g')
    },
    contains(text: string) {
      return text.includes(delimiters.start)
    },
    wrap(name: string, type?: FieldType) {
      if (!type || type === 'text') return `${delimiters.start}${name}${delimiters.end}`
      return `${delimiters.start}${name}:${type}${delimiters.end}`
    },
    namedRegex(name: string, flags = 'g') {
      return new RegExp(
        `${startRe}\\s*${escapeRe(name)}(?:\\s*:\\s*[A-Za-z_][A-Za-z0-9_]*)?\\s*${endRe}`,
        flags,
      )
    },
  }
  syntaxCache.set(key, syntax)
  return syntax
}

export interface ParsedMarker {
  name: string
  type: FieldType
  raw: string
}

export type TableColumnRef = {
  table: string
  column: string
}

/** `items.name` / `items.$index` → table ref; plain `partyA` → null */
export function parseTableColumnRef(markerName: string): TableColumnRef | null {
  const dot = markerName.indexOf('.')
  if (dot <= 0 || dot === markerName.length - 1) return null
  const table = markerName.slice(0, dot)
  const column = markerName.slice(dot + 1)
  if (!table || !column || column.includes('.')) return null
  return { table, column }
}

export function parseMarkers(text: string, markers?: MarkerDelimiters | null): ParsedMarker[] {
  const re = createMarkerSyntax(markers).regex()
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

/**
 * Collapse `items.name` / `items.qty` markers into one `table` field + columns.
 * `$index` is not a column. Flat markers stay as-is.
 */
export function aggregateMarkerFields(markers: ParsedMarker[]): Array<{
  name: string
  type: FieldType
  columns?: FieldColumn[]
}> {
  const tables = new Map<string, Map<string, FieldType>>()
  const flat: Array<{ name: string; type: FieldType }> = []
  const flatSeen = new Set<string>()

  for (const marker of markers) {
    const ref = parseTableColumnRef(marker.name)
    if (ref) {
      if (ref.column === '$index') continue
      let cols = tables.get(ref.table)
      if (!cols) {
        cols = new Map()
        tables.set(ref.table, cols)
      }
      if (!cols.has(ref.column)) cols.set(ref.column, marker.type)
      continue
    }
    if (flatSeen.has(marker.name)) continue
    flatSeen.add(marker.name)
    flat.push({ name: marker.name, type: marker.type })
  }

  const out: Array<{ name: string; type: FieldType; columns?: FieldColumn[] }> = []
  for (const [name, cols] of tables) {
    out.push({
      name,
      type: 'table',
      columns: [...cols.entries()].map(([colName, colType]) => ({
        name: colName,
        type: colType,
        label: colName,
      })),
    })
  }
  for (const item of flat) {
    out.push({ name: item.name, type: item.type })
  }
  return out
}

export function stringifyFieldValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') {
    if (/^data:image\//i.test(value)) return ''
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (Array.isArray(value)) return value.map(stringifyFieldValue).join(', ')
  return ''
}

export type MarkerSegment =
  | { kind: 'text'; text: string }
  | { kind: 'field'; name: string }

export function splitByMarkers(text: string, markers?: MarkerDelimiters | null): MarkerSegment[] {
  const re = createMarkerSyntax(markers).regex()
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

export type ReplaceMarkersOptions = {
  /** `keep` (default) leaves the marker; `blank` clears it (export bind). */
  missing?: 'keep' | 'blank'
}

/** Flat replace from data[name]. Missing keys keep the marker by default. */
export function replaceMarkers(
  text: string,
  data: Record<string, unknown>,
  options?: ReplaceMarkersOptions,
  markers?: MarkerDelimiters | null,
): string {
  const missing = options?.missing ?? 'keep'
  const re = createMarkerSyntax(markers).regex()
  return text.replace(re, (raw, name: string) => {
    if (!(name in data)) return missing === 'blank' ? '' : raw
    return stringifyFieldValue(data[name])
  })
}

/**
 * Replace only `{{tableName.col}}` / `{{tableName.$index}}` for one row.
 * Other markers are left unchanged for a later flat pass.
 */
export function replaceRowMarkers(
  text: string,
  tableName: string,
  row: Record<string, unknown>,
  index: number,
  markers?: MarkerDelimiters | null,
): string {
  const re = createMarkerSyntax(markers).regex()
  const prefix = `${tableName}.`
  return text.replace(re, (raw, name: string) => {
    if (!name.startsWith(prefix)) return raw
    const column = name.slice(prefix.length)
    if (column === '$index') return String(index + 1)
    return stringifyFieldValue(row[column])
  })
}

/** True if text contains any `tableName.` marker */
export function textHasTableMarkers(
  text: string,
  tableName?: string,
  markers?: MarkerDelimiters | null,
): boolean {
  for (const marker of parseMarkers(text, markers)) {
    const ref = parseTableColumnRef(marker.name)
    if (!ref) continue
    if (!tableName || ref.table === tableName) return true
  }
  return false
}

/** Table field names referenced by dotted markers in text */
export function tableNamesInText(text: string, markers?: MarkerDelimiters | null): string[] {
  const names = new Set<string>()
  for (const marker of parseMarkers(text, markers)) {
    const ref = parseTableColumnRef(marker.name)
    if (ref) names.add(ref.table)
  }
  return [...names]
}
