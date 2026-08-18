# paperfill

**在 Word / Excel 原文排版上填写合同，而不是另开一张表再生成文档。**

Headless contract template runtime: the kernel owns field definitions, fill data, and export; your page owns preview and inputs.

库**不做**账号、OSS、审批、合同系统。

## 安装

```bash
npm i paperfill
```

只装这一个包。API 都从 `paperfill` 取（Word / Excel / 原生控件 / PDF 同一入口）：

```ts
import {
  createKernel,
  DocxAdapter,
  mountDocxPreview,
  XlsxAdapter,
  mountXlsxPreview,
  nativeFieldMounter,
  exportFilledDocument,
} from 'paperfill'
import 'paperfill/ui/style.css'
import 'paperfill/xlsx/style.css'
```

Vue / React 订阅用 `paperfill/vue` 或 `paperfill/react`。

## 使用场景

| 场景 | 谁做什么 |
|------|----------|
| 采购 / 销售合同在**原文**填写 | 法务出 Word/Excel 排版，正文写 `{{partyA}}`、`{{items.qty}}`；业务员在浏览器里对着原文填 |
| 模板发布 | 运营上传 `.docx` / `.xlsx`；后端 `load` 扫标记，补上 type / label / required / options / outputFormat，存成 **definition** |
| 草稿与续填 | 拉回原文件 + definition + 上次 `data`，`hydrate` 后接着填 |
| 导出 / 归档 | 浏览器 `export` 出已填写 Word/Excel；需要 PDF 时再对已导出文件转 PDF |
| 批量套打（无预览） | 服务端只跑 kernel：`hydrate` + `setData` + `export` |

不适合：在线 Word 编辑器、把填写结果只写回文档当唯一真相、服务端「正宗 Office → PDF」。

## 前后端怎么配合

**真相是三样东西**，由你们的后端存；文档文件只是模板和导出载体。

| 产物 | 谁写 | 说明 |
|------|------|------|
| 原始 `.docx` / `.xlsx` | 后端对象存储 | 发布后不要改；`export` 只在副本上 bind |
| `definition` JSON | 发布时生成 | 类型、label、必填、options、锚点 |
| `data` JSON | 填写页随改随存 | 用户填的值；明细表是数组 |

### 后端（存储 + 发布，不画 UI）

```ts
const kernel = createKernel({ adapter: new DocxAdapter() })
await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })
await db.saveTemplate({
  file: buffer,
  definition: kernel.getDefinition(),
})
```

批量出件同样在 Node：`hydrate` + `setData` + `export`。不要用导出文件覆盖原模板。

### 前端（预览 + 填写 + 导出）

```ts
const kernel = createKernel({
  adapter: detail.kind === 'docx' ? new DocxAdapter() : new XlsxAdapter(),
})

await kernel.dispatch({
  type: 'hydrate',
  source: { kind: detail.kind, buffer: fileBuffer },
  definition: detail.definition,
  data: detail.data ?? {},
})

mountDocxPreview(el, {
  buffer: fileBuffer,
  fields: kernel.getFormSchema().fields,
  mountField: nativeFieldMounter, // 或自绘 Element Plus
  onChange: (path, value) => kernel.dispatch({ type: 'setValue', path, value }),
})

await api.saveDraft(id, kernel.getData())

const office = await kernel.dispatch({ type: 'export' })
```

`mountDocxPreview` / `mountXlsxPreview` / `nativeFieldMounter` / `exportFilledDocument` 必须在浏览器里调用（`ClientOnly` / `useEffect` 之后）。`createKernel` / `hydrate` / `export` 前后端都能跑。

文档标记只写 `{{name}}` / `{{items.qty}}`。类型和导出格式在 definition：

```ts
{ name: 'signDate', type: 'date', outputFormat: 'DD日MM月YYYY年' }
// data: '2026-08-16'  →  export: '16日08月2026年'
```

选项导出文案用 `outputFormat: 'label'`。特殊格式用 `createKernel({ formatters: { amountCn } })`。标记默认 `{{name}}`，可 `createKernel({ markers: { start: '[[', end: ']]' } })`。扩展点用 `plugins`（不替代 validators / formatters / subscribe）。

## 限制

| 项 | 说明 |
|----|------|
| Node | `>= 20` |
| 浏览器 | Chrome / Edge ≥ 94，Firefox ≥ 93，Safari ≥ 15.4 |
| PDF | `exportFilledDocument` **仅浏览器**；默认 html2canvas，不是服务端 Office 转 PDF |
| 预览 | Word 靠 `docx-preview`，与桌面 Word 不完全一致 |

## 文档

- 仓库：<https://github.com/xxxxxuhb/paperfill>
- [架构](https://github.com/xxxxxuhb/paperfill/blob/main/docs/architecture.md)
- [API](https://github.com/xxxxxuhb/paperfill/blob/main/docs/api.md)

## License

MIT
