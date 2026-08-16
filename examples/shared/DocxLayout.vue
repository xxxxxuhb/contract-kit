<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import { renderAsync } from 'docx-preview'
import { splitByMarkers } from '@contract-kit/kernel'
import type { FormSchemaField, ValidationResult } from '@contract-kit/kernel'
import type { FieldHandle, FieldMounter } from './field-types'

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

function mountSlot(holder: HTMLElement, name: string) {
  handles.get(holder)?.destroy()
  const field = props.fields.find((item) => item.name === name)
  const error = props.validation.issues.find((issue) => issue.path === name)?.message
  const handle = props.mountField(holder, {
    name,
    field,
    error,
    onChange: (value) => emit('setValue', name, value),
  })
  handles.set(holder, handle)
}

function refreshSlots() {
  for (const holder of slots) {
    const name = holder.dataset.field
    if (!name) continue
    const existing = handles.get(holder)
    if (!existing) {
      mountSlot(holder, name)
      continue
    }
    const field = props.fields.find((item) => item.name === name)
    const error = props.validation.issues.find((issue) => issue.path === name)?.message
    existing.update({ field, value: field?.value, error })
  }
}

function clearSlots() {
  for (const handle of handles.values()) handle.destroy()
  handles.clear()
  slots.length = 0
}

function hydrate(root: HTMLElement) {
  clearSlots()

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

watch(
  () => props.buffer,
  () => {
    void nextTick(() => void paint())
  },
  { immediate: true },
)

watch(() => [props.fields, props.validation, props.mountField], refreshSlots, { deep: true })

onBeforeUnmount(() => clearSlots())
</script>

<template>
  <div class="docx-host" :ref="setHost"></div>
</template>
