import { downloadBuffer } from '~/utils/download'

export { downloadBuffer }

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
export const PDF_MIME = 'application/pdf'

export function officeMime(format: 'docx' | 'xlsx') {
  return format === 'docx' ? DOCX_MIME : XLSX_MIME
}

export async function downloadFilledPdf(title: string, kind: 'docx' | 'xlsx', buffer: Uint8Array) {
  const { exportFilledDocument } = await import('paperfill')
  const pdf = await exportFilledDocument({
    kind,
    buffer,
    options: { mode: 'html2canvas' },
  })
  if (!pdf) throw new Error('PDF 导出未返回文件')
  downloadBuffer(`${title}.pdf`, pdf, PDF_MIME)
}
