import type { FormSchemaField, ValidationResult } from 'paperfill'

export type FieldMountContext = {
  name: string
  field?: FormSchemaField
  value?: unknown
  error?: string
  onChange: (value: unknown) => void
}

export type FieldHandle = {
  update: (patch: { field?: FormSchemaField; value?: unknown; error?: string }) => void
  destroy: () => void
}

/** App-provided field UI: mount into a DOM slot (docx-preview / table cell). */
export type FieldMounter = (container: HTMLElement, ctx: FieldMountContext) => FieldHandle

export type FieldComponentProps = {
  name: string
  fields: FormSchemaField[]
  validation: ValidationResult
}
