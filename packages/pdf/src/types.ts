/** PDF 导出策略，由调用方传入；默认 html2canvas */
export type PdfExportMode = 'html2canvas' | 'canvas-draw-element' | 'print'

export interface ExportPdfOptions {
  /**
   * - `html2canvas`（默认）：DOM 截图 + jsPDF 下载
   * - `canvas-draw-element`：WICG html-in-canvas（需 Chromium flag）
   * - `print`：系统打印 →「另存为 PDF」
   */
  mode?: PdfExportMode
  /** 截图像素比，默认 2（html2canvas / canvas-draw-element） */
  scale?: number
  /** jsPDF 纸张，默认 a4 */
  format?: 'a4' | 'letter'
  /** 页边距 mm，默认 8 */
  marginMm?: number
  /** 分页选择器，docx 默认 section.docx */
  pageSelector?: string
  background?: string
}

export type { ExportPdfOptions as PdfOptions }
