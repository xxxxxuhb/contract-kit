# Changelog

本仓库按 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 记录公开 API 变化。版本遵循 semver；`0.x` 仍可能有破坏性调整。

## 0.1.0

### Added

- Headless `createKernel`：`load` / `hydrate` / `setValue` / `export`，以及字段增删改。
- `@contract-kit/docx`：`DocxAdapter`、`mountDocxPreview`、锚点写回、image 嵌图、明细表扩行。
- `@contract-kit/xlsx`：`XlsxAdapter`、`mountXlsxPreview`、单元格颜色预览、锚点写回、image 嵌图。
- `@contract-kit/ui`：原生 `createField` / `mountField` / `nativeFieldMounter`。
- `@contract-kit/vue` / `@contract-kit/react`：`useContractKit` 订阅快照。
- 可扩展校验：`Field.rules` + `createKernel({ validators })`。
- 表格行：`insertRow` / `removeRow`；空表预览与导出保留一行占位。
- Persist 约定：`toPersistBundle` / `hydrateFromBundle` / `snapshotKernel`。
- 伞包 `contract-kit` 子路径：`/docx` `/xlsx` `/ui` `/vue` `/react` `/pdf`。

### Notes

- `export` bind 时未写入 `data` 的扁平标记会被清空（与预览空槽一致）；`replaceMarkers` 默认仍保留缺失标记。
- Word / Excel 预览版式受 `docx-preview` / ExcelJS 限制，见 README。
