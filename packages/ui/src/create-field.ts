import type { FieldType } from '@contract-kit/kernel'
import type { CreateFieldOptions, FieldHandle, FieldModel } from './types'

function asString(value: unknown): string {
  return value == null ? '' : String(value)
}

function resolveType(field: Partial<FieldModel> | null | undefined): FieldType {
  return field?.type ?? 'text'
}

function setErrorState(wrap: HTMLElement, control: HTMLElement, error?: string) {
  wrap.classList.toggle('is-error', Boolean(error))
  const label = error || undefined
  wrap.title = label ?? ''
  control.setAttribute('aria-invalid', error ? 'true' : 'false')
  if (error) control.setAttribute('title', error)
  else control.removeAttribute('title')
}

function buildControl(type: FieldType, field: Partial<FieldModel> | null | undefined): HTMLElement {
  if (type === 'display') {
    const el = document.createElement('span')
    el.className = 'ck-field-display'
    return el
  }
  if (type === 'textarea') {
    const el = document.createElement('textarea')
    el.className = 'ck-field-textarea'
    el.rows = 2
    return el
  }
  if (type === 'select') {
    const el = document.createElement('select')
    el.className = 'ck-field-select'
    return el
  }
  const el = document.createElement('input')
  el.className = 'ck-field-input'
  if (type === 'number') {
    el.type = 'number'
    el.classList.add('ck-field-number')
  } else if (type === 'date') {
    el.type = 'date'
    el.classList.add('ck-field-date')
  } else {
    el.type = 'text'
  }
  return el
}

function fillSelect(el: HTMLSelectElement, field: Partial<FieldModel> | null | undefined, value: unknown) {
  el.replaceChildren()
  const empty = document.createElement('option')
  empty.value = ''
  empty.textContent = '请选择'
  el.appendChild(empty)
  for (const opt of field?.options ?? []) {
    const option = document.createElement('option')
    option.value = opt.value
    option.textContent = opt.label
    el.appendChild(option)
  }
  el.value = asString(value)
}

function readValue(type: FieldType, control: HTMLElement): unknown {
  if (type === 'display') return control.textContent ?? ''
  if (control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    return control.value
  }
  if (control instanceof HTMLInputElement) {
    if (type === 'number') {
      if (control.value === '') return ''
      const next = Number(control.value)
      return Number.isFinite(next) ? next : control.value
    }
    return control.value
  }
  return ''
}

function writeValue(type: FieldType, control: HTMLElement, value: unknown) {
  if (type === 'display') {
    control.textContent = asString(value)
    return
  }
  if (control instanceof HTMLSelectElement) {
    control.value = asString(value)
    return
  }
  if (control instanceof HTMLTextAreaElement || control instanceof HTMLInputElement) {
    control.value = asString(value)
  }
}

/**
 * Create a native field control (input / select / textarea / date / number / display).
 * No framework, no UI library. `display` is read-only text bound to data.
 */
export function createField(options: CreateFieldOptions): FieldHandle {
  let field = options.field ?? null
  let type = resolveType(field)
  let value = options.value !== undefined ? options.value : field?.value
  let error = options.error

  const wrap = document.createElement('span')
  wrap.className = 'ck-field'
  wrap.dataset.field = options.name
  if (type === 'display') wrap.classList.add('is-display')

  let control = buildControl(type, field)
  control.setAttribute('aria-label', field?.label || options.name)
  wrap.appendChild(control)

  const onInput = () => {
    if (type === 'display') return
    value = readValue(type, control)
    options.onChange(value)
  }
  if (type !== 'display') {
    control.addEventListener('input', onInput)
    control.addEventListener('change', onInput)
  }

  function paint() {
    type = resolveType(field)
    wrap.classList.toggle('is-display', type === 'display')
    const next = buildControl(type, field)
    next.setAttribute('aria-label', field?.label || options.name)
    if (type === 'select' && next instanceof HTMLSelectElement) {
      fillSelect(next, field, value)
    } else {
      writeValue(type, next, value)
    }
    setErrorState(wrap, next, error)
    control.removeEventListener('input', onInput)
    control.removeEventListener('change', onInput)
    if (type !== 'display') {
      next.addEventListener('input', onInput)
      next.addEventListener('change', onInput)
    }
    control.replaceWith(next)
    control = next
  }

  if (type === 'select' && control instanceof HTMLSelectElement) {
    fillSelect(control, field, value)
  } else {
    writeValue(type, control, value)
  }
  setErrorState(wrap, control, error)

  return {
    get el() {
      return wrap
    },
    update(patch) {
      if ('field' in patch) field = patch.field ?? null
      if ('value' in patch) value = patch.value
      if ('error' in patch) error = patch.error
      const nextType = resolveType(field)
      if (nextType !== type || (nextType === 'select' && 'field' in patch)) {
        paint()
        return
      }
      writeValue(type, control, value)
      if (type === 'select' && control instanceof HTMLSelectElement && 'field' in patch) {
        fillSelect(control, field, value)
      }
      control.setAttribute('aria-label', field?.label || options.name)
      setErrorState(wrap, control, error)
    },
    destroy() {
      control.removeEventListener('input', onInput)
      control.removeEventListener('change', onInput)
      wrap.remove()
    },
  }
}

/** Mount a field into a container (replaces children). */
export function mountField(container: HTMLElement, options: CreateFieldOptions): FieldHandle {
  const handle = createField(options)
  container.replaceChildren(handle.el)
  return handle
}
