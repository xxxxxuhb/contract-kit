<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import { renderAsync } from 'docx-preview'
import { parseTableColumnRef, splitByMarkers } from '@contract-kit/kernel'
import type { FormSchemaField, ValidationResult } from '@contract-kit/kernel'
import type { FieldHandle, FieldMounter } from '~/utils/field-types'
import { resolveFieldSlot } from '~/utils/resolve-field'

const props = defineProps<{
  buffer: Uint8Array
  fields: FormSchemaField[]
  validation: ValidationResult
  mountField: FieldMounter
}>()

const emit = defineEmits<{
  setValue: [name: string, value: unknown]
}>()

const host = { value: null as HTMLElement | null }
const slots: HTMLElement[] = []
const handles = new Map<HTMLElement, FieldHandle>()

function setHost(el: Element | null) {
  host.value = el as HTMLElement | null
}

function cellPath(table: string, index: number, column: string) {
  return `${table}.${index}.${column}`
}

function mountSlot(holder: HTMLElement, name: string) {
  handles.get(holder)?.destroy()
  const resolved = resolveFieldSlot(name, props.fields, props.validation)
  const handle = props.mountField(holder, {
    name,
    field: resolved.field,
    value: resolved.value,
    error: resolved.error,
    onChange: (value) => emit('setValue', name, value),
  })
  handles.set(holder, handle)
}

function refreshSlots() {
  for (const holder of slots) {
    const name = holder.dataset.field
    if (!name) continue
    const existing = handles.get(holder)
    const resolved = resolveFieldSlot(name, props.fields, props.validation)
    if (!existing) {
      mountSlot(holder, name)
      continue
    }
    existing.update({ field: resolved.field, value: resolved.value, error: resolved.error })
  }
}

function clearSlots() {
  for (const handle of handles.values()) handle.destroy()
  handles.clear()
  slots.length = 0
}

function rewriteTableMarkersInRow(row: Element, tableName: string, index: number) {
  const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
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

function tableRows(field: FormSchemaField): Record<string, unknown>[] {
  return Array.isArray(field.value) ? (field.value as Record<string, unknown>[]) : []
}

function expandRepeatingRows(root: HTMLElement) {
  for (const field of props.fields) {
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

function hydrate(root: HTMLElement) {
  clearSlots()
  expandRepeatingRows(root)

  const parents = new Set<Element>()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node.textContent?.includes('{{')) {
      let el = node.parentElement
      while (el && el !== root) {
        if (['P', 'TD', 'TH', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5'].includes(el.tagName)) {
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

  for (const parent of parents) {
    const text = parent.textContent ?? ''
    const segments = splitByMarkers(text)
    if (!segments.some((segment) => segment.kind === 'field')) continue
    if (
      segments.some(
        (segment) =>
          segment.kind === 'field' &&
          Boolean(parseTableColumnRef(segment.name)) &&
          !/^[^.]+\.\d+\.[^.]+$/.test(segment.name),
      )
    ) {
      continue
    }
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

async function paint() {
  const el = host.value
  if (!el) return
  clearSlots()
  el.innerHTML = ''
  const copy = props.buffer.slice()
  await renderAsync(copy, el, undefined, {
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
  })
  hydrate(el)
}

function tableSignature() {
  return props.fields
    .filter((field) => field.type === 'table')
    .map((field) => `${field.name}:${Array.isArray(field.value) ? field.value.length : 0}`)
    .join('|')
}

watch(
  () => props.buffer,
  () => {
    void nextTick(() => void paint())
  },
  { immediate: true },
)

watch(tableSignature, () => {
  void nextTick(() => void paint())
})

watch(() => [props.fields, props.validation, props.mountField], refreshSlots, { deep: true })

onBeforeUnmount(() => clearSlots())
</script>

<template>
  <div class="docx-host" :ref="setHost"></div>
</template>
