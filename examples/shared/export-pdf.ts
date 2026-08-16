import type { PdfExportMode } from '@contract-kit/pdf'

/** 由外部传入 mode，默认 html2canvas。`kind` 与 kernel `export` 的 `format` 同义。 */
export async function exportFilledContractPdf(input: {
  kind?: 'docx' | 'xlsx'
  /** kernel `exportFile()` 返回的字段名 */
  format?: 'docx' | 'xlsx'
  buffer: Uint8Array
  mode?: PdfExportMode
}) {
  const kind = input.kind ?? input.format
  if (kind !== 'docx' && kind !== 'xlsx') {
    throw new Error('exportFilledContractPdf 需要 kind 或 format（docx | xlsx）')
  }
  const { exportFilledDocument } = await import('@contract-kit/pdf')
  return exportFilledDocument({
    kind,
    buffer: input.buffer,
    options: { mode: input.mode ?? 'html2canvas' },
  })
}
