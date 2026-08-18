import type { KernelPlugin } from '@paperfill/kernel'
import type { DocxPreviewPlugin } from '@paperfill/docx'
import type { XlsxPreviewPlugin } from '@paperfill/xlsx'
import type { PdfPlugin } from '@paperfill/pdf'

/**
 * One object can be passed to kernel, preview mounts, and PDF export.
 * Unused hooks are ignored.
 */
export type PaperfillPlugin = KernelPlugin & DocxPreviewPlugin & XlsxPreviewPlugin & PdfPlugin
