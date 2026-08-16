import { mountField } from './create-field'
import type { CreateFieldOptions, FieldHandle } from './types'

/** Drop-in FieldMounter for `mountDocxPreview` / `mountXlsxPreview`. */
export function nativeFieldMounter(container: HTMLElement, ctx: CreateFieldOptions): FieldHandle {
  return mountField(container, ctx)
}
