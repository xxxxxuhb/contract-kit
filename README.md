# contract-kit

**中文** | [English](./README.en.md)

**在 Word / Excel 原文排版上填写合同，而不是另开一张表再生成文档。**

`contract-kit` 是一套 **headless** 合同模板运行时：内核只管字段定义、填写数据与导出；页面自己决定预览和输入框长什么样。

## 示例（Nuxt）

```bash
npm install
npm run templates
npm run example          # http://localhost:5210
```

| 路径 | 说明 |
|------|------|
| `/` | 原生 UI（`@contract-kit/ui`），校验 = `kernel.validate()` |
| `/custom` | Element Plus 自绘字段，校验 = 页面 `el-form` rules |

模拟 API：`/api/contracts`、`/:id`、`/:id/options`、`/:id/file`（Nitro）。

模板：`examples/templates` 下 Word + Excel，覆盖全部字段类型。

## 安装

```bash
npm i contract-kit
```

## 包结构

| 包 | 职责 |
|----|------|
| `contract-kit` | 统一入口 |
| `@contract-kit/kernel` | 状态机 |
| `@contract-kit/docx` / `xlsx` | 适配器 |
| `@contract-kit/ui` | 可选原生控件 |
| `@contract-kit/pdf` | 可选浏览器 PDF |

文档：[docs/architecture.md](./docs/architecture.md) · [docs/api.md](./docs/api.md)

## 限制与环境

| 项 | 要求 / 说明 |
|----|-------------|
| **Node** | `>= 20`（构建、示例、脚本） |
| **浏览器** | 现代 evergreen：Chrome / Edge **≥ 94**，Firefox **≥ 93**，Safari **≥ 15.4**（编译目标 ES2022；需 `Uint8Array`、基础 DOM） |
| **运行时** | `kernel` / `docx` / `xlsx` 可在 Node 与浏览器使用；`ui`、`mountXlsxPreview`、Word 预览（`docx-preview`）、`pdf` 依赖 **浏览器 DOM**，勿在纯 SSR 路径直接调用 |
| **PDF** | `@contract-kit/pdf` **仅浏览器**；默认 `html2canvas`，不是服务端 Office 矢量转 PDF；`canvas-draw-element` 需 Chromium 实验 flag |
| **Word 预览** | 版式靠 `docx-preview`，与桌面 Word 不完全一致 |
| **Excel 预览** | `getPreview` / `mountXlsxPreview` 支持单元格填充色、字体色（`argb`；主题色为近似）；不覆盖渐变、条件格式、图表等 |
| **图片字段** | UI 可选图写入 data URL；**docx/xlsx bind 嵌图尚未实现** |
| **非目标** | 完整 Office 编辑器、服务端「正宗」排版引擎、Vue/React 绑定（`ui` 为框架无关 DOM） |

## License

MIT
