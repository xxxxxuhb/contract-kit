import type { XlsxPreviewCellStyle } from '@contract-kit/kernel'
import type ExcelJS from 'exceljs'

/** Default Office theme accents → approximate sRGB (theme index only, no tint). */
const THEME_FALLBACK: Record<number, string> = {
  0: '#ffffff',
  1: '#000000',
  2: '#e7e6e6',
  3: '#44546a',
  4: '#4472c4',
  5: '#ed7d31',
  6: '#a5a5a5',
  7: '#ffc000',
  8: '#5b9bd5',
  9: '#70ad47',
}

function argbToCss(argb: string): string | undefined {
  const hex = argb.replace(/^#/, '')
  if (hex.length === 8) return `#${hex.slice(2).toLowerCase()}`
  if (hex.length === 6) return `#${hex.toLowerCase()}`
  return undefined
}

export function excelColorToCss(color: Partial<ExcelJS.Color> | undefined): string | undefined {
  if (!color) return undefined
  if (typeof color.argb === 'string' && color.argb) {
    return argbToCss(color.argb)
  }
  if (typeof color.theme === 'number') {
    return THEME_FALLBACK[color.theme]
  }
  return undefined
}

export function readCellStyle(cell: ExcelJS.Cell): XlsxPreviewCellStyle | undefined {
  const style: XlsxPreviewCellStyle = {}

  const fill = cell.fill
  if (fill && fill.type === 'pattern' && fill.pattern && fill.pattern !== 'none') {
    const background =
      excelColorToCss(fill.fgColor) ?? excelColorToCss((fill as { bgColor?: Partial<ExcelJS.Color> }).bgColor)
    if (background) style.background = background
  }

  const fontColor = excelColorToCss(cell.font?.color)
  if (fontColor) style.color = fontColor
  if (cell.font?.bold) style.fontWeight = 'bold'

  return Object.keys(style).length ? style : undefined
}
