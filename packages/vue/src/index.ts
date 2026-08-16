import { shallowRef, unref, watch, type MaybeRef } from 'vue'
import {
  snapshotKernel,
  type FormSchema,
  type Kernel,
  type KernelSnapshot,
  type PreviewModel,
  type Source,
  type TemplateDefinition,
  type ValidationResult,
} from '@paperfill/kernel'

const empty: KernelSnapshot = {
  schema: { fields: [] },
  data: {},
  validation: { ok: true, issues: [] },
  preview: null,
  definition: null,
  source: null,
}

/**
 * Subscribe a Vue component to kernel query snapshots.
 * `mountDocxPreview` / `mountXlsxPreview` stay client-only.
 */
export function useContractKit(kernel: MaybeRef<Kernel | null | undefined>) {
  const schema = shallowRef<FormSchema>(empty.schema)
  const data = shallowRef<Record<string, unknown>>(empty.data)
  const validation = shallowRef<ValidationResult>(empty.validation)
  const preview = shallowRef<PreviewModel | null>(empty.preview)
  const definition = shallowRef<TemplateDefinition | null>(empty.definition)
  const source = shallowRef<Source | null>(empty.source)

  function apply(next: KernelSnapshot) {
    schema.value = next.schema
    data.value = next.data
    validation.value = next.validation
    preview.value = next.preview
    definition.value = next.definition
    source.value = next.source
  }

  watch(
    () => unref(kernel),
    (current, _prev, onCleanup) => {
      if (!current) {
        apply(empty)
        return
      }
      apply(snapshotKernel(current))
      onCleanup(current.subscribe(() => apply(snapshotKernel(current))))
    },
    { immediate: true },
  )

  return { schema, data, validation, preview, definition, source }
}

export type { KernelSnapshot }
