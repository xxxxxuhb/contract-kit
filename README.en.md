# contract-kit

[中文](./README.md) | **English**

**Fill contracts on the original Word / Excel layout — not on a separate form that regenerates the document.**

`contract-kit` is a **headless** contract-template runtime: the kernel owns field definitions, filled data, and export; your app owns preview and form controls. Embed it in an existing system (upload, auth, approval, and OSS stay yours).

> Not an online Office suite, not a low-code form builder, and not a full contract platform.

## Why use it

| Pain point | What contract-kit does |
|------------|------------------------|
| Form layout ≠ contract layout | Markers live in `.docx` / `.xlsx`; preview keeps the original layout; inputs sit on the markers |
| Awkward to stuff select options into Word | Options live in `definition` JSON — templates stay clean |
| Export corrupts the template | Source file is read-only; export = source ⊕ definition ⊕ data |
| Locked to one UI library | Kernel / adapters are framework-free; optional native `ui`, or roll your own |

## How it works

Markers in the template:

```text
Party A: {{partyA}}
Amount: {{amount:number}}
Payment: {{payMethod:select}}
Sign date: {{signDate:date}}
```

Persist three artifacts at runtime:

1. **Source file** — immutable template  
2. **definition** — field types, label, required, options, anchors  
3. **data** — user-entered values  

Open with `hydrate`, fill with `setValue`, `export` a filled `.docx` / `.xlsx`, then optionally pass it to `@contract-kit/pdf` for a matching PDF.

## Install

```bash
npm i contract-kit
```

Or install packages directly: `@contract-kit/kernel`, `@contract-kit/docx`, `@contract-kit/xlsx`, `@contract-kit/ui`, `@contract-kit/pdf`.

## Quick start

```ts
import { createKernel } from 'contract-kit'
import { DocxAdapter } from 'contract-kit/docx'
import { mountField } from 'contract-kit/ui'
import 'contract-kit/ui/style.css'

const kernel = createKernel({ adapter: new DocxAdapter() })

// Published template: source file + field definition
await kernel.dispatch({
  type: 'hydrate',
  source: { kind: 'docx', buffer },
  definition, // includes label / required / options
  data: {},
})

// Mount a native control on a marker slot (or use your own UI)
mountField(slotEl, {
  name: 'partyA',
  field: kernel.getFormSchema().fields.find((f) => f.name === 'partyA'),
  onChange: (value) => {
    void kernel.dispatch({ type: 'setValue', path: 'partyA', value })
  },
})

const stop = kernel.subscribe(() => {
  // schema / validation / preview updated
})

const result = await kernel.dispatch({ type: 'export' })
// result.buffer → download the filled .docx
```

If you only have the document and no definition yet, use `load` to discover fields from `{{markers}}`, then enrich with a definition (labels, options, required).

## Packages

| Package | Role |
|---------|------|
| `contract-kit` | Umbrella entry; re-exports core APIs |
| `@contract-kit/kernel` | State machine: `dispatch` / schema / validate / subscribe |
| `@contract-kit/docx` | Word: scan markers, preview model, bind, export |
| `@contract-kit/xlsx` | Excel: cell markers, merged preview, bind, export |
| `@contract-kit/ui` | **Optional**: framework-free native `input` / `select` / `textarea` / `date` |
| `@contract-kit/pdf` | **Optional (browser)**: filled docx/xlsx → PDF (three modes) |

```ts
import { exportFilledDocument } from 'contract-kit/pdf'

const filled = await kernel.dispatch({ type: 'export' })
if (filled.type !== 'exported') throw new Error('export failed')

// `mode` is chosen by the caller; default is html2canvas
await exportFilledDocument({
  kind: filled.format,
  buffer: filled.buffer,
  options: { mode: 'html2canvas' }, // | 'canvas-draw-element' | 'print'
})
```

| `mode` | Behavior |
|--------|----------|
| `html2canvas` (default) | DOM snapshot + jsPDF → PDF bytes |
| `canvas-draw-element` | WICG [html-in-canvas](https://github.com/WICG/html-in-canvas); needs Chromium `chrome://flags/#canvas-draw-element` |
| `print` | System print → “Save as PDF” (most reliable; no bytes returned) |

Use `supportsCanvasDrawElement()` to detect native support.

### Field UI: native default, or fully custom

- **Default**: `@contract-kit/ui` `createField` / `mountField` — no Vue / React / Element dependency.  
- **Custom**: skip `ui` and mount your own components on marker slots (see `examples/custom-ui`).

## Examples

```bash
npm install
npm run templates          # purchase-contract templates + definition.json
npm run example:native     # http://localhost:5199  native field UI
npm run example:custom     # http://localhost:5200  Element Plus custom fields
```

| Path | Description |
|------|-------------|
| `examples/native-ui` | Shell + `@contract-kit/ui`; **Definition** config panel on the right |
| `examples/custom-ui` | Same kernel; fields swapped for Element Plus |
| `examples/shared` | Shared hydrate / DocxLayout / `DefinitionPanel` |
| `examples/templates` | Templates + `*.definition.json` + alternate `*.definition.alt.json` |

In the examples you can switch default/alt definitions, edit label/required inline (`updateField`), and upload/download JSON — **no app code changes required**.

## Development

```bash
npm test                   # kernel / docx / xlsx / ui
npm run build              # build all packages
```

Architecture and sequence diagrams: [docs/architecture.md](./docs/architecture.md) (Chinese).  
API reference: [docs/api.md](./docs/api.md) (Chinese).

## License

MIT
