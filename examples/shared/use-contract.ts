import { onUnmounted, ref, shallowRef } from 'vue'
import {
  createKernel,
  type FormSchema,
  type Kernel,
  type PreviewModel,
  type TemplateDefinition,
  type ValidationResult,
} from '@contract-kit/kernel'
import { DocxAdapter } from '@contract-kit/docx'
import { XlsxAdapter } from '@contract-kit/xlsx'
import { templateUrl } from './asset-url'

function createByKind(kind: 'docx' | 'xlsx'): Kernel {
  return kind === 'docx'
    ? createKernel({ adapter: new DocxAdapter() })
    : createKernel({ adapter: new XlsxAdapter() })
}

function detectKind(filename: string): 'docx' | 'xlsx' | null {
  const name = filename.toLowerCase()
  if (name.endsWith('.xlsx')) return 'xlsx'
  if (name.endsWith('.docx')) return 'docx'
  return null
}

export function useContract() {
  const kernel = shallowRef<Kernel | null>(null)
  const kind = ref<'docx' | 'xlsx' | null>(null)
  const schema = ref<FormSchema>({ fields: [] })
  const preview = shallowRef<PreviewModel | null>(null)
  const sourceBuffer = shallowRef<Uint8Array | null>(null)
  const validation = ref<ValidationResult>({ ok: true, issues: [] })
  const loading = ref(false)
  let stop: (() => void) | null = null

  function sync() {
    const current = kernel.value
    if (!current) {
      schema.value = { fields: [] }
      preview.value = null
      sourceBuffer.value = null
      validation.value = { ok: true, issues: [] }
      return
    }
    schema.value = current.getFormSchema()
    preview.value = current.getPreview()
    sourceBuffer.value = current.getSource()?.buffer ?? null
    validation.value = current.validate()
  }

  function attach(next: Kernel, nextKind: 'docx' | 'xlsx') {
    stop?.()
    kernel.value = next
    kind.value = nextKind
    stop = next.subscribe(() => sync())
    sync()
  }

  /** 已发布模板：原文件 + definition（含 label / required / options） */
  async function openPublished(nextKind: 'docx' | 'xlsx') {
    loading.value = true
    try {
      const basename = nextKind === 'docx' ? '采购合同.docx' : '采购合同.xlsx'
      const [fileRes, defRes] = await Promise.all([
        fetch(templateUrl(basename)),
        fetch(templateUrl(`${basename}.definition.json`)),
      ])
      if (!fileRes.ok || !defRes.ok) {
        throw new Error('模板或字段定义缺失，请先运行 npx tsx examples/templates/build.ts')
      }
      const buffer = new Uint8Array(await fileRes.arrayBuffer())
      const definition = (await defRes.json()) as TemplateDefinition
      const next = createByKind(nextKind)
      await next.dispatch({
        type: 'hydrate',
        source: { kind: nextKind, buffer },
        definition,
        data: {
          items: [{}],
          filledAt: new Date().toISOString().slice(0, 10),
        },
      })
      attach(next, nextKind)
    } finally {
      loading.value = false
    }
  }

  /** 仅上传合同文件：从标记扫描字段（无业务 options，需另载 definition） */
  async function openDocument(file: File) {
    const nextKind = detectKind(file.name)
    if (!nextKind) throw new Error('只支持 .docx / .xlsx')
    loading.value = true
    try {
      const buffer = new Uint8Array(await file.arrayBuffer())
      const next = createByKind(nextKind)
      await next.dispatch({ type: 'load', source: { kind: nextKind, buffer } })
      attach(next, nextKind)
    } finally {
      loading.value = false
    }
  }

  /** 对已打开文档套用业务字段定义（label / required / options） */
  async function applyDefinitionData(definition: TemplateDefinition) {
    const current = kernel.value
    const buffer = sourceBuffer.value
    const nextKind = kind.value
    if (!current || !buffer || !nextKind) throw new Error('请先打开合同文件')
    if (definition.source?.kind && definition.source.kind !== nextKind) {
      throw new Error(`字段定义格式为 ${definition.source.kind}，与当前文档不一致`)
    }
    loading.value = true
    try {
      const next = createByKind(nextKind)
      await next.dispatch({
        type: 'hydrate',
        source: { kind: nextKind, buffer },
        definition: {
          ...definition,
          source: { ...definition.source, kind: nextKind },
        },
        data: current.getData(),
      })
      attach(next, nextKind)
    } finally {
      loading.value = false
    }
  }

  async function applyDefinition(file: File) {
    const definition = JSON.parse(await file.text()) as TemplateDefinition
    await applyDefinitionData(definition)
  }

  /** 套用仓库里已发布的 definition（default | alt） */
  async function applyPublishedDefinition(variant: 'default' | 'alt' = 'default') {
    const nextKind = kind.value
    if (!nextKind) throw new Error('请先打开合同文件')
    const basename = nextKind === 'docx' ? '采购合同.docx' : '采购合同.xlsx'
    const suffix = variant === 'alt' ? '.definition.alt.json' : '.definition.json'
    const res = await fetch(templateUrl(`${basename}${suffix}`))
    if (!res.ok) throw new Error(`缺少 ${basename}${suffix}，请先 npm run templates`)
    const definition = (await res.json()) as TemplateDefinition
    await applyDefinitionData(definition)
  }

  async function updateFieldMeta(
    id: string,
    patch: { label?: string; required?: boolean },
  ) {
    const current = kernel.value
    if (!current) throw new Error('尚未打开合同')
    await current.dispatch({ type: 'updateField', id, patch })
  }

  function getDefinition(): TemplateDefinition | null {
    return kernel.value?.getDefinition() ?? null
  }

  function downloadDefinition(filename = 'contract.definition.json') {
    const definition = getDefinition()
    if (!definition) throw new Error('尚无字段定义')
    const text = JSON.stringify(definition, null, 2)
    downloadBuffer(
      new TextEncoder().encode(text),
      filename,
      'application/json',
    )
  }

  async function setValue(path: string, value: unknown) {
    await kernel.value?.dispatch({ type: 'setValue', path, value })
  }

  async function reset() {
    await kernel.value?.dispatch({ type: 'resetData' })
  }

  async function exportFile(): Promise<{ buffer: Uint8Array; format: 'docx' | 'xlsx' }> {
    const current = kernel.value
    if (!current) throw new Error('尚未打开合同')
    const result = await current.dispatch({ type: 'export' })
    if (result.type !== 'exported') throw new Error('export failed')
    return { buffer: result.buffer, format: result.format }
  }

  onUnmounted(() => stop?.())

  return {
    kind,
    schema,
    preview,
    sourceBuffer,
    validation,
    loading,
    openPublished,
    openDocument,
    applyDefinition,
    applyDefinitionData,
    applyPublishedDefinition,
    updateFieldMeta,
    getDefinition,
    downloadDefinition,
    setValue,
    reset,
    exportFile,
  }
}

export function downloadBuffer(buffer: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([new Uint8Array(buffer)], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
