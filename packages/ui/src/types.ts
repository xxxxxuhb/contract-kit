import type { FieldOption, FieldType, FormSchemaField } from '@paperfill/kernel'

export type FieldModel = Pick<FormSchemaField, 'name' | 'type' | 'label' | 'options' | 'value'> & {
  required?: boolean
}

export interface CreateFieldOptions {
  name: string
  /** Schema field; type defaults to text when omitted */
  field?: Partial<FieldModel> | null
  value?: unknown
  error?: string
  onChange: (value: unknown) => void
}

export interface FieldHandle {
  readonly el: HTMLElement
  update(patch: { value?: unknown; error?: string; field?: Partial<FieldModel> | null }): void
  destroy(): void
}

export type { FieldType, FieldOption }
