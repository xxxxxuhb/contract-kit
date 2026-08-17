import {
  aggregateMarkerFields,
  parseDataUrl,
  parseMarkers,
  parseTableColumnRef,
  replaceMarkers,
  replaceRowMarkers,
  rowsForExpand,
  splitByMarkers,
  tableNamesInText,
  textHasTableMarkers,
  type DiscoveredField,
  type DocumentAdapter,
  type Field,
  type PreviewModel,
  type Source,
} from '@paperfill/kernel'
import ExcelJS from 'exceljs'
import { readCellStyle } from './cell-style'
import { cellText, parseMerge, usedSheetSize } from './used-range'

export {
  expandXlsxSheets,
  mountXlsxPreview,
  type MountXlsxPreviewOptions,
  type XlsxFieldHandle,
  type XlsxFieldMountContext,
  type XlsxFieldMounter,
  type XlsxPreviewHandle,
} from './mount-preview'
export { excelColorToCss, readCellStyle } from './cell-style'

function asRow(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function rowPlainText(row: ExcelJS.Row): string {
  const parts: string[] = []
  row.eachCell({ includeEmpty: true }, (cell) => {
    parts.push(cellText(cell.value))
  })
  return parts.join('\n')
}

function expandSheetTables(sheet: ExcelJS.Worksheet, data: Record<string, unknown>): void {
  type Hit = { tableName: string; rowNumber: number }
  const hits: Hit[] = []
  const seenTables = new Set<string>()
  sheet.eachRow((row, rowNumber) => {
    const text = rowPlainText(row)
    for (const tableName of tableNamesInText(text)) {
      if (seenTables.has(tableName)) continue
      if (!textHasTableMarkers(text, tableName)) continue
      seenTables.add(tableName)
      hits.push({ tableName, rowNumber })
    }
  })

  hits.sort((a, b) => b.rowNumber - a.rowNumber)
  for (const hit of hits) {
    const rows = rowsForExpand(data[hit.tableName])
    const templateRow = hit.rowNumber
    if (rows.length > 1) {
      sheet.duplicateRow(templateRow, rows.length - 1, true)
    }
    for (let i = 0; i < rows.length; i++) {
      const excelRow = sheet.getRow(templateRow + i)
      const record = asRow(rows[i])
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        const text = cellText(cell.value)
        if (!text.includes('{{')) return
        const next = replaceRowMarkers(text, hit.tableName, record, i)
        if (next !== text) cell.value = next
      })
    }
  }
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
    const texts: string[] = []
    const firstAnchor = new Map<string, { sheet: string; address: string }>()
    for (const sheet of this.workbook.worksheets) {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const text = cellText(cell.value)
          if (!text.includes('{{')) return
          texts.push(text)
          for (const marker of parseMarkers(text)) {
            const ref = parseTableColumnRef(marker.name)
            const key = ref ? ref.table : marker.name
            if (!firstAnchor.has(key)) {
              firstAnchor.set(key, { sheet: sheet.name, address: cell.address })
            }
          }
        })
      })
    }
    return aggregateMarkerFields(parseMarkers(texts.join('\n'))).map((field) => {
      const anchor = firstAnchor.get(field.name)
      return {
        name: field.name,
        type: field.type,
        label: field.name,
        columns: field.columns,
        anchor: {
          kind: 'cell' as const,
          sheet: anchor?.sheet ?? this.workbook!.worksheets[0]?.name ?? 'Sheet1',
          address: anchor?.address ?? 'A1',
        },
      }
    })
  }

  getPreview(): PreviewModel {
    if (!this.workbook) return { kind: 'xlsx', sheets: [] }
    return {
      kind: 'xlsx',
      sheets: this.workbook.worksheets.map((sheet) => {
        const { rows: rowCount, cols: colCount } = usedSheetSize(sheet)
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
            const excelCell = sheet.getRow(r).getCell(c)
            const text = cellText(excelCell.value)
            const merged = span.get(key)
            row.push({
              inlines: splitByMarkers(text).map((segment) =>
                segment.kind === 'text'
                  ? { type: 'text' as const, text: segment.text }
                  : { type: 'field' as const, name: segment.name },
              ),
              colspan: merged?.colspan,
              rowspan: merged?.rowspan,
              style: readCellStyle(excelCell),
            })
          }
          cells.push(row)
        }
        return { name: sheet.name, colWidths, cells }
      }),
    }
  }

  private markerText(field: Field) {
    return field.type === 'text' ? `{{${field.name}}}` : `{{${field.name}:${field.type}}}`
  }

  private findCellByMarker(name: string): ExcelJS.Cell | null {
    if (!this.workbook) return null
    const re = new RegExp(`\\{\\{\\s*${name}(?:\\s*:\\s*[A-Za-z_][A-Za-z0-9_]*)?\\s*\\}\\}`)
    for (const sheet of this.workbook.worksheets) {
      let found: ExcelJS.Cell | null = null
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (found) return
          if (re.test(cellText(cell.value))) found = cell
        })
      })
      if (found) return found
    }
    return null
  }

  private async persistTemplate(): Promise<void> {
    if (!this.workbook) return
    const buffer = await this.workbook.xlsx.writeBuffer()
    this.original = new Uint8Array(buffer)
  }

  async insertAnchor(field: Field): Promise<void> {
    this.fields.set(field.id, field)
    if (!this.workbook) return
    if (this.findCellByMarker(field.name)) return
    const sheet = this.workbook.worksheets[0]
    if (!sheet) return
    const row = usedSheetSize(sheet).rows + 1
    sheet.getCell(row, 1).value = this.markerText(field)
    await this.persistTemplate()
  }

  async updateAnchor(field: Field): Promise<void> {
    const previous = this.fields.get(field.id)
    this.fields.set(field.id, field)
    const cell = this.findCellByMarker(previous?.name ?? field.name)
    if (cell) {
      cell.value = this.markerText(field)
      await this.persistTemplate()
      return
    }
    await this.insertAnchor(field)
  }

  async removeAnchor(fieldId: string): Promise<void> {
    const field = this.fields.get(fieldId)
    this.fields.delete(fieldId)
    if (!field) return
    const cell = this.findCellByMarker(field.name)
    if (!cell) return
    const text = cellText(cell.value)
    cell.value = text.replace(
      new RegExp(`\\{\\{\\s*${field.name}(?:\\s*:\\s*[A-Za-z_][A-Za-z0-9_]*)?\\s*\\}\\}`, 'g'),
      '',
    )
    await this.persistTemplate()
  }

  async bind(data: Record<string, unknown>): Promise<void> {
    if (!this.original) throw new Error('no xlsx loaded')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(this.original as unknown as ExcelJS.Buffer)
    for (const sheet of workbook.worksheets) {
      expandSheetTables(sheet, data)
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const text = cellText(cell.value)
          if (!text.includes('{{')) return
          const imageMarker = parseMarkers(text).find((marker) => parseDataUrl(data[marker.name]))
          if (imageMarker && parseMarkers(text).length === 1 && text.trim() === imageMarker.raw) {
            const parsed = parseDataUrl(data[imageMarker.name])
            if (parsed) {
              const imageId = workbook.addImage({
                buffer: parsed.bytes as unknown as ExcelJS.Buffer,
                extension: parsed.ext === 'jpg' ? 'jpeg' : (parsed.ext as 'png' | 'jpeg' | 'gif'),
              })
              sheet.addImage(imageId, {
                tl: { col: Number(cell.col) - 1, row: Number(cell.row) - 1 },
                ext: { width: 120, height: 120 },
              })
              cell.value = ''
              return
            }
          }
          const next = replaceMarkers(text, data, { missing: 'blank' })
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
