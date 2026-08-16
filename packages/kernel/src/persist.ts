import type { FormSchema, Kernel, PreviewModel, Source, TemplateDefinition, ValidationResult } from './types'

/** Persist the three artifacts the page owns. */
export type PersistBundle = {
  file: Uint8Array
  definition: TemplateDefinition
  data: Record<string, unknown>
}

export type KernelSnapshot = {
  schema: FormSchema
  data: Record<string, unknown>
  validation: ValidationResult
  preview: PreviewModel | null
  definition: TemplateDefinition | null
  source: Source | null
}

export function snapshotKernel(kernel: Kernel): KernelSnapshot {
  return {
    schema: kernel.getFormSchema(),
    data: kernel.getData(),
    validation: kernel.validate(),
    preview: kernel.getPreview(),
    definition: kernel.getDefinition(),
    source: kernel.getSource(),
  }
}

export function toPersistBundle(kernel: Kernel): PersistBundle | null {
  const source = kernel.getSource()
  const definition = kernel.getDefinition()
  if (!source || !definition) return null
  return {
    file: source.buffer,
    definition,
    data: kernel.getData(),
  }
}

export function hydrateFromBundle(bundle: PersistBundle) {
  return {
    type: 'hydrate' as const,
    source: { kind: bundle.definition.source.kind, buffer: bundle.file },
    definition: bundle.definition,
    data: bundle.data,
  }
}
