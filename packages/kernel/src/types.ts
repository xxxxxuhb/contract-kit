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
  rules?: FieldRules
  /** Export / bind presentation. `data` stays canonical. */
  outputFormat?: string
}

/** Declarative extra checks beyond required / select∈options. */
export interface FieldRules {
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  /** YYYY-MM-DD */
  dateFormat?: boolean
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
  rules?: FieldRules
  /** Export / bind presentation (`YYYY年MM月DD日`, `#,##0.00`, `label`, or a custom formatter name). */
  outputFormat?: string
  anchor: Anchor
}

export interface MarkerDelimiters {
  start: string
  end: string
}

export interface TemplateDefinition {
  version: 1
  source: { kind: 'docx' | 'xlsx'; hash: string }
  fields: Field[]
  /** Omit = `{{` / `}}`. Persist with the template so hydrate matches. */
  markers?: MarkerDelimiters
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
  rules?: FieldRules
  outputFormat?: string
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
  /** Optional; kernel pushes delimiters on load / hydrate. */
  setMarkers?(markers: MarkerDelimiters): void
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
  | { type: 'insertRow'; table: string; index?: number; row?: Record<string, unknown> }
  | { type: 'removeRow'; table: string; index: number }
  | { type: 'export'; format?: 'docx' | 'xlsx' }

export type DispatchResult =
  | { type: 'ok' }
  | { type: 'exported'; buffer: Uint8Array; format: 'docx' | 'xlsx' }

export interface Kernel {
  getState(): KernelState
  getDefinition(): TemplateDefinition | null
  getData(): Record<string, unknown>
  /** Data after `outputFormat` / custom formatters / `beforeExport` plugins. Used by `export`. */
  getExportData(): Record<string, unknown>
  getFormSchema(): FormSchema
  getView(): ViewModel
  getPreview(): PreviewModel | null
  getSource(): Source | null
  /** Effective marker delimiters (`{{` / `}}` unless configured). */
  getMarkers(): MarkerDelimiters
  validate(): ValidationResult
  can(command: Command): boolean
  dispatch(command: Command): Promise<DispatchResult>
  subscribe(listener: (event: KernelEvent) => void): () => void
  setViewport(viewport: ViewportPort | null): void
}

export type FieldValidator = (ctx: {
  data: Record<string, unknown>
  fields: Field[]
}) => ValidationIssue | ValidationIssue[] | null | undefined

export type FieldFormatter = (ctx: {
  value: unknown
  field: Field | FieldColumn
  name: string
  data: Record<string, unknown>
}) => unknown

export interface CreateKernelOptions {
  adapter: DocumentAdapter
  /** Extra / cross-field checks; return a message to fail. */
  validators?: FieldValidator[]
  /** Named formatters referenced by `Field.outputFormat`. */
  formatters?: Record<string, FieldFormatter>
  /** Marker delimiters. Default `{{` / `}}`. hydrate uses `definition.markers` if present. */
  markers?: MarkerDelimiters
  /**
   * Optional hooks. Does not replace `validators` / `formatters` / `subscribe`.
   * Missing methods are skipped. Runs in array order.
   */
  plugins?: KernelPlugin[]
}

export type KernelPluginContext = {
  source: Source
  definition: TemplateDefinition
}

export interface KernelPlugin {
  /** After marker scan on `load`, before definition / insertAnchor. */
  afterDiscover?(fields: DiscoveredField[], ctx: { source: Source }): DiscoveredField[] | void
  /** After `load` / `hydrate` state is set. May replace `data` (then validation runs). */
  afterHydrate?(ctx: {
    definition: TemplateDefinition
    data: Record<string, unknown>
    source: Source
  }): { data?: Record<string, unknown> } | void
  /** After `formatData` / formatters, before `bind`. `getExportData()` uses this too. */
  beforeExport?(
    data: Record<string, unknown>,
    ctx: { definition: TemplateDefinition; source: Source },
  ): Record<string, unknown> | void
  /** After `adapter.export()`, before `exported` event. */
  afterExport?(
    result: { buffer: Uint8Array; format: 'docx' | 'xlsx' },
    ctx: { definition: TemplateDefinition; source: Source },
  ): Uint8Array | { buffer: Uint8Array } | void
}
