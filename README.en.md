# paperfill

**[中文](./README.md)** | English

Headless contract template runtime for Word / Excel: the kernel owns field definitions, fill data, and export; the page owns preview and inputs. This library is **not** an account / OSS / approval / contract product.

## When to use it

| Scenario | Who does what |
|----------|----------------|
| Fill a purchase / sales contract **on the original layout** | Legal designs Word/Excel with `{{partyA}}`, `{{items.qty}}`; staff type into the document in the browser instead of a separate form |
| Publish a template | Ops uploads `.docx` / `.xlsx`; backend (or a publish script) `load`s markers, adds type / label / required / options / outputFormat, stores **definition** |
| Drafts and resume | Open a published contract: fetch original file + definition + last `data`, then `hydrate` |
| Hand off / archive | Browser `export`s a filled Word/Excel; PDF is a second pass over the **already exported** file |
| Batch fill (no preview) | Server runs kernel only: `hydrate` + `setData` + `export`, no DOM |

Not a fit: an online Office editor, treating the filled file as the only source of truth, or server-side “real Office → PDF”.

## Frontend ↔ backend

**The source of truth is three artifacts**, stored by your backend. The Office file is only a template and an export vehicle.

| Artifact | Who writes it | Notes |
|----------|---------------|--------|
| Original `.docx` / `.xlsx` | Your object store | Do not mutate after publish; `export` binds on a copy |
| `definition` JSON | Created at publish; metadata can change later | Types, labels, required, options, anchors |
| `data` JSON | Fill page, saved as a draft | User values; repeating tables are arrays |

```text
Legal / ops              Your backend                         Fill page (browser)
   │                         │                                │
   │  upload contract.docx   │                                │
   │  (body has {{markers}}) │                                │
   ├────────────────────────►│  load → discover markers       │
   │                         │  merge business meta           │
   │                         │  store file + definition       │
   │                         │                                │
   │                         │◄──── GET /contracts/:id ───────┤
   │                         │     file + definition + data   │
   │                         │                                │
   │                         │                    hydrate + in-doc preview
   │                         │                    setValue → PUT draft data
   │                         │                    export → download Word/Excel/PDF
```

### Backend (store + publish, no UI)

- Persist the three artifacts; expose list / detail / file download / save draft.
- **Publish** (Node, no browser):

```ts
const kernel = createKernel({ adapter: new DocxAdapter() })
await kernel.dispatch({ type: 'load', source: { kind: 'docx', buffer } })
await db.saveTemplate({
  file: buffer,
  definition: kernel.getDefinition(),
})
```

- **Batch emit** (also Node): `hydrate` + `setData` + `export`, write `exported.buffer` to OSS. Never overwrite the original template with the export.
- Auth, approval, watermarking stay in your product.

The demo backend: `GET /api/contracts`, `/:id` (definition + data), `/:id/file` (bytes).

### Frontend (preview + fill + export)

```ts
import { createKernel, DocxAdapter, XlsxAdapter, mountDocxPreview, nativeFieldMounter } from 'paperfill'

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
  mountField: nativeFieldMounter, // or your own Element Plus mounter
  onChange: (path, value) => kernel.dispatch({ type: 'setValue', path, value }),
})

await api.saveDraft(id, kernel.getData())

const office = await kernel.dispatch({ type: 'export' })
// PDF: exportFilledDocument({ kind: office.format, buffer: office.buffer })
```

`mountDocxPreview` / `mountXlsxPreview` / `nativeFieldMounter` / `exportFilledDocument` must run **after ClientOnly / useEffect**. `createKernel` / `hydrate` / `export` work on both sides.

Sequences: [docs/architecture.md](./docs/architecture.md). API: [docs/api.md](./docs/api.md).

## Examples (Nuxt)

```bash
npm install
npm run templates
npm run example     # http://localhost:5210
```

- `/` — native `nativeFieldMounter`, validate via `kernel.validate()`
- `/custom` — Element Plus fields, validate via `el-form` rules

## Install

```bash
npm i paperfill
```

One package. **All APIs come from `paperfill`:**

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

Styles stay on subpaths. Vue / React helpers use `paperfill/vue` or `paperfill/react` because of framework peers.

## Limitations & environment

| Item | Requirement / note |
|------|-------------------|
| **Node** | `>= 20` (build, examples, scripts) |
| **Browsers** | Modern evergreen: Chrome / Edge **≥ 94**, Firefox **≥ 93**, Safari **≥ 15.4** (compile target ES2022; needs `Uint8Array` and basic DOM) |
| **Runtime** | `kernel` / `docx` / `xlsx` work in Node and browsers; `ui`, `mountDocxPreview`, `mountXlsxPreview`, and `pdf` need a **browser DOM** — do not call them on a pure SSR path |
| **PDF** | `exportFilledDocument` is **browser-only**; default `html2canvas`, not a server-side Office→PDF engine; `canvas-draw-element` needs a Chromium experimental flag |
| **Word preview** | `mountDocxPreview` uses `docx-preview`; not pixel-identical to desktop Word |
| **Excel preview** | `getPreview` / `mountXlsxPreview` support fill/font colors (`argb`; theme colors approximated); trailing empty rows/columns are dropped; no gradients, conditional formatting, charts, etc. |
| **Image fields** | data URL; `bind`/`export` embeds a Word drawing / Excel cell image (~120px, no crop/anchor tuning) |
| **Non-goals** | Full Office editor, server-grade layout engines; `ui` stays framework-free DOM, Vue/React packages only subscribe |

Docs: [docs/architecture.md](./docs/architecture.md) · [docs/api.md](./docs/api.md)

## License

MIT
