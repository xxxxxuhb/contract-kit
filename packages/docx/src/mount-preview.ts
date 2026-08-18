import {
  createMarkerSyntax,
  parseTableColumnRef,
  rowsForExpand,
  splitByMarkers,
  type FormSchemaField,
  type MarkerDelimiters,
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
   * Passed to docx-preview. Defaults fill the host: `inWrapper: false`,
   * `ignoreWidth` / `ignoreHeight: true`. Set `inWrapper: true` and
   * `ignoreWidth: false` for A4 page chrome.
   */
  render?: DocxRenderOptions
  /** Same delimiters as the kernel / adapter. Default `{{` / `}}`. */
  markers?: MarkerDelimiters
  /**
   * Preview-only hooks. Does not replace `mountField`.
   * Built-in `fitDocxToContainer` still runs before `afterHtml`.
   */
  plugins?: DocxPreviewPlugin[]
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

export function rewriteTableMarkersInRow(
  row: Element,
  tableName: string,
  index: number,
  markers?: MarkerDelimiters | null,
) {
  const syntax = createMarkerSyntax(markers)
  const walker = row.ownerDocument.createTreeWalker(row, 4 /* NodeFilter.SHOW_TEXT */)
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  const prefix = `${tableName}.`
  const re = syntax.regex()
  for (const textNode of nodes) {
    const text = textNode.textContent ?? ''
    if (!syntax.contains(text)) continue
    textNode.textContent = text.replace(re, (raw, markerName: string) => {
      if (!markerName.startsWith(prefix)) return raw
      const column = markerName.slice(prefix.length)
      if (column === '$index') return String(index + 1)
      return syntax.wrap(cellPath(tableName, index, column))
    })
  }
}

export function expandRepeatingRows(
  root: HTMLElement,
  fields: FormSchemaField[],
  markers?: MarkerDelimiters | null,
) {
  const syntax = createMarkerSyntax(markers)
  for (const field of fields) {
    if (field.type !== 'table') continue
    const rows = tableRows(field)
    const needle = `${syntax.start}${field.name}.`
    const candidates = Array.from(root.querySelectorAll('tr')).filter((tr) =>
      (tr.textContent ?? '').includes(needle),
    )
    for (const template of candidates) {
      const parent = template.parentElement
      if (!parent) continue
      const fragment = document.createDocumentFragment()
      for (let i = 0; i < rows.length; i++) {
        const clone = template.cloneNode(true) as HTMLElement
        rewriteTableMarkersInRow(clone, field.name, i, markers)
        clone.dataset.ckTable = field.name
        clone.dataset.ckRow = String(i)
        fragment.appendChild(clone)
      }
      parent.insertBefore(fragment, template)
      template.remove()
    }
  }
}

export function collectMarkerParents(root: HTMLElement, markers?: MarkerDelimiters | null): Element[] {
  const syntax = createMarkerSyntax(markers)
  const parents = new Set<Element>()
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  let node = walker.nextNode()
  while (node) {
    if (syntax.contains(node.textContent ?? '')) {
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

export function shouldSkipUnexpandedTableParent(
  text: string,
  markers?: MarkerDelimiters | null,
): boolean {
  const segments = splitByMarkers(text, markers)
  return segments.some(
    (segment) =>
      segment.kind === 'field' && Boolean(parseTableColumnRef(segment.name)) && !EXPANDED_CELL.test(segment.name),
  )
}

export type DocxPreviewPluginContext = {
  fields: FormSchemaField[]
}

export interface DocxPreviewPlugin {
  /** After `renderAsync` and built-in host fit, before repeating-row expand. */
  afterHtml?(root: HTMLElement, ctx: DocxPreviewPluginContext): void
  /** After `expandRepeatingRows`, before field slots. */
  afterExpand?(root: HTMLElement, ctx: DocxPreviewPluginContext): void
  /** After field slots are mounted. */
  afterSlots?(root: HTMLElement, ctx: DocxPreviewPluginContext): void
}

/** Stretch Word page boxes to the host so A4 `595.3pt` does not leave empty gray gutters. */
export function fitDocxToContainer(root: HTMLElement) {
  const wrap = root.querySelector('.docx-wrapper')
  if (wrap instanceof HTMLElement) {
    wrap.style.background = 'transparent'
    wrap.style.padding = '0'
    wrap.style.alignItems = 'stretch'
  }
  for (const section of root.querySelectorAll('section.docx')) {
    if (!(section instanceof HTMLElement)) continue
    section.style.width = '100%'
    section.style.maxWidth = '100%'
    section.style.minHeight = '0'
    section.style.boxShadow = 'none'
    section.style.marginBottom = '0'
  }
}

/** Optional: same stretch as the built-in fit. Safe to omit; mount still fits first. */
export const docxFitHostPlugin: DocxPreviewPlugin = {
  afterHtml(root) {
    fitDocxToContainer(root)
  },
}

function pluginCtx(fields: FormSchemaField[]): DocxPreviewPluginContext {
  return { fields }
}

/**
 * Expand repeating rows and mount field slots on already-rendered HTML.
 * Used by `mountDocxPreview` after `renderAsync`; tests can call it without a .docx buffer.
 */
export function hydrateDocxPreviewDom(
  root: HTMLElement,
  options: {
    fields: FormSchemaField[]
    validation?: ValidationResult
    mountField: DocxFieldMounter
    onChange: (path: string, value: unknown) => void
    markers?: MarkerDelimiters | null
    plugins?: DocxPreviewPlugin[]
  },
): {
  slots: HTMLElement[]
  handles: Map<HTMLElement, DocxFieldHandle>
  refresh: (patch?: { fields?: FormSchemaField[]; validation?: ValidationResult }) => void
  destroy: () => void
} {
  let fields = options.fields
  let validation = options.validation ?? { ok: true, issues: [] }
  const mountField = options.mountField
  const onChange = options.onChange
  const markers = options.markers
  const plugins = options.plugins ?? []
  const slots: HTMLElement[] = []
  const handles = new Map<HTMLElement, DocxFieldHandle>()

  function destroy() {
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

  expandRepeatingRows(root, fields, markers)
  for (const plugin of plugins) plugin.afterExpand?.(root, pluginCtx(fields))

  for (const parent of collectMarkerParents(root, markers)) {
    const text = parent.textContent ?? ''
    const segments = splitByMarkers(text, markers)
    if (!segments.some((segment) => segment.kind === 'field')) continue
    if (shouldSkipUnexpandedTableParent(text, markers)) continue
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

  for (const plugin of plugins) plugin.afterSlots?.(root, pluginCtx(fields))

  return {
    slots,
    handles,
    refresh(patch) {
      if (patch?.fields) fields = patch.fields
      if (patch?.validation) validation = patch.validation
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
    },
    destroy,
  }
}

/**
 * Built-in host fit + `afterHtml`, then slot hydration. Call after HTML is already in `root`.
 */
export function finalizeDocxPreviewDom(
  root: HTMLElement,
  options: Parameters<typeof hydrateDocxPreviewDom>[1],
) {
  const fields = options.fields
  const plugins = options.plugins ?? []
  fitDocxToContainer(root)
  for (const plugin of plugins) plugin.afterHtml?.(root, pluginCtx(fields))
  return hydrateDocxPreviewDom(root, options)
}

/**
 * Render a .docx buffer into a container and mount fields into marker slots.
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
  let markers = options.markers
  let plugins = options.plugins

  let session: ReturnType<typeof hydrateDocxPreviewDom> | null = null
  let generation = 0

  function destroySlots() {
    session?.destroy()
    session = null
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
      ignoreWidth: true,
      ignoreHeight: true,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      ...render,
    })
    if (token !== generation) return
    session = finalizeDocxPreviewDom(container, {
      fields,
      validation,
      mountField,
      onChange,
      markers,
      plugins,
    })
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
      if (patch.markers) markers = patch.markers
      if (patch.plugins) plugins = patch.plugins
      const nextSig = tableSignature(fields)
      if (patch.buffer || nextSig !== prevSig || patch.markers) {
        await paint()
        return
      }
      session?.refresh({ fields, validation })
    },
    destroy() {
      generation += 1
      destroySlots()
      container.replaceChildren()
    },
  }
}
