# contract-kit

**中文** | [English](./README.en.md)

**在 Word / Excel 原文排版上填写合同，而不是另开一张表再生成文档。**

`contract-kit` 是一套 **headless** 合同模板运行时：内核只管字段定义、填写数据与导出；页面自己决定预览和输入框长什么样。适合嵌入你们已有的业务系统（上传、权限、审批、OSS 仍由接入方负责）。

> 不是在线 Office、不是低代码表单平台、也不是完整合同中台。

## 为什么用它

| 痛点 | contract-kit 的做法 |
|------|---------------------|
| 表单和合同版式两套东西 | 标记写在 `.docx` / `.xlsx` 里，预览按原文排版，输入框嵌在标记处 |
| 下拉选项塞进 Word 很别扭 | 选项在 `definition` JSON，不污染模板文件 |
| 导出改坏原模板 | 原文件只读；导出 = 原文件 ⊕ definition ⊕ data |
| 绑死某家 UI 库 | kernel / adapter 无框架；可选原生 `ui`，也可完全自绘 |

## 工作方式

模板里写标记：

```text
甲方：{{partyA}}
金额：{{amount:number}}
付款方式：{{payMethod:select}}
签订日期：{{signDate:date}}
明细行：{{items.name}} / {{items.qty:number}}（循环表，data 为 items[]）
只读展示：{{filledAt:display}}（data 动态，界面不可编辑）
```

运行时持久化三样东西：

1. **原始文件** — 不可变模板  
2. **definition** — 字段类型、label、required、options、锚点  
3. **data** — 用户填写值  

页面用 `hydrate` 打开，用 `setValue` 填；`export` 得到填好的 `.docx` / `.xlsx`，再交给 `@contract-kit/pdf` 可得到同内容的 PDF。

## 安装

```bash
npm i contract-kit
```

也可按需引用子包：`@contract-kit/kernel`、`@contract-kit/docx`、`@contract-kit/xlsx`、`@contract-kit/ui`、`@contract-kit/pdf`。

## 快速开始

```ts
import { createKernel } from 'contract-kit'
import { DocxAdapter } from 'contract-kit/docx'
import { mountField } from 'contract-kit/ui'
import 'contract-kit/ui/style.css'

const kernel = createKernel({ adapter: new DocxAdapter() })

// 已发布模板：原文件 + 字段定义
await kernel.dispatch({
  type: 'hydrate',
  source: { kind: 'docx', buffer },
  definition, // 含 label / required / options
  data: {},
})

// 在文档标记槽位挂原生输入框（也可用你们自己的 UI）
mountField(slotEl, {
  name: 'partyA',
  field: kernel.getFormSchema().fields.find((f) => f.name === 'partyA'),
  onChange: (value) => {
    void kernel.dispatch({ type: 'setValue', path: 'partyA', value })
  },
})

const stop = kernel.subscribe(() => {
  // schema / validation / preview 有更新
})

const result = await kernel.dispatch({ type: 'export' })
// result.buffer → 下载填好的 .docx
```

只有合同文件、还没有 definition 时，用 `load`：从 `{{markers}}` 扫描字段；业务 options 再通过 definition 补齐。

## 包结构

| 包 | 职责 |
|----|------|
| `contract-kit` | 统一入口，re-export 下列能力 |
| `@contract-kit/kernel` | 状态机：`dispatch` / schema / validate / subscribe |
| `@contract-kit/docx` | Word：扫标记、预览结构、bind、导出 |
| `@contract-kit/xlsx` | Excel：单元格标记、合并预览、bind、导出 |
| `@contract-kit/ui` | **可选**：框架无关的原生 `input` / `select` / `textarea` / `date` |
| `@contract-kit/pdf` | **可选（浏览器）**：填好的 docx/xlsx → PDF（三种 mode） |

```ts
import { exportFilledDocument } from 'contract-kit/pdf'

const filled = await kernel.dispatch({ type: 'export' })
if (filled.type !== 'exported') throw new Error('export failed')

// mode 由外部传入，默认 html2canvas
await exportFilledDocument({
  kind: filled.format,
  buffer: filled.buffer,
  options: { mode: 'html2canvas' }, // | 'canvas-draw-element' | 'print'
})
```

| `mode` | 行为 |
|--------|------|
| `html2canvas`（默认） | DOM 截图 + jsPDF，直接下载 PDF 字节 |
| `canvas-draw-element` | WICG [html-in-canvas](https://github.com/WICG/html-in-canvas)，需 Chromium `chrome://flags/#canvas-draw-element` |
| `print` | 系统打印 →「另存为 PDF」（最稳，无字节返回） |

可用 `supportsCanvasDrawElement()` 探测原生能力。

### 字段 UI：默认原生，或完全自绘

- **默认**：`@contract-kit/ui` 的 `createField` / `mountField`，无 Vue / React / Element 依赖。  
- **自绘**：不引入 `ui`，在标记槽位挂你们自己的组件（示例见 `examples/custom-ui`）。

## 示例

```bash
npm install
npm run templates          # 生成采购合同模板 + definition.json
npm run example:native    # http://localhost:5199  原生字段 UI
npm run example:custom     # http://localhost:5200  Element Plus 自绘字段
npm run build:examples     # 构建静态站到 dist-examples/（可预览 Pages 产物）
```

在线演示（GitHub Pages，推送 `main` / `v2` 后自动更新）：

- https://xxxxxuhb.github.io/contract-kit/
- [native-ui](https://xxxxxuhb.github.io/contract-kit/native/) · [custom-ui](https://xxxxxuhb.github.io/contract-kit/custom/)

仓库 **Settings → Pages → Source** 选 **GitHub Actions**（首次部署前需开一次）。

| 目录 | 说明 |
|------|------|
| `examples/native-ui` | 页面壳 + `@contract-kit/ui`；右侧 **Definition 配置** 面板 |
| `examples/custom-ui` | 同一套 kernel，字段换成 Element Plus |
| `examples/shared` | 共用 hydrate / DocxLayout / `DefinitionPanel` |
| `examples/templates` | 模板 + `*.definition.json` + 备用 `*.definition.alt.json` |

打开示例后可：切换默认/alt definition、行内改 label/必填（`updateField`）、上传/下载 JSON——**不必改页面代码**。

## 开发

```bash
npm test                   # kernel / docx / xlsx / ui
npm run build              # 构建全部 packages
```

更完整的架构与时序图见 [docs/architecture.md](./docs/architecture.md)；接口说明见 [docs/api.md](./docs/api.md)。

## License

MIT
