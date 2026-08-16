import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TemplateDefinition } from 'contract-kit'

export type FieldOption = { value: string; label: string }

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

function templatesDir() {
  const candidates = [
    join(process.cwd(), '../templates'), // nuxt-demo / next cwd
    join(process.cwd(), 'examples/templates'), // monorepo root cwd
    join(dirname(fileURLToPath(import.meta.url)), '../templates'),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  return candidates[0]
}

const OPTIONS_BY_CONTRACT: Record<string, Record<string, FieldOption[]>> = {
  'purchase-docx': sharedOptions(),
  'purchase-xlsx': sharedOptions(),
}

function sharedOptions(): Record<string, FieldOption[]> {
  return {
    payMethod: [
      { value: 'wire', label: '电汇' },
      { value: 'acceptance', label: '承兑汇票' },
      { value: 'check', label: '支票' },
    ],
    deliveryRegions: [
      { value: 'east', label: '华东' },
      { value: 'north', label: '华北' },
      { value: 'south', label: '华南' },
      { value: 'west', label: '西部' },
    ],
    'items.category': [
      { value: 'hardware', label: '硬件' },
      { value: 'software', label: '软件' },
      { value: 'service', label: '服务' },
    ],
  }
}

const CONTRACTS: ContractSummary[] = [
  {
    id: 'purchase-docx',
    title: '采购合同 · Word',
    kind: 'docx',
    description: '覆盖 text / textarea / number / date / select / multiselect / table / display / image',
  },
  {
    id: 'purchase-xlsx',
    title: '采购合同 · Excel',
    kind: 'xlsx',
    description: '同一套字段类型，xlsx 模板 + 单元格预览填写',
  },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function loadDefinitionShell(kind: 'docx' | 'xlsx'): TemplateDefinition {
  const name = kind === 'docx' ? '采购合同.docx.definition.json' : '采购合同.xlsx.definition.json'
  const raw = JSON.parse(readFileSync(join(templatesDir(), name), 'utf8')) as TemplateDefinition
  return {
    ...raw,
    fields: raw.fields.map((field) => {
      const { options: _drop, ...rest } = field
      return {
        ...rest,
        columns: field.columns?.map((col) => {
          const { options: _colDrop, ...colRest } = col
          return colRest
        }),
      }
    }),
  }
}

function mergeOptions(
  definition: TemplateDefinition,
  optionsMap: Record<string, FieldOption[]>,
): TemplateDefinition {
  return {
    ...definition,
    fields: definition.fields.map((field) => {
      const options = optionsMap[field.name]
      const columns = field.columns?.map((col) => {
        const colOptions = optionsMap[`${field.name}.${col.name}`]
        return colOptions?.length ? { ...col, options: colOptions } : col
      })
      return {
        ...field,
        ...(options?.length ? { options } : {}),
        ...(columns ? { columns } : {}),
      }
    }),
  }
}

function sampleData(): Record<string, unknown> {
  return {
    contractNo: 'CG-2026-0816',
    signPlace: '上海',
    partyA: '星河科技有限公司',
    partyAAddress: '上海市浦东新区示例路 100 号',
    partyAContact: '张三',
    partyB: '远航供应链有限公司',
    partyBAddress: '杭州市西湖区示例大道 88 号',
    partyBContact: '李四',
    amount: 15998,
    payMethod: 'wire',
    deliveryRegions: ['east', 'south'],
    payTerm: '合同签订后 7 个工作日内',
    deliveryDate: today(),
    deliveryPlace: '甲方指定仓库',
    warranty: '12 个月',
    signDate: today(),
    note: '本草稿由模拟后端返回。类型覆盖：text/textarea/number/date/select/multiselect/table/display/image。',
    filledAt: today(),
    stamp: '',
    items: [
      { name: '笔记本电脑', category: 'hardware', qty: 2, unitPrice: 5999 },
      { name: '实施服务', category: 'service', qty: 1, unitPrice: 4000 },
    ],
  }
}

export function listContracts(): ContractSummary[] {
  return CONTRACTS
}

export function getFieldOptions(contractId: string): Record<string, FieldOption[]> {
  return OPTIONS_BY_CONTRACT[contractId] ?? {}
}

export function getContractPayload(id: string): ContractPayload | null {
  const summary = CONTRACTS.find((item) => item.id === id)
  if (!summary) return null
  const shell = loadDefinitionShell(summary.kind)
  const options = getFieldOptions(id)
  return {
    id: summary.id,
    title: summary.title,
    kind: summary.kind,
    data: sampleData(),
    definition: mergeOptions(shell, options),
    fileUrl: `/api/contracts/${id}/file`,
  }
}

export function readContractFile(id: string): { buffer: Buffer; filename: string; contentType: string } | null {
  const summary = CONTRACTS.find((item) => item.id === id)
  if (!summary) return null
  const filename = summary.kind === 'docx' ? '采购合同.docx' : '采购合同.xlsx'
  const buffer = readFileSync(join(templatesDir(), filename))
  const contentType =
    summary.kind === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return { buffer, filename, contentType }
}
