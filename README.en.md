# contract-kit

**[中文](./README.md)** | English

Headless contract template runtime for Word / Excel.

## Examples (Nuxt)

```bash
npm install
npm run templates
npm run example     # http://localhost:5210
```

- `/` — native `@contract-kit/ui`, validate via `kernel.validate()`
- `/custom` — Element Plus fields, validate via `el-form` rules

## Limitations & environment

| Item | Requirement / note |
|------|-------------------|
| **Node** | `>= 20` (build, examples, scripts) |
| **Browsers** | Modern evergreen: Chrome / Edge **≥ 94**, Firefox **≥ 93**, Safari **≥ 15.4** (compile target ES2022; needs `Uint8Array` and basic DOM) |
| **Runtime** | `kernel` / `docx` / `xlsx` work in Node and browsers; `ui`, `mountXlsxPreview`, Word preview (`docx-preview`), and `pdf` need a **browser DOM** — do not call them on a pure SSR path |
| **PDF** | `@contract-kit/pdf` is **browser-only**; default `html2canvas`, not a server-side Office→PDF engine; `canvas-draw-element` needs a Chromium experimental flag |
| **Word preview** | Layout via `docx-preview`; not pixel-identical to desktop Word |
| **Excel preview** | `getPreview` / `mountXlsxPreview` support fill/font colors (`argb`; theme colors approximated); no gradients, conditional formatting, charts, etc. |
| **Image fields** | UI can store a data URL; **embedding on docx/xlsx bind is not implemented yet** |
| **Non-goals** | Full Office editor, server-grade layout engines, Vue/React bindings (`ui` is framework-free DOM) |

Docs: [docs/architecture.md](./docs/architecture.md) · [docs/api.md](./docs/api.md)

## License

MIT
