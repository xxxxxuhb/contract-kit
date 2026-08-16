import {
  parseTableColumnRef,
  type FormSchemaField,
  type PreviewInline,
  type ValidationResult,
  type XlsxPreviewCell,
  type XlsxPreviewCellStyle,
  type XlsxPreviewSheet,
} from '@contract-kit/kernel'

export type XlsxFieldMountContext = {
  name: string
  field?: FormSchemaField | Partial<FormSchemaField>
  value?: unknown
  error?: string
  onChange: (value: unknown) => void
}

export type XlsxFieldHandle = {
  update: (patch: {
    field?: FormSchemaField | Partial<FormSchemaField>
    value?: unknown
    error?: string
  }) => void
  destroy: () => void
}

export type XlsxFieldMounter = (container: HTMLElement, ctx: XlsxFieldMountContext) => XlsxFieldHandle

export type MountXlsxPreviewOptions = {
  sheets: XlsxPreviewSheet[]
  fields: FormSchemaField[]
  validation?: ValidationResult
  mountField: XlsxFieldMounter
  onChange: (path: string, value: unknown) => void
}

export type XlsxPreviewHandle = {
  update: (patch: Partial<MountXlsxPreviewOptions>) => void
  destroy: () => void
}

function tableRows(field: FormSchemaField): Record<string, unknown>[] {
  return Array.isArray(field.value) ? (field.value as Record<string, unknown>[]) : []
}

function rewriteInlines(inlines: PreviewInline[], tableName: string, index: number): PreviewInline[] {
  const prefix = `${tableName}.`
  const out: PreviewInline[] = []
  for (const inline of inlines) {
    if (inline.type === 'text') {
      out.push(inline)
      continue
    }
    if (!inline.name.startsWith(prefix)) {
      out.push(inline)
      continue
    }
    const column = inline.name.slice(prefix.length)
    if (column === '$index') {
      out.push({ type: 'text', text: String(index + 1) })
      continue
    }
    out.push({ type: 'field', name: `${tableName}.${index}.${column}` })
  }
  return out
}

function rowTableName(row: XlsxPreviewCell[]): string | null {
  for (const cell of row) {
    for (const inline of cell.inlines) {
      if (inline.type !== 'field') continue
      const ref = parseTableColumnRef(inline.name)
      if (ref) return ref.table
    }
  }
  return null
}

export function expandXlsxSheets(
  sheets: XlsxPreviewSheet[],
  fields: FormSchemaField[],
): XlsxPreviewSheet[] {
  return sheets.map((sheet) => {
    const cells: XlsxPreviewCell[][] = []
    for (const row of sheet.cells) {
      const tableName = rowTableName(row)
      if (!tableName) {
        cells.push(row)
        continue
      }
      const field = fields.find((item) => item.name === tableName)
      if (!field || field.type !== 'table') {
        cells.push(row)
        continue
      }
      const rows = tableRows(field)
      for (let i = 0; i < rows.length; i++) {
        cells.push(
          row.map((cell) => ({
            ...cell,
            inlines: rewriteInlines(cell.inlines, tableName, i),
          })),
        )
      }
    }
    return { ...sheet, cells }
  })
}

function resolveSlot(
  name: string,
  fields: FormSchemaField[],
  validation: ValidationResult | undefined,
): { field: Partial<FormSchemaField>; value: unknown; error?: string } {
  const error = validation?.issues.find((issue) => issue.path === name)?.message
  const direct = fields.find((item) => item.name === name)
  if (direct) {
    return { field: direct, value: direct.value, error }
  }
  const nested = /^([^.]+)\.(\d+)\.([^.]+)$/.exec(name)
  if (nested) {
    const [, table, indexStr, column] = nested
    const tableField = fields.find((item) => item.name === table)
    const rowIndex = Number(indexStr)
    const rows = Array.isArray(tableField?.value) ? (tableField!.value as Record<string, unknown>[]) : []
    const col = tableField?.columns?.find((item) => item.name === column)
    const value = rows[rowIndex]?.[column]
    return {
      field: {
        name,
        type: col?.type ?? 'text',
        label: col?.label ?? column,
        required: Boolean(col?.required),
        options: col?.options,
        value,
      },
      value,
      error,
    }
  }
  return { field: { name, type: 'text' }, value: undefined, error }
}

function applyCellStyle(el: HTMLElement, style: XlsxPreviewCellStyle | undefined) {
  if (!style) return
  if (style.background) el.style.backgroundColor = style.background
  if (style.color) el.style.color = style.color
  if (style.fontWeight) el.style.fontWeight = style.fontWeight
}

function colStyle(width: number | undefined): string {
  const em = Math.max(width ?? 12, 6)
  return `${em * 8}px`
}

/**
 * Render Excel preview sheets into a container. Business only supplies field mounting.
 */
export function mountXlsxPreview(container: HTMLElement, options: MountXlsxPreviewOptions): XlsxPreviewHandle {
  let sheets = options.sheets
  let fields = options.fields
  let validation = options.validation ?? { ok: true, issues: [] }
  let mountField = options.mountField
  let onChange = options.onChange

  const handles = new Map<HTMLElement, XlsxFieldHandle>()

  function clear() {
    for (const handle of handles.values()) handle.destroy()
    handles.clear()
    container.replaceChildren()
  }

  function mountSlot(holder: HTMLElement, name: string) {
    handles.get(holder)?.destroy()
    const resolved = resolveSlot(name, fields, validation)
    const handle = mountField(holder, {
      name,
      field: resolved.field as FormSchemaField,
      value: resolved.value,
      error: resolved.error,
      onChange: (value) => onChange(name, value),
    })
    handles.set(holder, handle)
  }

  function paint() {
    clear()
    const expanded = expandXlsxSheets(sheets, fields)
    for (const sheet of expanded) {
      const wrap = document.createElement('div')
      wrap.className = 'ck-xlsx-sheet'

      const title = document.createElement('div')
      title.className = 'ck-xlsx-sheet-name'
      title.textContent = sheet.name
      wrap.appendChild(title)

      const table = document.createElement('table')
      table.className = 'ck-xlsx-table'

      const colgroup = document.createElement('colgroup')
      for (const width of sheet.colWidths) {
        const col = document.createElement('col')
        col.style.width = colStyle(width)
        colgroup.appendChild(col)
      }
      table.appendChild(colgroup)

      for (const row of sheet.cells) {
        const tr = document.createElement('tr')
        for (const cell of row) {
          if (cell.skip) continue
          const td = document.createElement('td')
          if (cell.colspan && cell.colspan > 1) td.colSpan = cell.colspan
          if (cell.rowspan && cell.rowspan > 1) td.rowSpan = cell.rowspan
          applyCellStyle(td, cell.style)

          for (const inline of cell.inlines) {
            if (inline.type === 'text') {
              td.appendChild(document.createTextNode(inline.text))
              continue
            }
            const holder = document.createElement('span')
            holder.className = 'ck-field-slot'
            holder.dataset.field = inline.name
            td.appendChild(holder)
            mountSlot(holder, inline.name)
          }
          tr.appendChild(td)
        }
        table.appendChild(tr)
      }

      wrap.appendChild(table)
      container.appendChild(wrap)
    }
  }

  paint()

  return {
    update(patch) {
      if (patch.sheets) sheets = patch.sheets
      if (patch.fields) fields = patch.fields
      if (patch.validation) validation = patch.validation
      if (patch.mountField) mountField = patch.mountField
      if (patch.onChange) onChange = patch.onChange
      paint()
    },
    destroy() {
      clear()
    },
  }
}
