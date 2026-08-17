import type ExcelJS from 'exceljs'
import { readCellStyle } from './cell-style'

function columnNumber(address: string): number {
  const letters = address.match(/^[A-Z]+/)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function rowNumber(address: string): number {
  return Number(address.match(/\d+$/)?.[0] ?? 1)
}

export function parseMerge(range: string): { r1: number; c1: number; r2: number; c2: number } | null {
  const [start, end] = range.split(':')
  if (!start || !end) return null
  return {
    r1: rowNumber(start),
    c1: columnNumber(start),
    r2: rowNumber(end),
    c2: columnNumber(end),
  }
}

export function cellText(value: ExcelJS.CellValue): string {
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

function cellIsUsed(cell: ExcelJS.Cell): boolean {
  return cellText(cell.value).trim() !== '' || Boolean(readCellStyle(cell))
}

function sheetMerges(sheet: ExcelJS.Worksheet): Array<{ r1: number; c1: number; r2: number; c2: number }> {
  const raw = (sheet as unknown as { model?: { merges?: string[] } }).model?.merges ?? []
  return raw.map(parseMerge).filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function extendFromAnchor(
  bounds: { rows: number; cols: number },
  anchor: { col?: number; row?: number; nativeCol?: number; nativeRow?: number } | undefined,
) {
  if (!anchor) return
  const row0 = typeof anchor.nativeRow === 'number' ? anchor.nativeRow : Number(anchor.row ?? 0)
  const col0 = typeof anchor.nativeCol === 'number' ? anchor.nativeCol : Number(anchor.col ?? 0)
  bounds.rows = Math.max(bounds.rows, Math.floor(row0) + 1)
  bounds.cols = Math.max(bounds.cols, Math.floor(col0) + 1)
}

/**
 * Last row/column that has value, cell style, an intersecting merge, or an image.
 * Ignores ExcelJS `rowCount` trailing empty rows (WPS/Excel "ghost" rows).
 * Empty rows between used rows stay in the 1..rows window.
 */
export function usedSheetSize(sheet: ExcelJS.Worksheet): { rows: number; cols: number } {
  const bounds = { rows: 0, cols: 0 }

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (!cellIsUsed(cell)) return
      bounds.rows = Math.max(bounds.rows, rowNumber)
      bounds.cols = Math.max(bounds.cols, colNumber)
    })
  })

  for (const merge of sheetMerges(sheet)) {
    if (merge.r1 > bounds.rows || merge.c1 > bounds.cols) continue
    bounds.rows = Math.max(bounds.rows, merge.r2)
    bounds.cols = Math.max(bounds.cols, merge.c2)
  }

  for (const image of sheet.getImages()) {
    extendFromAnchor(bounds, image.range.tl)
    extendFromAnchor(bounds, image.range.br)
  }

  return { rows: Math.max(bounds.rows, 1), cols: Math.max(bounds.cols, 1) }
}
