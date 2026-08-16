# contract-kit 接口文档

面向接入方的公共 API。实现细节与时序见 [architecture.md](./architecture.md)。

## 安装与入口

```bash
npm i contract-kit
```

| 导入路径 | 内容 |
|----------|------|
| `contract-kit` | `createKernel`、标记工具、kernel 类型 |
| `contract-kit/docx` | `DocxAdapter` |
| `contract-kit/xlsx` | `XlsxAdapter` |
| `contract-kit/ui` | `createField` / `mountField` |
| `contract-kit/ui/style.css` | 原生字段样式 |
| `contract-kit/pdf` | `exportFilledDocument` 等 |

等价子包：`@contract-kit/kernel`、`docx`、`xlsx`、`ui`、`pdf`。

---

## 标记语法

模板正文中的占位符：

```text
{{name}}
{{name:type}}
{{items.col}}
{{items.col:number}}
{{items.$index}}
```

| 项 | 说明 |
|----|------|
| `name` | 字段名（data / definition 的 key） |
| `type` | 可选；缺省为 `text` |
| `items.col` | **循环明细表**列标记：表字段名 + `.` + 列名 |
| `items.$index` | 可选；导出/预览时替换为 1-based 行号 |

支持的 `type`：`text` | `textarea` | `number` | `date` | `select` | `multiselect` | `table` | `image` | `display`。

> `label` / `required` / `options` / 表 `columns` **不在标记里**，写在 `TemplateDefinition`。  
> `image` 类型仅预留，尚未实现嵌图。  
> `display`：纯展示，data 仍可 `setValue` / 导出替换，预览不渲染输入框（适合联动结果、系统填入的日期等）。

### 循环明细表

模板中保留**一行**带 `{{items.*}}` 的行作为行模板；表头/合计用普通扁平标记。

```ts
// data
{ items: [{ name: '苹果', qty: 10 }, { name: '橙', qty: 5 }], amount: 100 }

// definition 字段（discover 自动聚合成 type: 'table'）
{
  name: 'items',
  type: 'table',
  columns: [
    { name: 'name', type: 'text', label: '货物名称', required: true },
    { name: 'qty', type: 'number', label: '数量' },
  ],
  anchor: { kind: 'marker', name: 'items' }
}
```

`setValue` 支持：

- `items` — 整表数组  
- `items.0.qty` — 单元格  

导出时 docx/xlsx 按数组长度克隆模板行。校验：`table.required` → 非空数组；列 `required` → `items.i.col`。

辅助函数（`contract-kit`）：

| 函数 | 说明 |
|------|------|
| `parseMarkers(text)` | 解析去重后的标记列表 |
| `aggregateMarkerFields(markers)` | 将 `items.col` 聚成一个 `table` 字段 + columns |
| `splitByMarkers(text)` | 拆成 `text` / `field` 段（预览挂控件用） |
| `replaceMarkers(text, data)` | 用 data 替换扁平标记 |
| `replaceRowMarkers(text, table, row, index)` | 替换一行内的 `table.col` / `$index` |
| `stringifyFieldValue(value)` | 导出时把值转成字符串 |

---

## 核心类型

### `TemplateDefinition`

```ts
interface TemplateDefinition {
  version: 1
  source: { kind: 'docx' | 'xlsx'; hash: string }
  fields: Field[]
}
```

### `Field`

```ts
interface Field {
  id: string
  name: string
  type: FieldType
  label?: string
  required?: boolean
  options?: { value: string; label: string }[]
  columns?: FieldColumn[] // type === 'table'
  anchor: Anchor
}

interface FieldColumn {
  name: string
  type: FieldType
  label?: string
  required?: boolean
  options?: FieldOption[]
}
```

常见 `anchor`：

- Word：`{ kind: 'marker', name: string }`
- Excel：`{ kind: 'cell', sheet: string, address: string }`

### `Source`

```ts
interface Source {
  kind: 'docx' | 'xlsx'
  buffer: Uint8Array
  hash?: string
}
```

### `ValidationResult`

```ts
interface ValidationResult {
  ok: boolean
  issues: { path: string; message: string }[]
}
```

当前规则：

1. `required` 且值为 `undefined` / `null` / `''` →「必填」
2. `select` 有值但不在 `options` →「不在选项中」
3. `table.required` 且数组为空 →「必填」；列 `required` → `items.0.name` 等路径

### `FormSchema`

```ts
interface FormSchema {
  fields: FormSchemaField[] // 含 value、required、label、options…
}
```

用于渲染表单控件。

---

## Kernel

```ts
import { createKernel } from 'contract-kit'
import { DocxAdapter } from 'contract-kit/docx'

const kernel = createKernel({ adapter: new DocxAdapter() })
```

### 方法一览

| 方法 | 返回 | 说明 |
|------|------|------|
| `dispatch(command)` | `Promise<DispatchResult>` | **唯一写入口** |
| `getState()` | `KernelState` | definition + data + source + validation 快照 |
| `getDefinition()` | `TemplateDefinition \| null` | 字段定义 |
| `getData()` | `Record<string, unknown>` | 填写值 |
| `getFormSchema()` | `FormSchema` | 表单字段（含当前 value） |
| `getView()` | `ViewModel` | `{ id, label, value }[]` |
| `getPreview()` | `PreviewModel \| null` | adapter 预览结构 |
| `getSource()` | `Source \| null` | 原始文件 |
| `validate()` | `ValidationResult` | 立即重算校验 |
| `can(command)` | `boolean` | 当前是否可执行该命令 |
| `subscribe(listener)` | `() => void` | 订阅事件；返回取消函数 |
| `setViewport(port)` | `void` | 可选：对接预览选区 / 高亮 |

`DispatchResult`：

```ts
type DispatchResult =
  | { type: 'ok' }
  | { type: 'exported'; buffer: Uint8Array; format: 'docx' | 'xlsx' }
```

### `dispatch` 命令

| Command | 作用 | 典型返回 |
|---------|------|----------|
| `{ type: 'load', source }` | 加载文件并扫标记生成 definition | `ok` |
| `{ type: 'hydrate', source, definition, data? }` | 用已发布 definition + data 恢复 | `ok` |
| `{ type: 'insertField', field }` | 新增字段 | `ok` |
| `{ type: 'updateField', id, patch }` | 改 label / required / options 等 | `ok` |
| `{ type: 'removeField', id }` | 删除字段 | `ok` |
| `{ type: 'setValue', path, value }` | 写单个字段 | `ok` |
| `{ type: 'setData', data }` | 整表替换 data | `ok` |
| `{ type: 'resetData' }` | 清空 data | `ok` |
| `{ type: 'export', format? }` | bind 后导出新文件（不改原 buffer） | `exported` |

说明：

- `load`：适合「只有文件」；业务 options / 必填需再 hydrate 或 `updateField`。
- `hydrate`：已发布模板主路径；`source.kind` 须与 adapter 一致。
- `export`：在**副本**上替换标记；`getSource().buffer` 不变。

### 事件 `KernelEvent`

`subscribe` 收到的事件（多数写操作后还会再发一次 `state-changed`）：

| `type` | 含义 |
|--------|------|
| `state-changed` | 状态有变更 |
| `data-changed` | data 变了 |
| `validated` | 带 `result: ValidationResult` |
| `field-inserted` / `field-updated` / `field-removed` | definition 字段变更 |
| `exported` | 导出完成（含 format / bytes） |

### `can(command)` 规则摘要

| 命令 | 条件 |
|------|------|
| `load` / `hydrate` | `source.kind === adapter.kind` |
| 其余写命令 / `export` | 已有 `definition` 且已有 `source` |

---

## Adapters

实现 `DocumentAdapter`，由 kernel 调用；接入方一般只 `new` 后交给 `createKernel`。

```ts
interface DocumentAdapter {
  kind: 'docx' | 'xlsx'
  load(source: Source): Promise<void>
  discoverFields(): Promise<DiscoveredField[]>
  getPreview(): PreviewModel
  insertAnchor(field: Field): Promise<void>
  updateAnchor?(field: Field): Promise<void>
  removeAnchor(fieldId: string): Promise<void>
  bind(data: Record<string, unknown>): Promise<void>
  export(): Promise<Uint8Array>
}
```

| 类 | 导入 | 说明 |
|----|------|------|
| `DocxAdapter` | `contract-kit/docx` | OOXML / JSZip；按 `{{marker}}` bind |
| `XlsxAdapter` | `contract-kit/xlsx` | ExcelJS；单元格文本中的标记 |

---

## `@contract-kit/ui`（可选）

框架无关原生控件。

```ts
import { createField, mountField } from 'contract-kit/ui'
import 'contract-kit/ui/style.css'

const handle = mountField(slotEl, {
  name: 'partyA',
  field: schemaField, // Partial<FormSchemaField>
  value: schemaField?.value,
  error: issueMessage,
  onChange: (value) => kernel.dispatch({ type: 'setValue', path: 'partyA', value }),
})

handle.update({ value, error, field })
handle.destroy()
```

| API | 说明 |
|-----|------|
| `createField(options)` | 创建控件，返回 `FieldHandle`（含 `el`） |
| `mountField(parent, options)` | 创建并挂到 `parent` |

`FieldHandle`：`el` / `update` / `destroy`。

不引入本包时，在槽位自挂组件即可（见 `examples/custom-ui`）。

---

## `@contract-kit/pdf`（可选，浏览器）

对 **已 `export` 的文件** 再转 PDF（不是截填写页表单 DOM）。

```ts
import { exportFilledDocument, supportsCanvasDrawElement } from 'contract-kit/pdf'

const filled = await kernel.dispatch({ type: 'export' })
if (filled.type !== 'exported') throw new Error('export failed')

// 注意：这里用 kind；kernel 导出结果字段名是 format（同义）
const pdf = await exportFilledDocument({
  kind: filled.format,
  buffer: filled.buffer,
  options: { mode: 'html2canvas' },
})
```

### 输入

```ts
type FilledExportInput = {
  kind: 'docx' | 'xlsx'
  buffer: Uint8Array
  options?: ExportPdfOptions
}

interface ExportPdfOptions {
  mode?: 'html2canvas' | 'canvas-draw-element' | 'print' // 默认 html2canvas
  scale?: number       // 默认 2
  format?: 'a4' | 'letter'
  marginMm?: number    // 默认 8
  pageSelector?: string
  background?: string
}
```

### API

| 函数 | 返回 | 说明 |
|------|------|------|
| `exportFilledDocument(input)` | `Uint8Array \| void` | 统一入口；`print` 时为 `void` |
| `exportFilledToPdf(input)` | `Uint8Array` | 仅截图像素模式 |
| `printFilledDocument(input)` | `Promise<void>` | 系统打印 → 另存为 PDF |
| `supportsCanvasDrawElement()` | `boolean` | 探测 Chromium html-in-canvas |
| `exportElementToPdf(el, options?)` | `Uint8Array` | 对已有 DOM 根节点截图导出 |

| `mode` | 行为 |
|--------|------|
| `html2canvas` | DOM → canvas → jsPDF 字节 |
| `canvas-draw-element` | 需开启 `chrome://flags/#canvas-draw-element` |
| `print` | `window.print()`，无文件字节 |

---

## 典型调用顺序

```ts
// 1. 打开已发布模板
await kernel.dispatch({
  type: 'hydrate',
  source: { kind: 'docx', buffer },
  definition,
  data: savedData ?? {},
})

// 2. 渲染：getSource + getFormSchema；槽位 onChange → setValue
kernel.subscribe(() => {
  schema = kernel.getFormSchema()
  validation = kernel.validate()
})

await kernel.dispatch({ type: 'setValue', path: 'partyA', value: 'Acme' })

// 3. 导出 Office
const file = await kernel.dispatch({ type: 'export' })
// file.buffer / file.format

// 4. 可选 PDF
await exportFilledDocument({
  kind: file.format,
  buffer: file.buffer,
  options: { mode: 'html2canvas' },
})

// 5. 持久化
save({
  file: kernel.getSource()!.buffer,
  definition: kernel.getDefinition(),
  data: kernel.getData(),
})
```

---

## 明确不在本库范围

- 用户 / 权限 / 审批 / OSS
- 在线 Word/Excel 编辑器
- 服务端「正宗 Office → PDF」引擎
- `.doc` / `.xls` 老格式
