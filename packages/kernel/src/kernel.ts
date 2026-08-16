import { hashBytes } from './hash'
import { createId } from './id'
import { buildFormSchema, buildView, emptyValidation, validateState } from './schema'
import type {
  Command,
  CreateKernelOptions,
  DispatchResult,
  DocumentAdapter,
  Field,
  Kernel,
  KernelEvent,
  KernelState,
  PreviewModel,
  TemplateDefinition,
  ViewportPort,
} from './types'

function cloneData(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data }
}

export function createKernel(options: CreateKernelOptions): Kernel {
  const adapter: DocumentAdapter = options.adapter
  let viewport: ViewportPort | null = null
  let preview: PreviewModel | null = null
  const listeners = new Set<(event: KernelEvent) => void>()

  let state: KernelState = {
    definition: null,
    data: {},
    source: null,
    validation: emptyValidation(),
  }

  function emit(event: KernelEvent) {
    for (const listener of listeners) listener(event)
    if (event.type !== 'state-changed') {
      for (const listener of listeners) listener({ type: 'state-changed' })
    }
  }

  function snapshot(): KernelState {
    return {
      definition: state.definition
        ? { ...state.definition, fields: state.definition.fields.map((f) => ({ ...f })) }
        : null,
      data: cloneData(state.data),
      source: state.source,
      validation: { ...state.validation, issues: [...state.validation.issues] },
    }
  }

  function requireDefinition(): TemplateDefinition {
    if (!state.definition || !state.source) {
      throw new Error('kernel has no loaded template')
    }
    return state.definition
  }

  function refreshValidation() {
    state.validation = validateState(state)
    emit({ type: 'validated', result: state.validation })
  }

  function can(command: Command): boolean {
    switch (command.type) {
      case 'load':
      case 'hydrate':
        return command.source.kind === adapter.kind
      case 'insertField':
      case 'updateField':
      case 'removeField':
      case 'setValue':
      case 'setData':
      case 'resetData':
      case 'export':
        return Boolean(state.definition && state.source)
      default:
        return false
    }
  }

  async function dispatch(command: Command): Promise<DispatchResult> {
    if (!can(command)) {
      throw new Error(`cannot dispatch ${command.type}`)
    }

    switch (command.type) {
      case 'load': {
        await adapter.load(command.source)
        const hash = command.source.hash ?? (await hashBytes(command.source.buffer))
        preview = adapter.getPreview()
        const fields: Field[] = []
        const names = new Set<string>()
        for (const raw of await adapter.discoverFields()) {
          if (names.has(raw.name)) continue
          names.add(raw.name)
          const field: Field = { ...raw, id: raw.id ?? createId() }
          await adapter.insertAnchor(field)
          fields.push(field)
        }
        state = {
          definition: {
            version: 1,
            source: { kind: command.source.kind, hash },
            fields,
          },
          data: {},
          source: { ...command.source, hash },
          validation: emptyValidation(),
        }
        emit({ type: 'state-changed' })
        return { type: 'ok' }
      }

      case 'hydrate': {
        await adapter.load(command.source)
        const hash = command.source.hash ?? command.definition.source.hash
        preview = adapter.getPreview()
        const fields = command.definition.fields.map((f) => ({ ...f }))
        for (const field of fields) await adapter.insertAnchor(field)
        state = {
          definition: {
            ...command.definition,
            fields,
          },
          data: cloneData(command.data ?? {}),
          source: { ...command.source, hash },
          validation: emptyValidation(),
        }
        refreshValidation()
        emit({ type: 'data-changed' })
        return { type: 'ok' }
      }

      case 'insertField': {
        const definition = requireDefinition()
        const field: Field = {
          ...command.field,
          id: command.field.id ?? createId(),
        }
        if (definition.fields.some((f) => f.name === field.name)) {
          throw new Error(`field name already exists: ${field.name}`)
        }
        await adapter.insertAnchor(field)
        definition.fields = [...definition.fields, field]
        refreshValidation()
        emit({ type: 'field-inserted', fieldId: field.id })
        return { type: 'ok' }
      }

      case 'updateField': {
        const definition = requireDefinition()
        const index = definition.fields.findIndex((f) => f.id === command.id)
        if (index < 0) throw new Error(`field not found: ${command.id}`)
        const next: Field = { ...definition.fields[index], ...command.patch, id: command.id }
        if (adapter.updateAnchor) await adapter.updateAnchor(next)
        definition.fields = definition.fields.map((f, i) => (i === index ? next : f))
        refreshValidation()
        emit({ type: 'field-updated', fieldId: command.id })
        return { type: 'ok' }
      }

      case 'removeField': {
        const definition = requireDefinition()
        const field = definition.fields.find((f) => f.id === command.id)
        if (!field) throw new Error(`field not found: ${command.id}`)
        await adapter.removeAnchor(command.id)
        definition.fields = definition.fields.filter((f) => f.id !== command.id)
        delete state.data[field.name]
        refreshValidation()
        emit({ type: 'field-removed', fieldId: command.id })
        return { type: 'ok' }
      }

      case 'setValue': {
        requireDefinition()
        state.data = { ...state.data, [command.path]: command.value }
        refreshValidation()
        emit({ type: 'data-changed' })
        return { type: 'ok' }
      }

      case 'setData': {
        requireDefinition()
        state.data = cloneData(command.data)
        refreshValidation()
        emit({ type: 'data-changed' })
        return { type: 'ok' }
      }

      case 'resetData': {
        requireDefinition()
        state.data = {}
        refreshValidation()
        emit({ type: 'data-changed' })
        return { type: 'ok' }
      }

      case 'export': {
        requireDefinition()
        await adapter.bind(state.data)
        const buffer = await adapter.export()
        const format = command.format ?? adapter.kind
        emit({ type: 'exported', format, bytes: buffer.byteLength })
        return { type: 'exported', buffer, format }
      }
    }
  }

  return {
    getState: snapshot,
    getDefinition: () => snapshot().definition,
    getData: () => snapshot().data,
    getFormSchema: () => buildFormSchema(state),
    getView: () => buildView(state),
    getPreview: () => preview,
    getSource: () => state.source,
    validate: () => validateState(state),
    can,
    dispatch,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setViewport(next) {
      viewport = next
    },
  }
}
