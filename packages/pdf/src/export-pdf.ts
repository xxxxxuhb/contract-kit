import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { exportElementWithDrawElement } from './canvas-draw-element'
import type { ExportPdfOptions, PdfExportMode } from './types'

const PAGE_MM = {
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
} as const

export function resolveTargets(root: HTMLElement, pageSelector: string): HTMLElement[] {
  const pages = Array.from(root.querySelectorAll<HTMLElement>(pageSelector))
  if (pages.length > 0) return pages
  const wrapper = root.querySelector<HTMLElement>('.docx-wrapper')
  if (wrapper) return [wrapper]
  return [root]
}

async function rasterizeHtml2Canvas(
  el: HTMLElement,
  scale: number,
  background: string,
): Promise<HTMLCanvasElement> {
  const width = Math.max(el.scrollWidth, el.clientWidth, el.offsetWidth, 1)
  const height = Math.max(el.scrollHeight, el.clientHeight, el.offsetHeight, 1)
  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: background,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
  })
  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('html2canvas 截图为空，可尝试 mode: "print" 或 "canvas-draw-element"')
  }
  return canvas
}

export async function canvasesToPdf(
  canvases: HTMLCanvasElement[],
  options: ExportPdfOptions,
): Promise<Uint8Array> {
  const usable = canvases.filter((c) => c.width > 0 && c.height > 0)
  if (usable.length === 0) throw new Error('没有可用的截图像素')

  const format = options.format ?? 'a4'
  const margin = options.marginMm ?? 8
  const { w: pageW, h: pageH } = PAGE_MM[format]
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format, compress: true })
  const contentW = pageW - margin * 2
  const contentH = pageH - margin * 2

  usable.forEach((canvas, index) => {
    if (index > 0) pdf.addPage()
    const imgH = (canvas.height / canvas.width) * contentW
    if (imgH <= contentH) {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, imgH)
      return
    }
    const pageHeightPx = (contentH / contentW) * canvas.width
    let offsetY = 0
    let first = true
    while (offsetY < canvas.height) {
      if (!first) pdf.addPage()
      first = false
      const sliceH = Math.min(pageHeightPx, canvas.height - offsetY)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = Math.max(1, Math.floor(sliceH))
      const ctx = slice.getContext('2d')
      if (!ctx) break
      ctx.fillStyle = options.background ?? '#ffffff'
      ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, slice.width, slice.height)
      const sliceMmH = (slice.height / slice.width) * contentW
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentW, sliceMmH)
      offsetY += sliceH
    }
  })

  return new Uint8Array(pdf.output('arraybuffer'))
}

/** Snapshot a mounted preview root → PDF bytes（html2canvas 或 canvas-draw-element） */
export async function exportElementToPdf(
  element: HTMLElement,
  options: ExportPdfOptions = {},
): Promise<Uint8Array> {
  const mode: PdfExportMode = options.mode === 'canvas-draw-element' ? 'canvas-draw-element' : 'html2canvas'
  const scale = options.scale ?? 2
  const background = options.background ?? '#ffffff'
  const pageSelector = options.pageSelector ?? 'section.docx'

  if (mode === 'canvas-draw-element') {
    return exportElementWithDrawElement(
      element,
      options,
      (canvases) => canvasesToPdf(canvases, options),
      resolveTargets,
    )
  }

  const targets = resolveTargets(element, pageSelector)
  const canvases: HTMLCanvasElement[] = []
  for (const target of targets) {
    canvases.push(await rasterizeHtml2Canvas(target, scale, background))
  }
  return canvasesToPdf(canvases, options)
}
