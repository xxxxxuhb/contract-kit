import {
  parseMarkers,
  replaceMarkers,
  splitByMarkers,
  type DiscoveredField,
  type DocumentAdapter,
  type Field,
  type PreviewModel,
  type Source,
} from '@contract-kit/kernel'
import ExcelJS from 'exceljs'

function columnNumber(address: string): number {
  const letters = address.match(/^[A-Z]+/)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function rowNumber(address: string): number {
  return Number(address.match(/\d+$/)?.[0] ?? 1)
}

function parseMerge(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const [start, end] = range.split(':')
  if (!start || !end) return null
  return {
    r1: rowNumber(start),
    c1: columnNumber(start),
    r2: rowNumber(end),
    c2: columnNumber(end),
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('')
  }
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text
  }
  if (typeof value === 'object' && 'result' in value) {
    return cellText(value.result as ExcelJS.CellValue)
  }
  return ''
}

export class XlsxAdapter implements DocumentAdapter {
  readonly kind = 'xlsx' as const
  private original: Uint8Array | null = null
  private workbook: ExcelJS.Workbook | null = null
  private fields = new Map<string, Field>()

  async load(source: Source): Promise<void> {
    if (source.kind !== 'xlsx') {
      throw new Error('XlsxAdapter only accepts xlsx')
    }
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(source.buffer as unknown as ExcelJS.Buffer)
    this.original = source.buffer
    this.workbook = workbook
    this.fields.clear()
  }

  async discoverFields(): Promise<DiscoveredField[]> {
    if (!this.workbook) return []
    const fields: DiscoveredField[] = []
    const seen = new Set<string>()
    for (const sheet of this.workbook.worksheets) {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          for (const marker of parseMarkers(cellText(cell.value))) {
            if (seen.has(marker.name)) continue
            seen.add(marker.name)
            fields.push({
              name: marker.name,
              type: marker.type,
              label: marker.name,
              anchor: { kind: 'cell', sheet: sheet.name, address: cell.address },
            })
          }
        })
      })
    }
    return fields
  }

  getPreview(): PreviewModel {
    if (!this.workbook) return { kind: 'xlsx', sheets: [] }
    return {
      kind: 'xlsx',
      sheets: this.workbook.worksheets.map((sheet) => {
        const rowCount = Math.max(sheet.rowCount, 1)
        const colCount = Math.max(sheet.columnCount, 1)
        const mergeList = ((sheet as unknown as { model?: { merges?: string[] } }).model?.merges ?? [])
          .map(parseMerge)
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
        const skip = new Set<string>()
        const span = new Map<string, { colspan: number; rowspan: number }>()
        for (const merge of mergeList) {
          span.set(`${merge.r1}:${merge.c1}`, {
            colspan: merge.c2 - merge.c1 + 1,
            rowspan: merge.r2 - merge.r1 + 1,
          })
          for (let r = merge.r1; r <= merge.r2; r += 1) {
            for (let c = merge.c1; c <= merge.c2; c += 1) {
              if (r === merge.r1 && c === merge.c1) continue
              skip.add(`${r}:${c}`)
            }
          }
        }
        const colWidths = Array.from({ length: colCount }, (_, index) => {
          const width = sheet.getColumn(index + 1).width
          return typeof width === 'number' ? width : 12
        })
        const cells = []
        for (let r = 1; r <= rowCount; r += 1) {
          const row = []
          for (let c = 1; c <= colCount; c += 1) {
            const key = `${r}:${c}`
            if (skip.has(key)) {
              row.push({ inlines: [], skip: true })
              continue
            }
            const text = cellText(sheet.getRow(r).getCell(c).value)
            const merged = span.get(key)
            row.push({
              inlines: splitByMarkers(text).map((segment) =>
                segment.kind === 'text'
                  ? { type: 'text' as const, text: segment.text }
                  : { type: 'field' as const, name: segment.name },
              ),
              colspan: merged?.colspan,
              rowspan: merged?.rowspan,
            })
          }
          cells.push(row)
        }
        return { name: sheet.name, colWidths, cells }
      }),
    }
  }

  async insertAnchor(field: Field): Promise<void> {
    this.fields.set(field.id, field)
  }

  async updateAnchor(field: Field): Promise<void> {
    this.fields.set(field.id, field)
  }

  async removeAnchor(fieldId: string): Promise<void> {
    this.fields.delete(fieldId)
  }

  async bind(data: Record<string, unknown>): Promise<void> {
    if (!this.original) throw new Error('no xlsx loaded')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(this.original as unknown as ExcelJS.Buffer)
    for (const sheet of workbook.worksheets) {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const text = cellText(cell.value)
          if (!text.includes('{{')) return
          const next = replaceMarkers(text, data)
          if (next !== text) cell.value = next
        })
      })
    }
    this.workbook = workbook
  }

  async export(): Promise<Uint8Array> {
    if (!this.workbook) throw new Error('no xlsx loaded')
    const buffer = await this.workbook.xlsx.writeBuffer()
    return new Uint8Array(buffer)
  }
}
