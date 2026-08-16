import { renderAsync } from 'docx-preview'
import ExcelJS from 'exceljs'
import { supportsCanvasDrawElement } from './canvas-draw-element'
import { exportElementToPdf } from './export-pdf'
import type { ExportPdfOptions, PdfExportMode } from './types'

export type FilledExportInput = {
  kind: 'docx' | 'xlsx'
  buffer: Uint8Array
  options?: ExportPdfOptions
}

function styleHost(el: HTMLElement) {
  el.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:210mm',
    'max-width:100vw',
    'background:#fff',
    'opacity:1',
    'pointer-events:none',
    'z-index:-1',
    'overflow:visible',
  ].join(';')
}

async function waitForPaint(host: HTMLElement): Promise<void> {
  const images = Array.from(host.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        img.complete ||
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  )
  if (document.fonts?.ready) await document.fonts.ready
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  await new Promise((resolve) => setTimeout(resolve, 120))
}

function cellDisplay(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object' && 'text' in value && typeof (value as { text: unknown }).text === 'string') {
    return (value as { text: string }).text
  }
  if (typeof value === 'object' && 'richText' in value) {
    const rich = (value as { richText: Array<{ text: string }> }).richText
    return rich.map((part) => part.text).join('')
  }
  if (typeof value === 'object' && 'result' in value) {
    return cellDisplay((value as { result: ExcelJS.CellValue }).result)
  }
  return ''
}

async function mountFilledDocx(buffer: Uint8Array, host: HTMLElement): Promise<void> {
  await renderAsync(buffer.slice(), host, undefined, {
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
  })
  await waitForPaint(host)
}

async function mountFilledXlsx(buffer: Uint8Array, host: HTMLElement): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  host.style.width = 'min(1000px, 100vw)'
  host.style.padding = '16px'

  for (const sheet of workbook.worksheets) {
    const wrap = document.createElement('div')
    wrap.className = 'ck-pdf-sheet'
    wrap.style.cssText = 'margin-bottom:24px;background:#fff;'

    const title = document.createElement('div')
    title.textContent = sheet.name
    title.style.cssText = 'font-weight:600;margin-bottom:8px;font-family:sans-serif;'
    wrap.appendChild(title)

    const table = document.createElement('table')
    table.style.cssText = 'border-collapse:collapse;width:100%;font:14px/1.5 sans-serif;'
    for (let r = 1; r <= (sheet.rowCount || 0); r++) {
      const tr = document.createElement('tr')
      for (let c = 1; c <= (sheet.columnCount || 0); c++) {
        const td = document.createElement('td')
        td.textContent = cellDisplay(sheet.getCell(r, c).value)
        td.style.cssText = 'border:1px solid #ccc;padding:6px 8px;min-width:80px;vertical-align:top;'
        tr.appendChild(td)
      }
      table.appendChild(tr)
    }
    wrap.appendChild(table)
    host.appendChild(wrap)
  }
  await waitForPaint(host)
}

async function mountFilled(input: FilledExportInput, host: HTMLElement): Promise<void> {
  if (input.kind === 'docx') await mountFilledDocx(input.buffer, host)
  else if (input.kind === 'xlsx') await mountFilledXlsx(input.buffer, host)
  else throw new Error(`不支持的文档类型: ${String(input.kind)}`)
}

/** 系统打印 →「另存为 PDF」 */
export async function printFilledDocument(input: FilledExportInput): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'contract-kit-pdf-print')
  // 不可用 opacity:0：部分浏览器会把不可见 iframe 打成空白预览
  iframe.style.cssText =
    'position:fixed;left:0;top:0;width:210mm;height:100vh;border:0;opacity:1;pointer-events:none;z-index:-1;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    iframe.remove()
    throw new Error('无法创建打印预览')
  }

  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"/><title>合同</title>
    <style>
      @page { size: A4; margin: 12mm; }
      html, body { margin: 0; background: #fff; }
    </style></head><body></body></html>`,
  )
  doc.close()

  const host = doc.createElement('div')
  host.style.cssText = 'width:210mm;max-width:100%;background:#fff;margin:0 auto;'
  doc.body.appendChild(host)

  try {
    if (input.kind === 'docx') {
      await renderAsync(input.buffer.slice(), host, undefined, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
      })
    } else {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(input.buffer as unknown as ExcelJS.Buffer)
      for (const sheet of workbook.worksheets) {
        const wrap = doc.createElement('div')
        wrap.className = 'ck-pdf-sheet'
        const title = doc.createElement('div')
        title.textContent = sheet.name
        title.style.cssText = 'font-weight:600;margin:0 0 8px;font-family:sans-serif;'
        wrap.appendChild(title)
        const table = doc.createElement('table')
        table.style.cssText = 'border-collapse:collapse;width:100%;font:14px/1.5 sans-serif;'
        for (let r = 1; r <= (sheet.rowCount || 0); r++) {
          const tr = doc.createElement('tr')
          for (let c = 1; c <= (sheet.columnCount || 0); c++) {
            const td = doc.createElement('td')
            td.textContent = cellDisplay(sheet.getCell(r, c).value)
            td.style.cssText = 'border:1px solid #ccc;padding:6px 8px;'
            tr.appendChild(td)
          }
          table.appendChild(tr)
        }
        wrap.appendChild(table)
        host.appendChild(wrap)
      }
    }

    await waitForPaint(host)

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        if (settled) return
        settled = true
        win.removeEventListener('afterprint', onAfter)
        iframe.remove()
      }
      const onAfter = () => {
        cleanup()
        resolve()
      }
      win.addEventListener('afterprint', onAfter)
      window.setTimeout(() => {
        cleanup()
        resolve()
      }, 60_000)
      try {
        win.focus()
        win.print()
      } catch (err) {
        cleanup()
        reject(err)
      }
    })
  } catch (err) {
    iframe.remove()
    throw err
  }
}

/** 填好的模板 → PDF 字节（html2canvas / canvas-draw-element） */
export async function exportFilledToPdf(input: FilledExportInput): Promise<Uint8Array> {
  const options = input.options ?? {}
  const mode = options.mode ?? 'html2canvas'
  if (mode === 'print') {
    throw new Error('print 模式不返回文件字节，请调用 printFilledDocument / exportFilledDocument')
  }
  if (mode === 'canvas-draw-element' && !supportsCanvasDrawElement()) {
    throw new Error(
      '不支持 canvas-draw-element：请用 Chromium 打开 chrome://flags/#canvas-draw-element，或改用 html2canvas / print',
    )
  }

  const host = document.createElement('div')
  host.setAttribute('data-ck-pdf-filled', '')
  styleHost(host)
  document.body.appendChild(host)
  try {
    await mountFilled(input, host)
    return exportElementToPdf(host, {
      pageSelector: input.kind === 'docx' ? 'section.docx' : '.ck-pdf-sheet',
      ...options,
      mode,
    })
  } finally {
    host.remove()
  }
}

/**
 * 统一入口。`options.mode` 由外部决定，默认 `html2canvas`。
 * - html2canvas / canvas-draw-element → 返回 Uint8Array
 * - print → void（系统打印对话框）
 */
export async function exportFilledDocument(
  input: FilledExportInput,
): Promise<Uint8Array | void> {
  const mode: PdfExportMode = input.options?.mode ?? 'html2canvas'
  if (mode === 'print') {
    await printFilledDocument(input)
    return
  }
  return exportFilledToPdf({ ...input, options: { ...input.options, mode } })
}
