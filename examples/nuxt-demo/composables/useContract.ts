import { onUnmounted, ref, shallowRef } from 'vue'
import {
  createKernel,
  DocxAdapter,
  XlsxAdapter,
  type FormSchema,
  type Kernel,
  type PreviewModel,
  type TemplateDefinition,
  type ValidationResult,
} from 'paperfill'

export type ContractSummary = {
  id: string
  title: string
  kind: 'docx' | 'xlsx'
  description: string
}

export type ContractPayload = {
  id: string
  title: string
  kind: 'docx' | 'xlsx'
  data: Record<string, unknown>
  definition: TemplateDefinition
  fileUrl: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `请求失败 ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useContract() {
  const kernel = shallowRef<Kernel | null>(null)
  const payload = shallowRef<ContractPayload | null>(null)
  const buffer = shallowRef<Uint8Array | null>(null)
  const schema = ref<FormSchema>({ fields: [] })
  const preview = shallowRef<PreviewModel | null>(null)
  const validation = ref<ValidationResult>({ ok: true, issues: [] })
  /** 自定义页：槽位不显示 kernel 错误 */
  const slotValidation = ref<ValidationResult>({ ok: true, issues: [] })
  const loading = ref(false)
  const list = ref<ContractSummary[]>([])

  let stop: (() => void) | null = null

  function sync() {
    const current = kernel.value
    if (!current) return
    schema.value = current.getFormSchema()
    preview.value = current.getPreview()
    validation.value = current.validate()
  }

  function attach(next: Kernel, detail: ContractPayload, fileBuffer: Uint8Array) {
    stop?.()
    kernel.value = next
    payload.value = detail
    buffer.value = fileBuffer
    stop = next.subscribe(() => sync())
    sync()
  }

  async function loadList() {
    const data = await fetchJson<{ items: ContractSummary[] }>('/api/contracts')
    list.value = data.items
  }

  async function openContract(id: string) {
    loading.value = true
    try {
      const [detail, fileRes] = await Promise.all([
        fetchJson<ContractPayload>(`/api/contracts/${id}`),
        fetch(`/api/contracts/${id}/file`),
      ])
      if (!fileRes.ok) throw new Error('模板下载失败')
      const fileBuffer = new Uint8Array(await fileRes.arrayBuffer())
      const next = createKernel({
        adapter: detail.kind === 'docx' ? new DocxAdapter() : new XlsxAdapter(),
      })
      await next.dispatch({
        type: 'hydrate',
        source: { kind: detail.kind, buffer: fileBuffer },
        definition: detail.definition,
        data: detail.data,
      })
      attach(next, detail, fileBuffer)
    } finally {
      loading.value = false
    }
  }

  async function setValue(path: string, value: unknown) {
    const current = kernel.value
    if (!current) return
    await current.dispatch({ type: 'setValue', path, value })
  }

  async function insertRow(table: string, index?: number, row?: Record<string, unknown>) {
    const current = kernel.value
    if (!current) return
    await current.dispatch({ type: 'insertRow', table, index, row })
  }

  async function removeRow(table: string, index: number) {
    const current = kernel.value
    if (!current) return
    await current.dispatch({ type: 'removeRow', table, index })
  }

  async function exportFile() {
    const current = kernel.value
    if (!current) throw new Error('尚未打开合同')
    const result = await current.dispatch({ type: 'export' })
    if (result.type !== 'exported') throw new Error('导出失败')
    return { buffer: result.buffer, format: result.format }
  }

  function validate() {
    if (!kernel.value) {
      return { ok: false as const, issues: [{ path: '', message: '尚未打开合同' }] }
    }
    return kernel.value.validate()
  }

  function getData() {
    return kernel.value?.getData() ?? {}
  }

  function reset() {
    stop?.()
    stop = null
    kernel.value = null
    payload.value = null
    buffer.value = null
    preview.value = null
    schema.value = { fields: [] }
    validation.value = { ok: true, issues: [] }
    slotValidation.value = { ok: true, issues: [] }
  }

  onUnmounted(() => stop?.())

  return {
    list,
    payload,
    buffer,
    schema,
    preview,
    validation,
    slotValidation,
    loading,
    loadList,
    openContract,
    setValue,
    insertRow,
    removeRow,
    exportFile,
    validate,
    getData,
    reset,
  }
}
