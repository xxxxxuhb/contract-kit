export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'table'
  | 'image'
  /** 纯展示：data 仍动态写入/导出，预览不渲染输入框 */
  | 'display'

export type DocxAnchor =
  | { kind: 'bookmark'; name: string }
  | { kind: 'sdt'; tag: string }
  | { kind: 'marker'; name: string }

export type XlsxAnchor =
  | { kind: 'cell'; sheet: string; address: string }
  | { kind: 'namedRange'; name: string }

export type OverlayAnchor = {
  kind: 'rect'
  page: number
  x: number
  y: number
  w: number
  h: number
}

export type Anchor = DocxAnchor | XlsxAnchor | OverlayAnchor

export interface FieldOption {
  value: string
  label: string
}

/** Column of a `table` field (`{{items.name}}` → column `name`) */
export interface FieldColumn {
  name: string
  type: FieldType
  label?: string
  required?: boolean
  options?: FieldOption[]
}

export interface Field {
  id: string
  name: string
  type: FieldType
  label?: string
  required?: boolean
  options?: FieldOption[]
  /** Present when type === 'table' */
  columns?: FieldColumn[]
  anchor: Anchor
}

export interface TemplateDefinition {
  version: 1
  source: { kind: 'docx' | 'xlsx'; hash: string }
  fields: Field[]
}

export interface Source {
  kind: 'docx' | 'xlsx'
  buffer: Uint8Array
  hash?: string
}

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

export interface KernelState {
  definition: TemplateDefinition | null
  data: Record<string, unknown>
  source: Source | null
  validation: ValidationResult
}

export interface FormSchemaField {
  id: string
  name: string
  type: FieldType
  label: string
  required: boolean
  options?: FieldOption[]
  columns?: FieldColumn[]
  value: unknown
}

export interface FormSchema {
  fields: FormSchemaField[]
}

export interface ViewItem {
  id: string
  label: string
  value: unknown
}

export type ViewModel = ViewItem[]

export interface ViewportPort {
  getSelection(): Anchor | null
  highlight(fieldId: string): void
  scrollTo(fieldId: string): void
}

export type PreviewInline =
  | { type: 'text'; text: string }
  | { type: 'field'; name: string }

export interface PreviewParagraph {
  type: 'paragraph'
  align?: 'left' | 'center' | 'right' | 'both'
  inlines: PreviewInline[]
}

export interface PreviewCell {
  blocks: PreviewBlock[]
}

export interface PreviewTable {
  type: 'table'
  rows: PreviewCell[][]
}

export type PreviewBlock = PreviewParagraph | PreviewTable

export interface DocxPreview {
  kind: 'docx'
  blocks: PreviewBlock[]
}

/** Preview-facing cell style (CSS-oriented). Colors are #rrggbb when resolvable. */
export interface XlsxPreviewCellStyle {
  background?: string
  color?: string
  fontWeight?: string
}

export interface XlsxPreviewCell {
  inlines: PreviewInline[]
  colspan?: number
  rowspan?: number
  skip?: boolean
  style?: XlsxPreviewCellStyle
}

export interface XlsxPreviewSheet {
  name: string
  colWidths: number[]
  cells: XlsxPreviewCell[][]
}

export interface XlsxPreview {
  kind: 'xlsx'
  sheets: XlsxPreviewSheet[]
}

export type PreviewModel = DocxPreview | XlsxPreview

export type DiscoveredField = Omit<Field, 'id'> & { id?: string }

export interface DocumentAdapter {
  kind: 'docx' | 'xlsx'
  load(source: Source): Promise<void>
  discoverFields(): Promise<DiscoveredField[]>
  getPreview(): PreviewModel
  insertAnchor(field: Field): Promise<void>
  updateAnchor?(field: Field): Promise<void>
  removeAnchor(fieldId: string): Promise<void>
  bind(data: Record<string, unknown>): Promise<void>
  export(): Promise<Uint8Array>
}

export type KernelEvent =
  | { type: 'state-changed' }
  | { type: 'field-inserted'; fieldId: string }
  | { type: 'field-updated'; fieldId: string }
  | { type: 'field-removed'; fieldId: string }
  | { type: 'data-changed' }
  | { type: 'validated'; result: ValidationResult }
  | { type: 'exported'; format: 'docx' | 'xlsx'; bytes: number }

export type Command =
  | { type: 'load'; source: Source }
  | {
      type: 'hydrate'
      definition: TemplateDefinition
      data?: Record<string, unknown>
      source: Source
    }
  | { type: 'insertField'; field: Omit<Field, 'id'> & { id?: string } }
  | { type: 'updateField'; id: string; patch: Partial<Omit<Field, 'id'>> }
  | { type: 'removeField'; id: string }
  | { type: 'setValue'; path: string; value: unknown }
  | { type: 'setData'; data: Record<string, unknown> }
  | { type: 'resetData' }
  | { type: 'export'; format?: 'docx' | 'xlsx' }

export type DispatchResult =
  | { type: 'ok' }
  | { type: 'exported'; buffer: Uint8Array; format: 'docx' | 'xlsx' }

export interface Kernel {
  getState(): KernelState
  getDefinition(): TemplateDefinition | null
  getData(): Record<string, unknown>
  getFormSchema(): FormSchema
  getView(): ViewModel
  getPreview(): PreviewModel | null
  getSource(): Source | null
  validate(): ValidationResult
  can(command: Command): boolean
  dispatch(command: Command): Promise<DispatchResult>
  subscribe(listener: (event: KernelEvent) => void): () => void
  setViewport(viewport: ViewportPort | null): void
}

export interface CreateKernelOptions {
  adapter: DocumentAdapter
}
