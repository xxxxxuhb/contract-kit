import {
  parseTableColumnRef,
  rowsForExpand,
  splitByMarkers,
  type FormSchemaField,
  type ValidationResult,
} from '@paperfill/kernel'
import { renderAsync } from 'docx-preview'

export type DocxFieldMountContext = {
  name: string
  field?: FormSchemaField | Partial<FormSchemaField>
  value?: unknown
  error?: string
  onChange: (value: unknown) => void
}

export type DocxFieldHandle = {
  update: (patch: {
    field?: FormSchemaField | Partial<FormSchemaField>
    value?: unknown
    error?: string
  }) => void
  destroy: () => void
}

export type DocxFieldMounter = (container: HTMLElement, ctx: DocxFieldMountContext) => DocxFieldHandle

/** Subset of docx-preview `renderAsync` options. */
export type DocxRenderOptions = {
  inWrapper?: boolean
  ignoreWidth?: boolean
  ignoreHeight?: boolean
  breakPages?: boolean
  renderHeaders?: boolean
  renderFooters?: boolean
  className?: string
}

export type MountDocxPreviewOptions = {
  buffer: Uint8Array
  fields: FormSchemaField[]
  validation?: ValidationResult
  mountField: DocxFieldMounter
  onChange: (path: string, value: unknown) => void
  /** Where docx-preview injects CSS. Defaults to the body container. */
  styleContainer?: HTMLElement
  /**
   * Passed to docx-preview. Default `inWrapper: false` so only document
   * content is rendered into the container you pass (your page owns chrome).
   */
  render?: DocxRenderOptions
}

export type DocxPreviewHandle = {
  update: (patch: Partial<MountDocxPreviewOptions>) => Promise<void>
  destroy: () => void
}

const BLOCK_TAGS = new Set(['P', 'TD', 'TH', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5'])
const EXPANDED_CELL = /^[^.]+.\d+.[^.]+$/

function tableRows(field: FormSchemaField): Record<string, unknown>[] {
  return rowsForExpand(field.value)
}

function cellPath(table: string, index: number, column: string) {
  return `${table}.${index}.${column}`
}

export function resolveDocxSlot(
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

export function rewriteTableMarkersInRow(row: Element, tableName: string, index: number) {
  const walker = row.ownerDocument.createTreeWalker(row, 4 /* NodeFilter.SHOW_TEXT */)
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  const prefix = `${tableName}.`
  for (const textNode of nodes) {
    const text = textNode.textContent ?? ''
    if (!text.includes('{{')) continue
    textNode.textContent = text.replace(
      /\{\{\s*([^\s:{}]+)(?:\s*:\s*[A-Za-z_][A-Za-z0-9_]*)?\s*\}\}/g,
      (raw, markerName: string) => {
        if (!markerName.startsWith(prefix)) return raw
        const column = markerName.slice(prefix.length)
        if (column === '$index') return String(index + 1)
        return `{{${cellPath(tableName, index, column)}}}`
      },
    )
  }
}

export function expandRepeatingRows(root: HTMLElement, fields: FormSchemaField[]) {
  for (const field of fields) {
    if (field.type !== 'table') continue
    const rows = tableRows(field)
    const candidates = Array.from(root.querySelectorAll('tr')).filter((tr) =>
      (tr.textContent ?? '').includes(`{{${field.name}.`),
    )
    for (const template of candidates) {
      const parent = template.parentElement
      if (!parent) continue
      const fragment = document.createDocumentFragment()
      for (let i = 0; i < rows.length; i++) {
        const clone = template.cloneNode(true) as HTMLElement
        rewriteTableMarkersInRow(clone, field.name, i)
        clone.dataset.ckTable = field.name
        clone.dataset.ckRow = String(i)
        fragment.appendChild(clone)
      }
      parent.insertBefore(fragment, template)
      template.remove()
    }
  }
}

export function collectMarkerParents(root: HTMLElement): Element[] {
  const parents = new Set<Element>()
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  let node = walker.nextNode()
  while (node) {
    if (node.textContent?.includes('{{')) {
      let el = node.parentElement
      while (el && el !== root) {
        if (BLOCK_TAGS.has(el.tagName)) {
          parents.add(el)
          break
        }
        el = el.parentElement
      }
      if (el && el !== root) parents.add(el)
      else if (node.parentElement) parents.add(node.parentElement)
    }
    node = walker.nextNode()
  }
  return [...parents]
}

export function shouldSkipUnexpandedTableParent(text: string): boolean {
  const segments = splitByMarkers(text)
  return segments.some(
    (segment) =>
      segment.kind === 'field' && Boolean(parseTableColumnRef(segment.name)) && !EXPANDED_CELL.test(segment.name),
  )
}

/**
 * Render a .docx buffer into a container and mount fields into {{marker}} slots.
 * Layout comes from docx-preview; business only supplies FieldMounter.
 */
export function mountDocxPreview(container: HTMLElement, options: MountDocxPreviewOptions): DocxPreviewHandle {
  let buffer = options.buffer
  let fields = options.fields
  let validation = options.validation ?? { ok: true, issues: [] }
  let mountField = options.mountField
  let onChange = options.onChange
  let styleContainer = options.styleContainer
  let render = options.render

  const slots: HTMLElement[] = []
  const handles = new Map<HTMLElement, DocxFieldHandle>()
  let generation = 0

  function destroySlots() {
    for (const handle of handles.values()) handle.destroy()
    handles.clear()
    slots.length = 0
  }

  function mountSlot(holder: HTMLElement, name: string) {
    handles.get(holder)?.destroy()
    const resolved = resolveDocxSlot(name, fields, validation)
    const handle = mountField(holder, {
      name,
      field: resolved.field as FormSchemaField,
      value: resolved.value,
      error: resolved.error,
      onChange: (value) => onChange(name, value),
    })
    handles.set(holder, handle)
  }

  function hydrate(root: HTMLElement) {
    destroySlots()
    expandRepeatingRows(root, fields)
    for (const parent of collectMarkerParents(root)) {
      const text = parent.textContent ?? ''
      const segments = splitByMarkers(text)
      if (!segments.some((segment) => segment.kind === 'field')) continue
      if (shouldSkipUnexpandedTableParent(text)) continue
      parent.textContent = ''
      for (const segment of segments) {
        if (segment.kind === 'text') {
          parent.appendChild(document.createTextNode(segment.text))
          continue
        }
        const holder = document.createElement('span')
        holder.className = 'ck-field-slot'
        holder.dataset.field = segment.name
        parent.appendChild(holder)
        slots.push(holder)
        mountSlot(holder, segment.name)
      }
    }
  }

  function refreshSlots() {
    for (const holder of slots) {
      const name = holder.dataset.field
      if (!name) continue
      const existing = handles.get(holder)
      const resolved = resolveDocxSlot(name, fields, validation)
      if (!existing) {
        mountSlot(holder, name)
        continue
      }
      existing.update({ field: resolved.field, value: resolved.value, error: resolved.error })
    }
  }

  function tableSignature(list: FormSchemaField[]) {
    return list
      .filter((field) => field.type === 'table')
      .map((field) => `${field.name}:${Array.isArray(field.value) ? field.value.length : 0}`)
      .join('|')
  }

  async function paint() {
    const token = ++generation
    destroySlots()
    container.replaceChildren()
    const copy = buffer.slice()
    await renderAsync(copy, container, styleContainer, {
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      ...render,
    })
    if (token !== generation) return
    hydrate(container)
  }

  void paint()

  return {
    async update(patch) {
      const prevSig = tableSignature(fields)
      if (patch.buffer) buffer = patch.buffer
      if (patch.fields) fields = patch.fields
      if (patch.validation) validation = patch.validation
      if (patch.mountField) mountField = patch.mountField
      if (patch.onChange) onChange = patch.onChange
      if (patch.styleContainer) styleContainer = patch.styleContainer
      if (patch.render) render = { ...render, ...patch.render }
      const nextSig = tableSignature(fields)
      if (patch.buffer || nextSig !== prevSig) {
        await paint()
        return
      }
      refreshSlots()
    },
    destroy() {
      generation += 1
      destroySlots()
      container.replaceChildren()
    },
  }
}
