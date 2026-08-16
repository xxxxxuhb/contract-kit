import type { FieldType } from '@contract-kit/kernel'
import type { CreateFieldOptions, FieldHandle, FieldModel } from './types'

function asString(value: unknown): string {
  return value == null ? '' : String(value)
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean)
  if (typeof value === 'string' && value) return value.split(',').map((s) => s.trim()).filter(Boolean)
  return []
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
  if (type === 'select' || type === 'multiselect') {
    const el = document.createElement('select')
    el.className = type === 'multiselect' ? 'ck-field-select ck-field-multiselect' : 'ck-field-select'
    if (type === 'multiselect') {
      el.multiple = true
      el.size = Math.min(Math.max(field?.options?.length ?? 3, 3), 6)
    }
    return el
  }
  if (type === 'image') {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = 'image/*'
    el.className = 'ck-field-input ck-field-image'
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

function fillSelect(
  el: HTMLSelectElement,
  field: Partial<FieldModel> | null | undefined,
  value: unknown,
  multiple: boolean,
) {
  el.replaceChildren()
  if (!multiple) {
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = '请选择'
    el.appendChild(empty)
  }
  for (const opt of field?.options ?? []) {
    const option = document.createElement('option')
    option.value = opt.value
    option.textContent = opt.label
    el.appendChild(option)
  }
  if (multiple) {
    const selected = new Set(asStringArray(value))
    for (const option of Array.from(el.options)) {
      option.selected = selected.has(option.value)
    }
  } else {
    el.value = asString(value)
  }
}

function readValue(type: FieldType, control: HTMLElement): unknown {
  if (type === 'display') return control.textContent ?? ''
  if (type === 'image') {
    // value is set asynchronously via FileReader in the change handler
    return (control as HTMLInputElement & { dataset: DOMStringMap }).dataset.imageValue ?? ''
  }
  if (control instanceof HTMLSelectElement) {
    if (control.multiple) {
      return Array.from(control.selectedOptions).map((opt) => opt.value)
    }
    return control.value
  }
  if (control instanceof HTMLTextAreaElement) {
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
  if (type === 'image' && control instanceof HTMLInputElement) {
    control.dataset.imageValue = asString(value)
    control.title = value ? '已选择图片（data URL）' : '选择图片'
    return
  }
  if (control instanceof HTMLSelectElement) {
    if (control.multiple) {
      const selected = new Set(asStringArray(value))
      for (const option of Array.from(control.options)) {
        option.selected = selected.has(option.value)
      }
      return
    }
    control.value = asString(value)
    return
  }
  if (control instanceof HTMLTextAreaElement || control instanceof HTMLInputElement) {
    control.value = asString(value)
  }
}

/**
 * Create a native field control.
 * Supports text / textarea / number / date / select / multiselect / display / image(file→data URL).
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
  if (type === 'image') wrap.classList.add('is-image')

  let control = buildControl(type, field)
  control.setAttribute('aria-label', field?.label || options.name)
  wrap.appendChild(control)

  const onInput = () => {
    if (type === 'display') return
    if (type === 'image' && control instanceof HTMLInputElement) {
      const file = control.files?.[0]
      if (!file) {
        value = ''
        control.dataset.imageValue = ''
        options.onChange(value)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        value = typeof reader.result === 'string' ? reader.result : ''
        control.dataset.imageValue = asString(value)
        options.onChange(value)
      }
      reader.readAsDataURL(file)
      return
    }
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
    wrap.classList.toggle('is-image', type === 'image')
    const next = buildControl(type, field)
    next.setAttribute('aria-label', field?.label || options.name)
    if ((type === 'select' || type === 'multiselect') && next instanceof HTMLSelectElement) {
      fillSelect(next, field, value, type === 'multiselect')
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

  if ((type === 'select' || type === 'multiselect') && control instanceof HTMLSelectElement) {
    fillSelect(control, field, value, type === 'multiselect')
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
      if (
        nextType !== type ||
        ((nextType === 'select' || nextType === 'multiselect') && 'field' in patch)
      ) {
        paint()
        return
      }
      writeValue(type, control, value)
      if ((type === 'select' || type === 'multiselect') && control instanceof HTMLSelectElement && 'field' in patch) {
        fillSelect(control, field, value, type === 'multiselect')
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
